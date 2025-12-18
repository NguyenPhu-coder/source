"""
Knowledge Graph Agent - Neo4j-based graph database management for Learn Your Way Platform
Handles knowledge representation, relationship management, and graph algorithms
"""

import asyncio
import hashlib
import json
import time
from contextlib import asynccontextmanager
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import redis.asyncio as aioredis
import structlog
import yaml
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from neo4j import AsyncGraphDatabase, AsyncSession, exceptions as neo4j_exceptions
from prometheus_client import Counter, Histogram, generate_latest
from pydantic import BaseModel, Field, validator
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

# Configure structured logging
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)

logger = structlog.get_logger()

# Prometheus metrics
QUERY_COUNT = Counter(
    "kg_queries_total", "Total graph queries", ["query_type", "status"]
)
QUERY_DURATION = Histogram(
    "kg_query_duration_seconds", "Query duration", ["query_type"]
)
NODE_COUNT = Counter("kg_nodes_total", "Total nodes created", ["label"])
RELATIONSHIP_COUNT = Counter(
    "kg_relationships_total", "Total relationships created", ["type"]
)
CACHE_HITS = Counter("kg_cache_hits_total", "Cache hits")
CACHE_MISSES = Counter("kg_cache_misses_total", "Cache misses")


class NodeType(str, Enum):
    """Valid node types in the knowledge graph"""
    CONCEPT = "Concept"
    USER = "User"
    CONTENT = "Content"
    QUIZ = "Quiz"
    LEARNING_PATH = "LearningPath"


class RelationshipType(str, Enum):
    """Valid relationship types in the knowledge graph"""
    PREREQUISITE_OF = "PREREQUISITE_OF"
    LEARNS = "LEARNS"
    STRUGGLES_WITH = "STRUGGLES_WITH"
    MASTERS = "MASTERS"
    BELONGS_TO = "BELONGS_TO"
    COLLABORATES_WITH = "COLLABORATES_WITH"


class GraphAlgorithm(str, Enum):
    """Supported graph algorithms"""
    SHORTEST_PATH = "shortest_path"
    PAGE_RANK = "page_rank"
    COMMUNITY_DETECTION = "community_detection"
    SIMILARITY = "similarity"


class NodeRequest(BaseModel):
    """Request model for creating a node"""
    label: NodeType
    properties: Dict[str, Any] = Field(..., description="Node properties")

    @validator("properties")
    def validate_properties(cls, v):
        if not v:
            raise ValueError("Properties cannot be empty")
        if "id" not in v:
            raise ValueError("Properties must include 'id' field")
        return v


class RelationshipRequest(BaseModel):
    """Request model for creating a relationship"""
    from_id: str = Field(..., description="Source node ID")
    to_id: str = Field(..., description="Target node ID")
    rel_type: RelationshipType
    properties: Dict[str, Any] = Field(default_factory=dict)


class QueryRequest(BaseModel):
    """Request model for Cypher query execution"""
    cypher: str = Field(..., description="Cypher query string")
    parameters: Dict[str, Any] = Field(default_factory=dict)
    cache: bool = Field(True, description="Use caching for read queries")

    @validator("cypher")
    def validate_cypher(cls, v):
        if not v or not v.strip():
            raise ValueError("Cypher query cannot be empty")
        # Basic SQL injection prevention
        dangerous_keywords = ["DROP", "DELETE ALL", "DETACH DELETE ALL"]
        upper_query = v.upper()
        for keyword in dangerous_keywords:
            if keyword in upper_query and "WHERE" not in upper_query:
                raise ValueError(f"Potentially dangerous query pattern detected")
        return v.strip()


class MasteryUpdate(BaseModel):
    """Request model for updating user mastery"""
    user_id: str
    concept_id: str
    score: float = Field(..., ge=0.0, le=1.0, description="Mastery score (0-1)")
    timestamp: Optional[datetime] = None


class NodeResponse(BaseModel):
    """Response model for node operations"""
    node_id: str
    label: str
    properties: Dict[str, Any]
    created_at: datetime


class RelationshipResponse(BaseModel):
    """Response model for relationship operations"""
    rel_id: str
    from_id: str
    to_id: str
    type: str
    properties: Dict[str, Any]
    created_at: datetime


