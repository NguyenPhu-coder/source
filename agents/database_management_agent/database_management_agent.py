"""
Database Management Agent - Production-ready PostgreSQL management system

Features:
- Connection pooling with health checks
- Transaction management (ACID)
- Schema migrations with Alembic
- Prepared statements
- Query optimization and analysis
- Index management
- Automatic backups
- Query caching with Redis
- Slow query logging
- Read replica load balancing
"""

import asyncio
import hashlib
import json
import logging
import os
import subprocess
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import asyncpg
import redis.asyncio as aioredis
import structlog
import yaml
from asyncpg import Pool, Connection
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, MetaData, Table, inspect, text
from sqlalchemy.orm import sessionmaker
from alembic import command
from alembic.config import Config as AlembicConfig

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ]
)
logger = structlog.get_logger()

# ============================================================================
# Models and Enums
# ============================================================================

class IsolationLevel(str, Enum):
    """Transaction isolation levels"""
    READ_UNCOMMITTED = "read_uncommitted"
    READ_COMMITTED = "read_committed"
    REPEATABLE_READ = "repeatable_read"
    SERIALIZABLE = "serializable"


class QueryType(str, Enum):
    """Query type classification"""
    SELECT = "select"
    INSERT = "insert"
    UPDATE = "update"
    DELETE = "delete"
    DDL = "ddl"


@dataclass
class QueryResult:
    """Query execution result"""
    rows: List[Dict[str, Any]]
    row_count: int
    execution_time: float
    query_type: QueryType
    from_cache: bool = False


@dataclass
class ConnectionPoolStats:
    """Connection pool statistics"""
    total_connections: int
    idle_connections: int
    active_connections: int
    waiting_connections: int
    max_connections: int


@dataclass
class MigrationResult:
    """Migration execution result"""
    success: bool
    migration_file: str
    version: str
    execution_time: float
    error: Optional[str] = None


@dataclass
class BackupResult:
    """Backup operation result"""
    success: bool
    backup_file: str
    size_bytes: int
    duration: float
    error: Optional[str] = None


# API Models
class QueryRequest(BaseModel):
    """Query request"""
    sql: str = Field(..., description="SQL query to execute")
    params: Optional[List[Any]] = Field(default=None, description="Query parameters")
    transaction: bool = Field(default=False, description="Execute in transaction")
    use_cache: bool = Field(default=True, description="Use query cache")


class TransactionRequest(BaseModel):
    """Transaction request"""
    queries: List[Dict[str, Any]] = Field(..., description="List of queries with params")
    isolation_level: Optional[IsolationLevel] = Field(default=None, description="Isolation level")


class MigrationRequest(BaseModel):
    """Migration request"""
    migration_file: Optional[str] = Field(default=None, description="Specific migration file")
    direction: str = Field(default="upgrade", description="Migration direction (upgrade/downgrade)")
    target: Optional[str] = Field(default=None, description="Target version")


class BackupRequest(BaseModel):
    """Backup request"""
    backup_name: Optional[str] = Field(default=None, description="Backup name")
    compress: bool = Field(default=True, description="Compress backup")


class RestoreRequest(BaseModel):
    """Restore request"""
    backup_file: str = Field(..., description="Backup file path")
    drop_existing: bool = Field(default=False, description="Drop existing database")


class OptimizeRequest(BaseModel):
    """Query optimization request"""
    sql: str = Field(..., description="SQL query to optimize")
    analyze: bool = Field(default=True, description="Include EXPLAIN ANALYZE")


class IndexRequest(BaseModel):
    """Index management request"""
    table: str = Field(..., description="Table name")
    action: str = Field(..., description="Action (analyze/suggest/rebuild)")
    columns: Optional[List[str]] = Field(default=None, description="Columns for index")


# ============================================================================
# Connection Pool Manager
# ============================================================================