class PathResponse(BaseModel):
    """Response model for learning path"""
    path: List[Dict[str, Any]]
    total_concepts: int
    estimated_hours: float
    difficulty_score: float


class GraphVisualizationResponse(BaseModel):
    """Response model for graph visualization data"""
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    central_node: str
    depth: int


class Neo4jConnectionPool:
    """Neo4j connection pool manager with retry logic"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.driver = None
        self.logger = structlog.get_logger()

    @retry(
        stop=stop_after_attempt(10),
        wait=wait_exponential(multiplier=2, min=5, max=60),
        retry=retry_if_exception_type((Exception,)),
        before_sleep=lambda retry_state: structlog.get_logger().warning(
            "neo4j_connection_retry",
            attempt=retry_state.attempt_number,
            wait_time=retry_state.next_action.sleep
        )
    )
    async def connect(self):
        """Establish Neo4j connection with retry logic"""
        try:
            neo4j_config = self.config["neo4j"]
            uri = neo4j_config["uri"]
            user = neo4j_config["user"]
            password = neo4j_config.get("password", "")
            
            self.driver = AsyncGraphDatabase.driver(
                uri,
                auth=(user, password),
                max_connection_pool_size=neo4j_config.get("max_connection_pool_size", 50),
                connection_timeout=neo4j_config.get("connection_timeout", 30),
            )
            
            # Verify connectivity
            async with self.driver.session() as session:
                await session.run("RETURN 1")
            
            self.logger.info("neo4j_connected", uri=uri)
        except Exception as e:
            self.logger.error("neo4j_connection_failed", error=str(e))
            raise

    async def close(self):
        """Close Neo4j connection"""
        if self.driver:
            await self.driver.close()
            self.logger.info("neo4j_disconnected")

    @asynccontextmanager
    async def session(self, database: Optional[str] = None):
        """Get Neo4j session context manager"""
        if not self.driver:
            raise RuntimeError("Neo4j driver not initialized")
        
        db = database or self.config["neo4j"].get("database", "neo4j")
        session = self.driver.session(database=db)
        try:
            yield session
        finally:
            await session.close()


class CacheManager:
    """Redis-based cache manager for query results"""

    def __init__(self, redis_url: str, ttl: int = 300):
        self.redis_url = redis_url
        self.ttl = ttl
        self.redis = None
        self.logger = structlog.get_logger()

    async def connect(self):
        """Connect to Redis"""
        try:
            self.redis = await aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            await self.redis.ping()
            self.logger.info("redis_connected", url=self.redis_url)
        except Exception as e:
            self.logger.warning("redis_connection_failed", error=str(e))
            self.redis = None

    async def close(self):
        """Close Redis connection"""
        if self.redis:
            await self.redis.close()
            self.logger.info("redis_disconnected")

    def _generate_key(self, query: str, params: Dict[str, Any]) -> str:
        """Generate cache key from query and parameters"""
        cache_string = f"{query}:{json.dumps(params, sort_keys=True)}"
        return f"kg:cache:{hashlib.md5(cache_string.encode()).hexdigest()}"

    async def get(self, query: str, params: Dict[str, Any]) -> Optional[List[Dict]]:
        """Get cached query result"""
        if not self.redis:
            return None

        try:
            key = self._generate_key(query, params)
            cached = await self.redis.get(key)
            
            if cached:
                CACHE_HITS.inc()
                self.logger.debug("cache_hit", key=key)
                return json.loads(cached)
            else:
                CACHE_MISSES.inc()
                return None
        except Exception as e:
            self.logger.warning("cache_get_error", error=str(e))
            return None

    async def set(self, query: str, params: Dict[str, Any], result: List[Dict]):
        """Set cached query result"""
        if not self.redis:
            return

        try:
            key = self._generate_key(query, params)
            await self.redis.setex(
                key,
                self.ttl,
                json.dumps(result)
            )
            self.logger.debug("cache_set", key=key, ttl=self.ttl)
        except Exception as e:
            self.logger.warning("cache_set_error", error=str(e))

    async def invalidate_pattern(self, pattern: str):
        """Invalidate cache keys matching pattern"""
        if not self.redis:
            return

        try:
            keys = []
            async for key in self.redis.scan_iter(match=f"kg:cache:{pattern}*"):
                keys.append(key)
            
            if keys:
                await self.redis.delete(*keys)
                self.logger.info("cache_invalidated", count=len(keys))
        except Exception as e:
            self.logger.warning("cache_invalidate_error", error=str(e))


class KnowledgeGraphAgent:
    """Main Knowledge Graph Agent for managing Neo4j operations"""

    def __init__(self, config_path: str = "config.yaml"):
        self.config = self._load_config(config_path)
        self.neo4j_pool = Neo4jConnectionPool(self.config)
        
        cache_config = self.config.get("caching", {})
        self.cache = None
        if cache_config.get("enable", True):
            self.cache = CacheManager(
                cache_config.get("redis_url", "redis://localhost:6379"),
                cache_config.get("ttl", 300)
            )
        
        self.logger = structlog.get_logger()
        self.node_types = [NodeType(nt) for nt in self.config.get("node_types", [])]
        self.relationship_types = [RelationshipType(rt) for rt in self.config.get("relationship_types", [])]

    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from YAML file"""
        try:
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            logger.info("config_loaded", path=config_path)
            return config
        except Exception as e:
            logger.error("config_load_failed", error=str(e))
            raise

    async def initialize(self):
        """Initialize Neo4j connection and create indexes"""
        await self.neo4j_pool.connect()
        
        if self.cache:
            await self.cache.connect()
        
        await self._create_indexes()
        await self._create_constraints()
        
        self.logger.info("kg_agent_initialized")

    async def shutdown(self):
        """Shutdown connections"""
        await self.neo4j_pool.close()
        if self.cache:
            await self.cache.close()
        self.logger.info("kg_agent_shutdown")

    async def _create_indexes(self):
        """Create necessary indexes for performance"""
        indexes = [
            "CREATE INDEX concept_id IF NOT EXISTS FOR (c:Concept) ON (c.id)",
            "CREATE INDEX user_id IF NOT EXISTS FOR (u:User) ON (u.id)",
            "CREATE INDEX content_id IF NOT EXISTS FOR (c:Content) ON (c.id)",
            "CREATE INDEX quiz_id IF NOT EXISTS FOR (q:Quiz) ON (q.id)",
            "CREATE INDEX learning_path_id IF NOT EXISTS FOR (lp:LearningPath) ON (lp.id)",
        ]
        
        async with self.neo4j_pool.session() as session:
            for index_query in indexes:
                try:
                    await session.run(index_query)
                    self.logger.debug("index_created", query=index_query)
                except Exception as e:
                    self.logger.warning("index_creation_failed", error=str(e))

    async def _create_constraints(self):
        """Create uniqueness constraints"""
        constraints = [
            "CREATE CONSTRAINT concept_unique IF NOT EXISTS FOR (c:Concept) REQUIRE c.id IS UNIQUE",
            "CREATE CONSTRAINT user_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
            "CREATE CONSTRAINT content_unique IF NOT EXISTS FOR (c:Content) REQUIRE c.id IS UNIQUE",
            "CREATE CONSTRAINT quiz_unique IF NOT EXISTS FOR (q:Quiz) REQUIRE q.id IS UNIQUE",
            "CREATE CONSTRAINT path_unique IF NOT EXISTS FOR (lp:LearningPath) REQUIRE lp.id IS UNIQUE",
        ]
        
        async with self.neo4j_pool.session() as session:
            for constraint_query in constraints:
                try:
                    await session.run(constraint_query)
                    self.logger.debug("constraint_created", query=constraint_query)
                except Exception as e:
                    self.logger.warning("constraint_creation_failed", error=str(e))

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((neo4j_exceptions.ServiceUnavailable, neo4j_exceptions.SessionExpired))
    )
    async def create_node(self, label: str, properties: Dict[str, Any]) -> str:
        """
        Create a new node in the knowledge graph
        
        Args:
            label: Node label (type)
            properties: Node properties including required 'id' field
            
        Returns:
            Node ID
        """
        start_time = time.time()
        
        try:
            # Validate label
            if label not in [nt.value for nt in self.node_types]:
                raise ValueError(f"Invalid node label: {label}")
            
            # Add timestamp
            properties["created_at"] = datetime.utcnow().isoformat()
            properties["updated_at"] = datetime.utcnow().isoformat()
            
            # Create node
            query = f"""
            CREATE (n:{label} $props)
            RETURN n.id as id
            """
            
            async with self.neo4j_pool.session() as session:
                result = await session.run(query, props=properties)
                record = await result.single()
                node_id = record["id"]
            
            NODE_COUNT.labels(label=label).inc()
            QUERY_COUNT.labels(query_type="create_node", status="success").inc()
            QUERY_DURATION.labels(query_type="create_node").observe(time.time() - start_time)
            
            self.logger.info(
                "node_created",
                label=label,
                node_id=node_id,
                duration=time.time() - start_time
            )
            
            # Invalidate related cache
            if self.cache:
                await self.cache.invalidate_pattern(f"{label}*")
            
            return node_id
            
        except Exception as e:
            QUERY_COUNT.labels(query_type="create_node", status="error").inc()
            self.logger.error("node_creation_failed", error=str(e), label=label)
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((neo4j_exceptions.ServiceUnavailable, neo4j_exceptions.SessionExpired))
    )
    async def create_relationship(
        self,
        from_id: str,
        to_id: str,
        rel_type: str,
        properties: Dict[str, Any] = None
    ) -> str:
        """
        Create a relationship between two nodes
        
        Args:
            from_id: Source node ID
            to_id: Target node ID
            rel_type: Relationship type
            properties: Optional relationship properties
            
        Returns:
            Relationship ID
        """
        start_time = time.time()
        
        try:
            # Validate relationship type
            if rel_type not in [rt.value for rt in self.relationship_types]:
                raise ValueError(f"Invalid relationship type: {rel_type}")
            
            properties = properties or {}
            properties["created_at"] = datetime.utcnow().isoformat()
            
            query = f"""
            MATCH (a {{id: $from_id}})
            MATCH (b {{id: $to_id}})
            CREATE (a)-[r:{rel_type} $props]->(b)
            RETURN id(r) as rel_id
            """
            
            async with self.neo4j_pool.session() as session:
                result = await session.run(
                    query,
                    from_id=from_id,
                    to_id=to_id,
                    props=properties
                )
                record = await result.single()
                
                if not record:
                    raise ValueError(f"Could not find nodes with IDs: {from_id}, {to_id}")
                
                rel_id = str(record["rel_id"])
            
            RELATIONSHIP_COUNT.labels(type=rel_type).inc()
            QUERY_COUNT.labels(query_type="create_relationship", status="success").inc()
            QUERY_DURATION.labels(query_type="create_relationship").observe(time.time() - start_time)
            
            self.logger.info(
                "relationship_created",
                rel_type=rel_type,
                from_id=from_id,
                to_id=to_id,
                rel_id=rel_id
            )
            
            # Invalidate cache
            if self.cache:
                await self.cache.invalidate_pattern(f"{from_id}*")
                await self.cache.invalidate_pattern(f"{to_id}*")
            
            return rel_id
            
        except Exception as e:
            QUERY_COUNT.labels(query_type="create_relationship", status="error").inc()
            self.logger.error("relationship_creation_failed", error=str(e))
            raise

    async def query_cypher(
        self,
        cypher: str,
        parameters: Dict[str, Any] = None,
        use_cache: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Execute a custom Cypher query
        
        Args:
            cypher: Cypher query string
            parameters: Query parameters
            use_cache: Whether to use caching for read queries
            
        Returns:
            List of result records
        """
        start_time = time.time()
        parameters = parameters or {}
        
        try:
            # Check cache for read queries
            is_read_query = cypher.strip().upper().startswith(("MATCH", "RETURN", "WITH"))
            
            if use_cache and is_read_query and self.cache:
                cached_result = await self.cache.get(cypher, parameters)
                if cached_result is not None:
                    return cached_result
            
            # Execute query
            async with self.neo4j_pool.session() as session:
                result = await session.run(cypher, **parameters)
                records = await result.data()
            
            QUERY_COUNT.labels(query_type="custom_cypher", status="success").inc()
            QUERY_DURATION.labels(query_type="custom_cypher").observe(time.time() - start_time)
            
            # Cache read query results
            if use_cache and is_read_query and self.cache:
                await self.cache.set(cypher, parameters, records)
            
            self.logger.info(
                "cypher_executed",
                query_length=len(cypher),
                result_count=len(records),
                duration=time.time() - start_time
            )
            
            return records
            
        except Exception as e:
            QUERY_COUNT.labels(query_type="custom_cypher", status="error").inc()
            self.logger.error("cypher_execution_failed", error=str(e), query=cypher[:100])
            raise

    async def find_learning_path(
        self,
        user_id: str,
        target_concept: str,
        max_depth: int = 10
    ) -> Dict[str, Any]:
        """
        Find optimal learning path from user's current knowledge to target concept
        
        Args:
            user_id: User ID
            target_concept: Target concept ID
            max_depth: Maximum path depth
            
        Returns:
            Learning path with concepts and metadata
        """
        start_time = time.time()
        
        try:
            # Find user's mastered concepts
            mastered_query = """
            MATCH (u:User {id: $user_id})-[m:MASTERS]->(c:Concept)
            WHERE m.score >= 0.8
            RETURN c.id as concept_id
            """
            
            # Find shortest path considering prerequisites
            path_query = """
            MATCH (target:Concept {id: $target_concept})
            OPTIONAL MATCH path = shortestPath(
                (start:Concept)-[:PREREQUISITE_OF*1..10]->(target)
            )
            WHERE NOT start.id IN $mastered_concepts
            WITH path, target
            UNWIND nodes(path) as concept
            MATCH (concept)
            OPTIONAL MATCH (concept)-[:BELONGS_TO]->(content:Content)
            RETURN DISTINCT 
                concept.id as id,
                concept.name as name,
                concept.difficulty as difficulty,
                concept.estimated_hours as hours,
                collect(DISTINCT content.type) as content_types,
                concept.description as description
            ORDER BY length(path)
            """
            
            async with self.neo4j_pool.session() as session:
                # Get mastered concepts
                mastered_result = await session.run(mastered_query, user_id=user_id)
                mastered = [r["concept_id"] async for r in mastered_result]
                
                # Get learning path
                path_result = await session.run(
                    path_query,
                    target_concept=target_concept,
                    mastered_concepts=mastered
                )
                path_nodes = await path_result.data()
            
            # Calculate metrics
            total_hours = sum(node.get("hours", 1.0) for node in path_nodes)
            avg_difficulty = sum(node.get("difficulty", 0.5) for node in path_nodes) / max(len(path_nodes), 1)
            
            result = {
                "path": path_nodes,
                "total_concepts": len(path_nodes),
                "estimated_hours": round(total_hours, 1),
                "difficulty_score": round(avg_difficulty, 2),
                "mastered_prerequisites": mastered
            }
            
            QUERY_DURATION.labels(query_type="find_learning_path").observe(time.time() - start_time)
            
            self.logger.info(
                "learning_path_found",
                user_id=user_id,
                target=target_concept,
                path_length=len(path_nodes),
                duration=time.time() - start_time
            )
            
            return result
            
        except Exception as e:
            self.logger.error("learning_path_failed", error=str(e), user_id=user_id)
            raise

    async def get_prerequisites(self, concept_id: str, max_depth: int = 5) -> List[Dict[str, Any]]:
        """
        Get all prerequisites for a concept
        
        Args:
            concept_id: Concept ID
            max_depth: Maximum depth to traverse
            
        Returns:
            List of prerequisite concepts with metadata
        """
        try:
            query = f"""
            MATCH path = (c:Concept {{id: $concept_id}})<-[:PREREQUISITE_OF*1..{max_depth}]-(prereq:Concept)
            WITH prereq, length(path) as depth
            RETURN DISTINCT
                prereq.id as id,
                prereq.name as name,
                prereq.difficulty as difficulty,
                prereq.estimated_hours as hours,
                depth,
                prereq.description as description
            ORDER BY depth
            """
            
            records = await self.query_cypher(query, {"concept_id": concept_id})
            
            self.logger.info("prerequisites_retrieved", concept_id=concept_id, count=len(records))
            
            return records
            
        except Exception as e:
            self.logger.error("prerequisites_retrieval_failed", error=str(e))
            raise

    async def find_similar_users(
        self,
        user_id: str,
        limit: int = 10,
        min_similarity: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Find users with similar learning patterns using Jaccard similarity
        
        Args:
            user_id: User ID
            limit: Maximum number of similar users
            min_similarity: Minimum similarity threshold
            
        Returns:
            List of similar users with similarity scores
        """
        try:
            query = """
            MATCH (u1:User {id: $user_id})-[:MASTERS]->(c:Concept)<-[:MASTERS]-(u2:User)
            WHERE u1 <> u2
            WITH u1, u2, count(DISTINCT c) as common
            MATCH (u1)-[:MASTERS]->(c1:Concept)
            WITH u1, u2, common, count(DISTINCT c1) as u1_total
            MATCH (u2)-[:MASTERS]->(c2:Concept)
            WITH u1, u2, common, u1_total, count(DISTINCT c2) as u2_total
            WITH u2, 
                 toFloat(common) / (u1_total + u2_total - common) as similarity
            WHERE similarity >= $min_similarity
            MATCH (u2)
            OPTIONAL MATCH (u2)-[l:LEARNS]->(c:Concept)
            RETURN 
                u2.id as id,
                u2.name as name,
                similarity,
                count(DISTINCT c) as concepts_learning,
                u2.level as level,
                u2.interests as interests
            ORDER BY similarity DESC
            LIMIT $limit
            """
            
            records = await self.query_cypher(
                query,
                {
                    "user_id": user_id,
                    "limit": limit,
                    "min_similarity": min_similarity
                }
            )
            
            self.logger.info(
                "similar_users_found",
                user_id=user_id,
                count=len(records)
            )
            
            return records
            
        except Exception as e:
            self.logger.error("similar_users_failed", error=str(e))
            raise

    async def update_mastery(
        self,
        user_id: str,
        concept_id: str,
        score: float,
        timestamp: Optional[datetime] = None
    ) -> bool:
        """
        Update or create user mastery relationship
        
        Args:
            user_id: User ID
            concept_id: Concept ID
            score: Mastery score (0-1)
            timestamp: Optional timestamp
            
        Returns:
            Success status
        """
        try:
            timestamp = timestamp or datetime.utcnow()
            
            query = """
            MATCH (u:User {id: $user_id})
            MATCH (c:Concept {id: $concept_id})
            MERGE (u)-[m:MASTERS]->(c)
            SET m.score = $score,
                m.updated_at = $timestamp,
                m.attempts = COALESCE(m.attempts, 0) + 1
            RETURN m.score as score
            """
            
            async with self.neo4j_pool.session() as session:
                result = await session.run(
                    query,
                    user_id=user_id,
                    concept_id=concept_id,
                    score=score,
                    timestamp=timestamp.isoformat()
                )
                record = await result.single()
                
                if not record:
                    raise ValueError(f"User or concept not found: {user_id}, {concept_id}")
            
            # Invalidate cache
            if self.cache:
                await self.cache.invalidate_pattern(f"{user_id}*")
            
            self.logger.info(
                "mastery_updated",
                user_id=user_id,
                concept_id=concept_id,
                score=score
            )
            
            return True
            
        except Exception as e:
            self.logger.error("mastery_update_failed", error=str(e))
            raise

    async def get_concept_graph(
        self,
        concept_id: str,
        depth: int = 2,
        include_users: bool = False
    ) -> Dict[str, Any]:
        """
        Get graph visualization data for a concept and its relationships
        
        Args:
            concept_id: Central concept ID
            depth: Depth of relationships to include
            include_users: Whether to include user nodes
            
        Returns:
            Graph data with nodes and edges for visualization
        """
        try:
            # Build query based on parameters
            user_clause = ""
            if include_users:
                user_clause = """
                OPTIONAL MATCH (u:User)-[um:MASTERS|LEARNS]->(c)
                """
            
            query = f"""
            MATCH path = (c:Concept {{id: $concept_id}})-[*0..{depth}]-(related)
            WHERE related:Concept OR related:Content
            {user_clause}
            WITH c, collect(DISTINCT related) as related_nodes, 
                 collect(DISTINCT relationships(path)) as all_rels
            UNWIND related_nodes as node
            WITH c, node, all_rels
            RETURN DISTINCT
                node.id as node_id,
                labels(node)[0] as node_type,
                node.name as name,
                node as properties
            UNION
            MATCH (c:Concept {{id: $concept_id}})
            RETURN c.id as node_id, 'Concept' as node_type, c.name as name, c as properties
            """
            
            # Get relationships
            rel_query = f"""
            MATCH path = (c:Concept {{id: $concept_id}})-[r*0..{depth}]-(related)
            WHERE related:Concept OR related:Content
            UNWIND relationships(path) as rel
            RETURN DISTINCT
                id(rel) as rel_id,
                startNode(rel).id as from_id,
                endNode(rel).id as to_id,
                type(rel) as rel_type,
                properties(rel) as properties
            """
            
            async with self.neo4j_pool.session() as session:
                nodes_result = await session.run(query, concept_id=concept_id)
                nodes = await nodes_result.data()
                
                rels_result = await session.run(rel_query, concept_id=concept_id)
                edges = await rels_result.data()
            
            result = {
                "nodes": nodes,
                "edges": edges,
                "central_node": concept_id,
                "depth": depth,
                "node_count": len(nodes),
                "edge_count": len(edges)
            }
            
            self.logger.info(
                "concept_graph_retrieved",
                concept_id=concept_id,
                nodes=len(nodes),
                edges=len(edges)
            )
            
            return result
            
        except Exception as e:
            self.logger.error("concept_graph_failed", error=str(e))
            raise

    async def execute_graph_algorithm(
        self,
        algorithm: str,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute graph algorithms (requires GDS library)
        
        Args:
            algorithm: Algorithm name
            parameters: Algorithm-specific parameters
            
        Returns:
            Algorithm results
        """
        try:
            if algorithm == GraphAlgorithm.PAGE_RANK.value:
                query = """
                CALL gds.pageRank.stream($graph_name)
                YIELD nodeId, score
                RETURN gds.util.asNode(nodeId).id as node_id, score
                ORDER BY score DESC
                LIMIT $limit
                """
            elif algorithm == GraphAlgorithm.COMMUNITY_DETECTION.value:
                query = """
                CALL gds.louvain.stream($graph_name)
                YIELD nodeId, communityId
                RETURN gds.util.asNode(nodeId).id as node_id, communityId
                """
            elif algorithm == GraphAlgorithm.SIMILARITY.value:
                query = """
                CALL gds.nodeSimilarity.stream($graph_name)
                YIELD node1, node2, similarity
                RETURN 
                    gds.util.asNode(node1).id as node1_id,
                    gds.util.asNode(node2).id as node2_id,
                    similarity
                ORDER BY similarity DESC
                LIMIT $limit
                """
            else:
                raise ValueError(f"Unsupported algorithm: {algorithm}")
            
            records = await self.query_cypher(query, parameters, use_cache=False)
            
            self.logger.info("graph_algorithm_executed", algorithm=algorithm)
            
            return {
                "algorithm": algorithm,
                "results": records,
                "count": len(records)
            }
            
        except Exception as e:
            self.logger.error("graph_algorithm_failed", error=str(e), algorithm=algorithm)
            raise

    async def get_health_status(self) -> Dict[str, Any]:
        """Get agent health status"""
        try:
            # Test Neo4j connection
            async with self.neo4j_pool.session() as session:
                result = await session.run("RETURN 1 as health")
                await result.single()
            neo4j_status = "healthy"
        except Exception as e:
            neo4j_status = f"unhealthy: {str(e)}"
        
        # Test Redis connection
        redis_status = "disabled"
        if self.cache and self.cache.redis:
            try:
                await self.cache.redis.ping()
                redis_status = "healthy"
            except Exception as e:
                redis_status = f"unhealthy: {str(e)}"
        
        return {
            "status": "healthy" if neo4j_status == "healthy" else "degraded",
            "timestamp": datetime.utcnow().isoformat(),
            "components": {
                "neo4j": neo4j_status,
                "redis_cache": redis_status
            },
            "version": "1.0.0"
        }


# Global agent instance
agent = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan event handler"""
    global agent
    agent = KnowledgeGraphAgent()
    await agent.initialize()
    yield
    await agent.shutdown()


# Create FastAPI app
app = FastAPI(
    title="Knowledge Graph Agent",
    description="Neo4j-based knowledge graph management for Learn Your Way Platform",
    version="1.0.0",
    lifespan=lifespan
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all HTTP requests"""
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    
    logger.info(
        "http_request",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration=duration
    )
    
    return response


@app.post("/nodes", response_model=NodeResponse, status_code=status.HTTP_201_CREATED)
async def create_node_endpoint(request: NodeRequest):
    """Create a new node in the knowledge graph"""
    try:
        node_id = await agent.create_node(request.label.value, request.properties)
        
        return NodeResponse(
            node_id=node_id,
            label=request.label.value,
            properties=request.properties,
            created_at=datetime.utcnow()
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.post("/relationships", response_model=RelationshipResponse, status_code=status.HTTP_201_CREATED)
async def create_relationship_endpoint(request: RelationshipRequest):
    """Create a relationship between two nodes"""
    try:
        rel_id = await agent.create_relationship(
            request.from_id,
            request.to_id,
            request.rel_type.value,
            request.properties
        )
        
        return RelationshipResponse(
            rel_id=rel_id,
            from_id=request.from_id,
            to_id=request.to_id,
            type=request.rel_type.value,
            properties=request.properties,
            created_at=datetime.utcnow()
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.post("/query")
async def query_cypher_endpoint(request: QueryRequest):
    """Execute a custom Cypher query"""
    try:
        results = await agent.query_cypher(
            request.cypher,
            request.parameters,
            request.cache
        )
        
        return {
            "results": results,
            "count": len(results),
            "query": request.cypher[:100] + "..." if len(request.cypher) > 100 else request.cypher
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.get("/learning-path/{user_id}/{concept_id}", response_model=PathResponse)
async def get_learning_path_endpoint(user_id: str, concept_id: str, max_depth: int = 10):
    """Find optimal learning path for a user to reach target concept"""
    try:
        result = await agent.find_learning_path(user_id, concept_id, max_depth)
        
        return PathResponse(
            path=result["path"],
            total_concepts=result["total_concepts"],
            estimated_hours=result["estimated_hours"],
            difficulty_score=result["difficulty_score"]
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.get("/prerequisites/{concept_id}")
async def get_prerequisites_endpoint(concept_id: str, max_depth: int = 5):
    """Get all prerequisites for a concept"""
    try:
        prerequisites = await agent.get_prerequisites(concept_id, max_depth)
        
        return {
            "concept_id": concept_id,
            "prerequisites": prerequisites,
            "count": len(prerequisites)
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.get("/similar-users/{user_id}")
async def get_similar_users_endpoint(
    user_id: str,
    limit: int = 10,
    min_similarity: float = 0.5
):
    """Find users with similar learning patterns"""
    try:
        similar_users = await agent.find_similar_users(user_id, limit, min_similarity)
        
        return {
            "user_id": user_id,
            "similar_users": similar_users,
            "count": len(similar_users)
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.put("/mastery")
async def update_mastery_endpoint(request: MasteryUpdate):
    """Update user mastery for a concept"""
    try:
        success = await agent.update_mastery(
            request.user_id,
            request.concept_id,
            request.score,
            request.timestamp
        )
        
        return {
            "success": success,
            "user_id": request.user_id,
            "concept_id": request.concept_id,
            "score": request.score,
            "updated_at": datetime.utcnow().isoformat()
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.get("/graph/{concept_id}", response_model=GraphVisualizationResponse)
async def get_concept_graph_endpoint(
    concept_id: str,
    depth: int = 2,
    include_users: bool = False
):
    """Get graph visualization data for a concept"""
    try:
        graph_data = await agent.get_concept_graph(concept_id, depth, include_users)
        
        return GraphVisualizationResponse(
            nodes=graph_data["nodes"],
            edges=graph_data["edges"],
            central_node=graph_data["central_node"],
            depth=graph_data["depth"]
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    health_status = await agent.get_health_status()
    status_code = status.HTTP_200_OK if health_status["status"] == "healthy" else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(content=health_status, status_code=status_code)


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return JSONResponse(
        content=generate_latest().decode("utf-8"),
        media_type="text/plain"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8010)