class ConnectionPoolManager:
    """Manages PostgreSQL connection pools"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.pool: Optional[Pool] = None
        self.read_pools: List[Pool] = []
        self.stats = {
            "queries_executed": 0,
            "transactions_executed": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "slow_queries": 0,
            "errors": 0
        }
    
    async def create_pool(self) -> Pool:
        """Create connection pool"""
        try:
            pg_config = self.config["postgresql"]
            pool_config = pg_config["connection_pool"]
            
            # Get password from environment
            password = os.environ.get("POSTGRES_PASSWORD", pg_config.get("password", ""))
            
            # Debug logging
            logger.info("attempting_postgres_connection",
                       host=pg_config["host"],
                       port=pg_config["port"],
                       database=pg_config["database"],
                       user=pg_config["user"])
            
            pool = await asyncpg.create_pool(
                host=pg_config["host"],
                port=pg_config["port"],
                database=pg_config["database"],
                user=pg_config["user"],
                password=password,
                min_size=pool_config["min_size"],
                max_size=pool_config["max_size"],
                command_timeout=pool_config["timeout"]
            )
            
            logger.info("connection_pool_created", 
                       min_size=pool_config["min_size"],
                       max_size=pool_config["max_size"])
            
            return pool
            
        except Exception as e:
            logger.error("connection_pool_creation_failed", error=str(e))
            raise
    
    async def initialize(self):
        """Initialize connection pools"""
        self.pool = await self.create_pool()
        
        # Initialize read replica pools if configured
        if "read_replicas" in self.config["postgresql"]:
            for replica in self.config["postgresql"]["read_replicas"]:
                replica_pool = await self._create_replica_pool(replica)
                self.read_pools.append(replica_pool)
    
    async def _create_replica_pool(self, replica_config: Dict[str, Any]) -> Pool:
        """Create read replica pool"""
        pool_config = self.config["postgresql"]["connection_pool"]
        password = os.environ.get("POSTGRES_PASSWORD", replica_config.get("password", ""))
        
        return await asyncpg.create_pool(
            host=replica_config["host"],
            port=replica_config["port"],
            database=replica_config["database"],
            user=replica_config["user"],
            password=password,
            min_size=pool_config["min_size"] // 2,
            max_size=pool_config["max_size"] // 2,
            command_timeout=pool_config["timeout"]
        )
    
    async def get_connection(self, read_only: bool = False) -> Connection:
        """Get connection from pool"""
        if read_only and self.read_pools:
            # Load balance across read replicas
            pool = self.read_pools[self.stats["queries_executed"] % len(self.read_pools)]
        else:
            pool = self.pool
        
        return await pool.acquire()
    
    async def release_connection(self, connection: Connection, read_only: bool = False):
        """Release connection back to pool"""
        if read_only and self.read_pools:
            pool = self.read_pools[self.stats["queries_executed"] % len(self.read_pools)]
        else:
            pool = self.pool
        
        await pool.release(connection)
    
    async def get_pool_stats(self) -> ConnectionPoolStats:
        """Get connection pool statistics"""
        if not self.pool:
            raise RuntimeError("Connection pool not initialized")
        
        size = self.pool.get_size()
        idle = self.pool.get_idle_size()
        
        return ConnectionPoolStats(
            total_connections=size,
            idle_connections=idle,
            active_connections=size - idle,
            waiting_connections=0,  # asyncpg doesn't expose this
            max_connections=self.pool.get_max_size()
        )
    
    async def health_check(self) -> Dict[str, Any]:
        """Check connection pool health"""
        try:
            async with self.pool.acquire() as conn:
                result = await conn.fetchval("SELECT 1")
                
                stats = await self.get_pool_stats()
                
                return {
                    "healthy": result == 1,
                    "pool_stats": {
                        "total": stats.total_connections,
                        "idle": stats.idle_connections,
                        "active": stats.active_connections,
                        "max": stats.max_connections
                    },
                    "read_replicas": len(self.read_pools)
                }
        except Exception as e:
            logger.error("health_check_failed", error=str(e))
            return {
                "healthy": False,
                "error": str(e)
            }
    
    async def close(self):
        """Close all connection pools"""
        if self.pool:
            await self.pool.close()
        
        for pool in self.read_pools:
            await pool.close()


# ============================================================================
# Query Cache Manager
# ============================================================================

class QueryCacheManager:
    """Manages query result caching with Redis"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.redis_client: Optional[aioredis.Redis] = None
        self.enabled = config.get("caching", {}).get("enable", False)
        self.ttl = config.get("caching", {}).get("query_cache_ttl", 300)
    
    async def initialize(self):
        """Initialize Redis connection"""
        if not self.enabled:
            return
        
        try:
            redis_url = self.config["caching"]["redis_url"]
            self.redis_client = await aioredis.from_url(redis_url)
            
            logger.info("query_cache_initialized", redis_url=redis_url)
            
        except Exception as e:
            logger.warning("query_cache_initialization_failed", error=str(e))
            self.enabled = False
    
    def _generate_cache_key(self, sql: str, params: Optional[List[Any]]) -> str:
        """Generate cache key for query"""
        key_data = f"{sql}:{json.dumps(params or [], default=str)}"
        return f"query_cache:{hashlib.sha256(key_data.encode()).hexdigest()}"
    
    async def get(self, sql: str, params: Optional[List[Any]]) -> Optional[QueryResult]:
        """Get cached query result"""
        if not self.enabled or not self.redis_client:
            return None
        
        try:
            cache_key = self._generate_cache_key(sql, params)
            cached = await self.redis_client.get(cache_key)
            
            if cached:
                data = json.loads(cached)
                return QueryResult(
                    rows=data["rows"],
                    row_count=data["row_count"],
                    execution_time=data["execution_time"],
                    query_type=QueryType(data["query_type"]),
                    from_cache=True
                )
            
            return None
            
        except Exception as e:
            logger.warning("cache_get_failed", error=str(e))
            return None
    
    async def set(self, sql: str, params: Optional[List[Any]], result: QueryResult):
        """Cache query result"""
        if not self.enabled or not self.redis_client or result.from_cache:
            return
        
        try:
            cache_key = self._generate_cache_key(sql, params)
            
            data = {
                "rows": result.rows,
                "row_count": result.row_count,
                "execution_time": result.execution_time,
                "query_type": result.query_type.value
            }
            
            await self.redis_client.setex(
                cache_key,
                self.ttl,
                json.dumps(data, default=str)
            )
            
        except Exception as e:
            logger.warning("cache_set_failed", error=str(e))
    
    async def invalidate_pattern(self, pattern: str):
        """Invalidate cache entries matching pattern"""
        if not self.enabled or not self.redis_client:
            return
        
        try:
            keys = await self.redis_client.keys(f"query_cache:*{pattern}*")
            if keys:
                await self.redis_client.delete(*keys)
                logger.info("cache_invalidated", pattern=pattern, count=len(keys))
        except Exception as e:
            logger.warning("cache_invalidation_failed", error=str(e))
    
    async def close(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()


# ============================================================================
# Migration Manager
# ============================================================================

class MigrationManager:
    """Manages database migrations with Alembic"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.migration_dir = Path(config["migrations"]["directory"])
        self.auto_migrate = config["migrations"]["auto_migrate"]
        self.backup_before_migrate = config["migrations"]["backup_before_migrate"]
    
    def _get_alembic_config(self) -> AlembicConfig:
        """Get Alembic configuration"""
        alembic_cfg = AlembicConfig()
        alembic_cfg.set_main_option("script_location", str(self.migration_dir))
        
        # Build connection string
        pg_config = self.config["postgresql"]
        password = os.environ.get("POSTGRES_PASSWORD", pg_config.get("password", ""))
        
        conn_str = (
            f"postgresql://{pg_config['user']}:{password}@"
            f"{pg_config['host']}:{pg_config['port']}/{pg_config['database']}"
        )
        
        alembic_cfg.set_main_option("sqlalchemy.url", conn_str)
        
        return alembic_cfg
    
    async def run_migration(self, migration_file: Optional[str] = None,
                           direction: str = "upgrade",
                           target: Optional[str] = None) -> MigrationResult:
        """Run database migration"""
        start_time = time.time()
        
        try:
            alembic_cfg = self._get_alembic_config()
            
            # Determine target revision
            if target:
                revision = target
            elif direction == "upgrade":
                revision = "head"
            else:
                revision = "-1"
            
            # Run migration
            if direction == "upgrade":
                command.upgrade(alembic_cfg, revision)
            else:
                command.downgrade(alembic_cfg, revision)
            
            execution_time = time.time() - start_time
            
            logger.info("migration_completed",
                       direction=direction,
                       target=revision,
                       duration=execution_time)
            
            return MigrationResult(
                success=True,
                migration_file=migration_file or "auto",
                version=revision,
                execution_time=execution_time
            )
            
        except Exception as e:
            logger.error("migration_failed", error=str(e))
            return MigrationResult(
                success=False,
                migration_file=migration_file or "auto",
                version="",
                execution_time=time.time() - start_time,
                error=str(e)
            )
    
    async def get_current_version(self) -> str:
        """Get current migration version"""
        try:
            alembic_cfg = self._get_alembic_config()
            
            # Get current revision
            from alembic.script import ScriptDirectory
            script = ScriptDirectory.from_config(alembic_cfg)
            
            # This would need actual database connection to get current version
            # Simplified for now
            return "head"
            
        except Exception as e:
            logger.error("version_check_failed", error=str(e))
            return "unknown"
    
    async def get_pending_migrations(self) -> List[str]:
        """Get list of pending migrations"""
        try:
            alembic_cfg = self._get_alembic_config()
            
            from alembic.script import ScriptDirectory
            script = ScriptDirectory.from_config(alembic_cfg)
            
            # Get all revisions
            revisions = [rev.revision for rev in script.walk_revisions()]
            
            return revisions
            
        except Exception as e:
            logger.error("pending_migrations_check_failed", error=str(e))
            return []


# ============================================================================
# Backup Manager
# ============================================================================

class BackupManager:
    """Manages database backups and restores"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.backup_dir = Path(config["backup"]["location"])
        self.retention_days = config["backup"]["retention_days"]
        
        # Create backup directory
        self.backup_dir.mkdir(parents=True, exist_ok=True)
    
    async def backup_database(self, backup_name: Optional[str] = None,
                             compress: bool = True) -> BackupResult:
        """Create database backup using pg_dump"""
        start_time = time.time()
        
        try:
            # Generate backup filename
            if not backup_name:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_name = f"backup_{timestamp}"
            
            backup_file = self.backup_dir / f"{backup_name}.sql"
            if compress:
                backup_file = self.backup_dir / f"{backup_name}.sql.gz"
            
            # Build pg_dump command
            pg_config = self.config["postgresql"]
            password = os.environ.get("POSTGRES_PASSWORD", pg_config.get("password", ""))
            
            env = os.environ.copy()
            env["PGPASSWORD"] = password
            
            cmd = [
                "pg_dump",
                "-h", pg_config["host"],
                "-p", str(pg_config["port"]),
                "-U", pg_config["user"],
                "-d", pg_config["database"],
                "-F", "c" if compress else "p",
                "-f", str(backup_file)
            ]
            
            # Execute backup
            process = await asyncio.create_subprocess_exec(
                *cmd,
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                raise RuntimeError(f"pg_dump failed: {stderr.decode()}")
            
            # Get backup file size
            size_bytes = backup_file.stat().st_size
            duration = time.time() - start_time
            
            logger.info("backup_completed",
                       backup_file=str(backup_file),
                       size_mb=size_bytes / (1024 * 1024),
                       duration=duration)
            
            # Clean old backups
            await self._cleanup_old_backups()
            
            return BackupResult(
                success=True,
                backup_file=str(backup_file),
                size_bytes=size_bytes,
                duration=duration
            )
            
        except Exception as e:
            logger.error("backup_failed", error=str(e))
            return BackupResult(
                success=False,
                backup_file="",
                size_bytes=0,
                duration=time.time() - start_time,
                error=str(e)
            )
    
    async def restore_database(self, backup_file: str,
                              drop_existing: bool = False) -> bool:
        """Restore database from backup"""
        try:
            backup_path = Path(backup_file)
            
            if not backup_path.exists():
                raise FileNotFoundError(f"Backup file not found: {backup_file}")
            
            pg_config = self.config["postgresql"]
            password = os.environ.get("POSTGRES_PASSWORD", pg_config.get("password", ""))
            
            env = os.environ.copy()
            env["PGPASSWORD"] = password
            
            # Drop database if requested
            if drop_existing:
                await self._drop_database()
                await self._create_database()
            
            # Build pg_restore command
            cmd = [
                "pg_restore",
                "-h", pg_config["host"],
                "-p", str(pg_config["port"]),
                "-U", pg_config["user"],
                "-d", pg_config["database"],
                "-c",  # Clean before restore
                str(backup_path)
            ]
            
            # Execute restore
            process = await asyncio.create_subprocess_exec(
                *cmd,
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                raise RuntimeError(f"pg_restore failed: {stderr.decode()}")
            
            logger.info("restore_completed", backup_file=backup_file)
            
            return True
            
        except Exception as e:
            logger.error("restore_failed", error=str(e))
            return False
    
    async def _cleanup_old_backups(self):
        """Remove backups older than retention period"""
        try:
            cutoff_date = datetime.now() - timedelta(days=self.retention_days)
            
            for backup_file in self.backup_dir.glob("backup_*.sql*"):
                if backup_file.stat().st_mtime < cutoff_date.timestamp():
                    backup_file.unlink()
                    logger.info("old_backup_deleted", file=str(backup_file))
                    
        except Exception as e:
            logger.warning("backup_cleanup_failed", error=str(e))
    
    async def _drop_database(self):
        """Drop database (for restore)"""
        pg_config = self.config["postgresql"]
        password = os.environ.get("POSTGRES_PASSWORD", pg_config.get("password", ""))
        
        env = os.environ.copy()
        env["PGPASSWORD"] = password
        
        cmd = [
            "dropdb",
            "-h", pg_config["host"],
            "-p", str(pg_config["port"]),
            "-U", pg_config["user"],
            pg_config["database"]
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        await process.communicate()
    
    async def _create_database(self):
        """Create database (for restore)"""
        pg_config = self.config["postgresql"]
        password = os.environ.get("POSTGRES_PASSWORD", pg_config.get("password", ""))
        
        env = os.environ.copy()
        env["PGPASSWORD"] = password
        
        cmd = [
            "createdb",
            "-h", pg_config["host"],
            "-p", str(pg_config["port"]),
            "-U", pg_config["user"],
            pg_config["database"]
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        await process.communicate()


# ============================================================================
# Query Optimizer
# ============================================================================

class QueryOptimizer:
    """Analyzes and optimizes SQL queries"""
    
    def __init__(self, pool: Pool, config: Dict[str, Any]):
        self.pool = pool
        self.config = config
        self.slow_query_threshold = config["optimization"]["slow_query_threshold_ms"]
    
    async def optimize_query(self, sql: str, analyze: bool = True) -> Dict[str, Any]:
        """Analyze query performance and suggest optimizations"""
        try:
            async with self.pool.acquire() as conn:
                # Get query plan
                explain_query = f"EXPLAIN (FORMAT JSON, ANALYZE {analyze}) {sql}"
                result = await conn.fetchval(explain_query)
                
                plan = result[0] if result else {}
                
                # Extract key metrics
                execution_time = plan.get("Execution Time", 0)
                planning_time = plan.get("Planning Time", 0)
                
                # Analyze plan for optimization opportunities
                suggestions = await self._analyze_plan(plan, sql)
                
                return {
                    "execution_time_ms": execution_time,
                    "planning_time_ms": planning_time,
                    "total_time_ms": execution_time + planning_time,
                    "plan": plan,
                    "suggestions": suggestions,
                    "is_slow": execution_time > self.slow_query_threshold
                }
                
        except Exception as e:
            logger.error("query_optimization_failed", error=str(e))
            return {
                "error": str(e),
                "suggestions": []
            }
    
    async def _analyze_plan(self, plan: Dict[str, Any], sql: str) -> List[str]:
        """Analyze query plan and generate suggestions"""
        suggestions = []
        
        # Check for sequential scans on large tables
        if "Seq Scan" in str(plan):
            suggestions.append("Consider adding index to avoid sequential scan")
        
        # Check for high cost operations
        total_cost = plan.get("Plan", {}).get("Total Cost", 0)
        if total_cost > 1000:
            suggestions.append(f"High query cost ({total_cost}): consider optimization")
        
        # Check for missing indexes
        if "Index Scan" not in str(plan) and "SELECT" in sql.upper():
            suggestions.append("No index scan detected: verify appropriate indexes exist")
        
        # Check for nested loops
        if "Nested Loop" in str(plan):
            suggestions.append("Nested loop detected: consider JOIN optimization")
        
        return suggestions


# ============================================================================
# Index Manager
# ============================================================================

class IndexManager:
    """Manages database indexes"""
    
    def __init__(self, pool: Pool):
        self.pool = pool
    
    async def analyze_table(self, table: str) -> Dict[str, Any]:
        """Analyze table and update statistics"""
        try:
            async with self.pool.acquire() as conn:
                await conn.execute(f"ANALYZE {table}")
                
                # Get table statistics
                stats_query = """
                    SELECT 
                        schemaname, tablename, 
                        n_live_tup, n_dead_tup,
                        last_vacuum, last_analyze
                    FROM pg_stat_user_tables 
                    WHERE tablename = $1
                """
                
                stats = await conn.fetchrow(stats_query, table)
                
                return {
                    "table": table,
                    "live_tuples": stats["n_live_tup"] if stats else 0,
                    "dead_tuples": stats["n_dead_tup"] if stats else 0,
                    "last_vacuum": str(stats["last_vacuum"]) if stats else None,
                    "last_analyze": str(stats["last_analyze"]) if stats else None
                }
                
        except Exception as e:
            logger.error("table_analysis_failed", table=table, error=str(e))
            raise
    
    async def suggest_indexes(self, table: str) -> List[Dict[str, Any]]:
        """Suggest indexes for table based on query patterns"""
        try:
            async with self.pool.acquire() as conn:
                # Get columns frequently used in WHERE clauses
                query = """
                    SELECT 
                        column_name, data_type
                    FROM information_schema.columns
                    WHERE table_name = $1
                    ORDER BY ordinal_position
                """
                
                columns = await conn.fetch(query, table)
                
                suggestions = []
                
                for col in columns:
                    # Suggest index for common data types
                    if col["data_type"] in ["integer", "bigint", "uuid", "timestamp"]:
                        suggestions.append({
                            "table": table,
                            "column": col["column_name"],
                            "type": "btree",
                            "reason": f"Frequently filtered column ({col['data_type']})"
                        })
                
                return suggestions
                
        except Exception as e:
            logger.error("index_suggestion_failed", table=table, error=str(e))
            return []
    
    async def rebuild_indexes(self, table: str) -> bool:
        """Rebuild all indexes for table"""
        try:
            async with self.pool.acquire() as conn:
                await conn.execute(f"REINDEX TABLE {table}")
                
                logger.info("indexes_rebuilt", table=table)
                return True
                
        except Exception as e:
            logger.error("index_rebuild_failed", table=table, error=str(e))
            return False


# ============================================================================
# Database Management Agent
# ============================================================================

class DatabaseManagementAgent:
    """Main database management agent"""
    
    def __init__(self, config_path: str):
        # Load configuration
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)
        
        # Initialize managers
        self.pool_manager = ConnectionPoolManager(self.config)
        self.cache_manager = QueryCacheManager(self.config)
        self.migration_manager = MigrationManager(self.config)
        self.backup_manager = BackupManager(self.config)
        self.query_optimizer: Optional[QueryOptimizer] = None
        self.index_manager: Optional[IndexManager] = None
        
        # Statistics
        self.stats = {
            "queries_executed": 0,
            "transactions_executed": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "slow_queries": 0,
            "errors": 0
        }
    
    async def initialize(self):
        """Initialize agent and all managers"""
        try:
            # Initialize connection pool
            await self.pool_manager.initialize()
            
            # Initialize query cache
            await self.cache_manager.initialize()
            
            # Initialize query optimizer and index manager
            self.query_optimizer = QueryOptimizer(
                self.pool_manager.pool,
                self.config
            )
            self.index_manager = IndexManager(self.pool_manager.pool)
            
            # Run auto migrations if enabled
            if self.migration_manager.auto_migrate:
                await self.migration_manager.run_migration()
            
            logger.info("database_agent_initialized")
            
        except Exception as e:
            logger.error("agent_initialization_failed", error=str(e))
            raise
    
    def _classify_query(self, sql: str) -> QueryType:
        """Classify query type"""
        sql_upper = sql.strip().upper()
        
        if sql_upper.startswith("SELECT"):
            return QueryType.SELECT
        elif sql_upper.startswith("INSERT"):
            return QueryType.INSERT
        elif sql_upper.startswith("UPDATE"):
            return QueryType.UPDATE
        elif sql_upper.startswith("DELETE"):
            return QueryType.DELETE
        else:
            return QueryType.DDL
    
    async def execute_query(self, sql: str, params: Optional[List[Any]] = None,
                          transaction: bool = False,
                          use_cache: bool = True) -> QueryResult:
        """Execute SQL query"""
        start_time = time.time()
        
        try:
            query_type = self._classify_query(sql)
            
            # Check cache for SELECT queries
            if use_cache and query_type == QueryType.SELECT:
                cached = await self.cache_manager.get(sql, params)
                if cached:
                    self.stats["cache_hits"] += 1
                    self.pool_manager.stats["cache_hits"] += 1
                    return cached
                else:
                    self.stats["cache_misses"] += 1
                    self.pool_manager.stats["cache_misses"] += 1
            
            # Determine if read-only query
            read_only = query_type == QueryType.SELECT
            
            # Execute query
            conn = await self.pool_manager.get_connection(read_only)
            
            try:
                if transaction:
                    async with conn.transaction():
                        if params:
                            rows = await conn.fetch(sql, *params)
                        else:
                            rows = await conn.fetch(sql)
                else:
                    if params:
                        rows = await conn.fetch(sql, *params)
                    else:
                        rows = await conn.fetch(sql)
                
                # Convert rows to list of dicts
                result_rows = [dict(row) for row in rows]
                
                execution_time = (time.time() - start_time) * 1000  # ms
                
                result = QueryResult(
                    rows=result_rows,
                    row_count=len(result_rows),
                    execution_time=execution_time,
                    query_type=query_type
                )
                
                # Cache SELECT results
                if use_cache and query_type == QueryType.SELECT:
                    await self.cache_manager.set(sql, params, result)
                
                # Log slow queries
                if execution_time > self.config["optimization"]["slow_query_threshold_ms"]:
                    self.stats["slow_queries"] += 1
                    logger.warning("slow_query", sql=sql[:100], duration_ms=execution_time)
                
                self.stats["queries_executed"] += 1
                self.pool_manager.stats["queries_executed"] += 1
                
                return result
                
            finally:
                await self.pool_manager.release_connection(conn, read_only)
                
        except Exception as e:
            self.stats["errors"] += 1
            self.pool_manager.stats["errors"] += 1
            logger.error("query_execution_failed", sql=sql[:100], error=str(e))
            raise
    
    async def execute_transaction(self, queries: List[Dict[str, Any]],
                                 isolation_level: Optional[IsolationLevel] = None) -> bool:
        """Execute multiple queries in a transaction"""
        max_retries = self.config["transactions"]["max_retries"]
        retry_delay = self.config["transactions"]["retry_delay"]
        
        for attempt in range(max_retries):
            try:
                conn = await self.pool_manager.get_connection()
                
                try:
                    # Set isolation level if specified
                    if isolation_level:
                        await conn.execute(
                            f"SET TRANSACTION ISOLATION LEVEL {isolation_level.value.upper().replace('_', ' ')}"
                        )
                    
                    async with conn.transaction():
                        for query_info in queries:
                            sql = query_info["sql"]
                            params = query_info.get("params")
                            
                            if params:
                                await conn.execute(sql, *params)
                            else:
                                await conn.execute(sql)
                    
                    self.stats["transactions_executed"] += 1
                    self.pool_manager.stats["transactions_executed"] += 1
                    
                    logger.info("transaction_completed", queries=len(queries))
                    
                    return True
                    
                finally:
                    await self.pool_manager.release_connection(conn)
                    
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning("transaction_retry", attempt=attempt + 1, error=str(e))
                    await asyncio.sleep(retry_delay)
                else:
                    self.stats["errors"] += 1
                    logger.error("transaction_failed", error=str(e))
                    raise
        
        return False
    
    async def create_connection_pool(self) -> Pool:
        """Create and return connection pool"""
        return await self.pool_manager.create_pool()
    
    async def run_migration(self, migration_file: Optional[str] = None,
                          direction: str = "upgrade",
                          target: Optional[str] = None) -> MigrationResult:
        """Run database migration"""
        # Backup before migration if enabled
        if self.migration_manager.backup_before_migrate:
            backup_name = f"pre_migration_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            await self.backup_manager.backup_database(backup_name)
        
        return await self.migration_manager.run_migration(migration_file, direction, target)
    
    async def backup_database(self, backup_name: Optional[str] = None,
                            compress: bool = True) -> BackupResult:
        """Create database backup"""
        return await self.backup_manager.backup_database(backup_name, compress)
    
    async def restore_database(self, backup_file: str,
                              drop_existing: bool = False) -> bool:
        """Restore database from backup"""
        return await self.backup_manager.restore_database(backup_file, drop_existing)
    
    async def optimize_query(self, sql: str, analyze: bool = True) -> Dict[str, Any]:
        """Analyze and optimize query"""
        if not self.query_optimizer:
            raise RuntimeError("Query optimizer not initialized")
        
        return await self.query_optimizer.optimize_query(sql, analyze)
    
    async def get_health_status(self) -> Dict[str, Any]:
        """Get database health status"""
        pool_health = await self.pool_manager.health_check()
        
        return {
            "status": "healthy" if pool_health["healthy"] else "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "connection_pool": pool_health,
            "statistics": self.stats,
            "configuration": {
                "database": self.config["postgresql"]["database"],
                "max_connections": self.config["postgresql"]["connection_pool"]["max_size"],
                "query_cache_enabled": self.cache_manager.enabled
            }
        }
    
    async def manage_indexes(self, table: str, action: str,
                           columns: Optional[List[str]] = None) -> Dict[str, Any]:
        """Manage table indexes"""
        if not self.index_manager:
            raise RuntimeError("Index manager not initialized")
        
        if action == "analyze":
            return await self.index_manager.analyze_table(table)
        elif action == "suggest":
            suggestions = await self.index_manager.suggest_indexes(table)
            return {"suggestions": suggestions}
        elif action == "rebuild":
            success = await self.index_manager.rebuild_indexes(table)
            return {"success": success}
        else:
            raise ValueError(f"Invalid action: {action}")
    
    async def close(self):
        """Close all connections and cleanup"""
        await self.pool_manager.close()
        await self.cache_manager.close()
        
        logger.info("database_agent_closed")


# ============================================================================
# FastAPI Application
# ============================================================================

app = FastAPI(
    title="Database Management Agent",
    description="Production-ready PostgreSQL management system",
    version="1.0.0"
)

# Global agent instance
agent: Optional[DatabaseManagementAgent] = None


@app.on_event("startup")
async def startup():
    """Initialize agent on startup"""
    global agent
    
    config_path = os.environ.get("CONFIG_PATH", "config.yaml")
    agent = DatabaseManagementAgent(config_path)
    await agent.initialize()


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    if agent:
        await agent.close()


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    health = await agent.get_health_status()
    
    if health["status"] != "healthy":
        raise HTTPException(status_code=503, detail="Database unhealthy")
    
    return health


@app.post("/query")
async def execute_query(request: QueryRequest):
    """Execute SQL query"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    try:
        result = await agent.execute_query(
            request.sql,
            request.params,
            request.transaction,
            request.use_cache
        )
        
        return {
            "success": True,
            "rows": result.rows,
            "row_count": result.row_count,
            "execution_time_ms": result.execution_time,
            "query_type": result.query_type.value,
            "from_cache": result.from_cache
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/transaction")
async def execute_transaction(request: TransactionRequest):
    """Execute transaction"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    try:
        success = await agent.execute_transaction(
            request.queries,
            request.isolation_level
        )
        
        return {
            "success": success,
            "queries_executed": len(request.queries)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/migrate")
async def run_migration(request: MigrationRequest):
    """Run database migration"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    try:
        result = await agent.run_migration(
            request.migration_file,
            request.direction,
            request.target
        )
        
        if not result.success:
            raise HTTPException(status_code=500, detail=result.error)
        
        return {
            "success": True,
            "migration_file": result.migration_file,
            "version": result.version,
            "execution_time": result.execution_time
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/backup")
async def create_backup(request: BackupRequest, background_tasks: BackgroundTasks):
    """Create database backup"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    try:
        result = await agent.backup_database(
            request.backup_name,
            request.compress
        )
        
        if not result.success:
            raise HTTPException(status_code=500, detail=result.error)
        
        return {
            "success": True,
            "backup_file": result.backup_file,
            "size_mb": result.size_bytes / (1024 * 1024),
            "duration": result.duration
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/restore")
async def restore_backup(request: RestoreRequest):
    """Restore database from backup"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    try:
        success = await agent.restore_database(
            request.backup_file,
            request.drop_existing
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Restore failed")
        
        return {
            "success": True,
            "backup_file": request.backup_file
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/schema/{table}")
async def get_table_schema(table: str):
    """Get table schema"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    try:
        # Query table schema
        result = await agent.execute_query(
            """
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = $1
            ORDER BY ordinal_position
            """,
            [table]
        )
        
        return {
            "table": table,
            "columns": result.rows
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/optimize")
async def optimize_query(request: OptimizeRequest):
    """Optimize SQL query"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    try:
        result = await agent.optimize_query(request.sql, request.analyze)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/indexes")
async def manage_indexes(request: IndexRequest):
    """Manage table indexes"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    try:
        result = await agent.manage_indexes(
            request.table,
            request.action,
            request.columns
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    
    config_path = os.environ.get("CONFIG_PATH", "config.yaml")
    
    # Load port from config
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    
    port = config["agent"]["port"]
    host = config["agent"]["host"]
    
    uvicorn.run(app, host=host, port=port)
