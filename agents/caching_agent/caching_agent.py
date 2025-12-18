"""
Caching Agent - High-Performance Multi-Tier Caching System

Features:
- Multi-tier caching (L1: memory, L2: Redis)
- Multiple cache strategies (write-through, write-back, write-around)
- LRU eviction policy
- TTL-based and event-based invalidation
- Dependency tracking
- Compression support (gzip)
- Batch operations
- Cache warming
- Real-time monitoring
"""

import asyncio
import gzip
import hashlib
import json
import pickle
import time
from collections import OrderedDict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, Any, List, Optional, Callable, Set, Tuple
import yaml
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
import redis.asyncio as aioredis
import structlog

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ]
)
logger = structlog.get_logger()

app = FastAPI(title="Caching Agent", version="1.0.0")


# ============================================================================
# Enums
# ============================================================================

class CacheStrategy(str, Enum):
    """Cache write strategies"""
    WRITE_THROUGH = "write_through"
    WRITE_BACK = "write_back"
    WRITE_AROUND = "write_around"


class CacheTier(str, Enum):
    """Cache tier levels"""
    L1 = "l1"
    L2 = "l2"


class InvalidationMethod(str, Enum):
    """Cache invalidation methods"""
    TTL = "ttl"
    EVENT_BASED = "event_based"
    DEPENDENCY_TRACKING = "dependency_tracking"


class EventTrigger(str, Enum):
    """Event triggers for cache invalidation"""
    USER_PROFILE_UPDATE = "user_profile_update"
    CONTENT_MODIFICATION = "content_modification"
    MASTERY_UPDATE = "mastery_update"


# ============================================================================
# Data Models
# ============================================================================

@dataclass
class CacheEntry:
    """Cache entry with metadata"""
    key: str
    value: Any
    ttl: int
    created_at: float
    expires_at: float
    compressed: bool = False
    access_count: int = 0
    last_accessed: float = field(default_factory=time.time)
    dependencies: Set[str] = field(default_factory=set)
    tags: Set[str] = field(default_factory=set)


@dataclass
class CacheStats:
    """Cache statistics"""
    hits: int = 0
    misses: int = 0
    sets: int = 0
    deletes: int = 0
    invalidations: int = 0
    total_latency: float = 0.0
    l1_size: int = 0
    l2_size: int = 0
    
    @property
    def hit_rate(self) -> float:
        """Calculate hit rate"""
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0
    
    @property
    def avg_latency(self) -> float:
        """Calculate average latency"""
        total = self.hits + self.misses
        return self.total_latency / total if total > 0 else 0.0


@dataclass
class WriteBatchBuffer:
    """Buffer for write-back strategy"""
    items: Dict[str, Tuple[Any, int]] = field(default_factory=dict)
    last_flush: float = field(default_factory=time.time)
    max_size: int = 100
    flush_interval: float = 5.0


# ============================================================================
# Pydantic Models
# ============================================================================

class CacheGetRequest(BaseModel):
    """Cache get request"""
    key: str = Field(..., min_length=1)


class CacheSetRequest(BaseModel):
    """Cache set request"""
    key: str = Field(..., min_length=1)
    value: Any
    ttl: Optional[int] = Field(None, ge=1)
    strategy: Optional[str] = None
    compress: Optional[bool] = None
    tags: List[str] = Field(default_factory=list)
    dependencies: List[str] = Field(default_factory=list)


class BatchGetRequest(BaseModel):
    """Batch get request"""
    keys: List[str] = Field(..., min_items=1)


class BatchSetRequest(BaseModel):
    """Batch set request"""
    items: Dict[str, Any]
    ttl: Optional[int] = Field(None, ge=1)
    strategy: Optional[str] = None


class InvalidateRequest(BaseModel):
    """Invalidation request"""
    pattern: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    event: Optional[str] = None


class WarmUpRequest(BaseModel):
    """Cache warm-up request"""
    keys: List[str] = Field(..., min_items=1)
    compute_data: Dict[str, Any] = Field(default_factory=dict)


# ============================================================================
# L1 Cache (Memory)
# ============================================================================

class L1Cache:
    """In-memory LRU cache"""
    
    def __init__(self, max_size_mb: int = 100, ttl: int = 60):
        self.max_size_mb = max_size_mb
        self.default_ttl = ttl
        self.cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self.current_size_bytes = 0
        self.max_size_bytes = max_size_mb * 1024 * 1024
        logger.info("l1_cache_initialized", max_size_mb=max_size_mb)
    
    def _estimate_size(self, value: Any) -> int:
        """Estimate size of value in bytes"""
        try:
            return len(pickle.dumps(value))
        except Exception:
            return len(str(value).encode())
    
    def _evict_lru(self) -> None:
        """Evict least recently used items"""
        while self.current_size_bytes > self.max_size_bytes and self.cache:
            key, entry = self.cache.popitem(last=False)
            self.current_size_bytes -= self._estimate_size(entry.value)
            logger.debug("l1_evicted", key=key)
    
    def _is_expired(self, entry: CacheEntry) -> bool:
        """Check if entry is expired"""
        return time.time() > entry.expires_at
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from L1 cache"""
        if key in self.cache:
            entry = self.cache[key]
            
            # Check expiration
            if self._is_expired(entry):
                del self.cache[key]
                self.current_size_bytes -= self._estimate_size(entry.value)
                logger.debug("l1_expired", key=key)
                return None
            
            # Update access metadata
            entry.access_count += 1
            entry.last_accessed = time.time()
            
            # Move to end (most recently used)
            self.cache.move_to_end(key)
            
            logger.debug("l1_hit", key=key, access_count=entry.access_count)
            return entry.value
        
        logger.debug("l1_miss", key=key)
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None, 
            compressed: bool = False, dependencies: Optional[Set[str]] = None,
            tags: Optional[Set[str]] = None) -> bool:
        """Set value in L1 cache"""
        try:
            if ttl is None:
                ttl = self.default_ttl
            
            # Create entry
            entry = CacheEntry(
                key=key,
                value=value,
                ttl=ttl,
                created_at=time.time(),
                expires_at=time.time() + ttl,
                compressed=compressed,
                dependencies=dependencies or set(),
                tags=tags or set()
            )
            
            # Calculate size
            size = self._estimate_size(value)
            
            # Remove old entry if exists
            if key in self.cache:
                old_entry = self.cache[key]
                self.current_size_bytes -= self._estimate_size(old_entry.value)
            
            # Add new entry
            self.cache[key] = entry
            self.current_size_bytes += size
            
            # Evict if needed
            self._evict_lru()
            
            logger.debug("l1_set", key=key, size=size, ttl=ttl)
            return True
        
        except Exception as e:
            logger.error("l1_set_error", key=key, error=str(e))
            return False
    
    def delete(self, key: str) -> bool:
        """Delete value from L1 cache"""
        if key in self.cache:
            entry = self.cache[key]
            self.current_size_bytes -= self._estimate_size(entry.value)
            del self.cache[key]
            logger.debug("l1_deleted", key=key)
            return True
        return False
    
    def clear(self) -> None:
        """Clear all cache"""
        self.cache.clear()
        self.current_size_bytes = 0
        logger.info("l1_cleared")
    
    def get_size(self) -> int:
        """Get number of entries"""
        return len(self.cache)
    
    def get_keys_by_pattern(self, pattern: str) -> List[str]:
        """Get keys matching pattern"""
        import fnmatch
        return [key for key in self.cache.keys() if fnmatch.fnmatch(key, pattern)]
    
    def get_keys_by_tag(self, tag: str) -> List[str]:
        """Get keys with specific tag"""
        return [key for key, entry in self.cache.items() if tag in entry.tags]
    
    def get_dependent_keys(self, dependency: str) -> List[str]:
        """Get keys dependent on a specific key"""
        return [key for key, entry in self.cache.items() if dependency in entry.dependencies]


# ============================================================================
# L2 Cache (Redis)
# ============================================================================

class L2Cache:
    """Redis-based cache"""
    
    def __init__(self, redis_client: aioredis.Redis, ttl: int = 3600):
        self.redis = redis_client
        self.default_ttl = ttl
        logger.info("l2_cache_initialized", ttl=ttl)
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from L2 cache"""
        try:
            value = await self.redis.get(key)
            if value:
                logger.debug("l2_hit", key=key)
                return pickle.loads(value)
            logger.debug("l2_miss", key=key)
            return None
        except Exception as e:
            logger.error("l2_get_error", key=key, error=str(e))
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in L2 cache"""
        try:
            if ttl is None:
                ttl = self.default_ttl
            
            serialized = pickle.dumps(value)
            await self.redis.setex(key, ttl, serialized)
            logger.debug("l2_set", key=key, ttl=ttl)
            return True
        
        except Exception as e:
            logger.error("l2_set_error", key=key, error=str(e))
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete value from L2 cache"""
        try:
            result = await self.redis.delete(key)
            logger.debug("l2_deleted", key=key, success=result > 0)
            return result > 0
        except Exception as e:
            logger.error("l2_delete_error", key=key, error=str(e))
            return False
    
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        try:
            return await self.redis.exists(key) > 0
        except Exception:
            return False
    
    async def get_keys_by_pattern(self, pattern: str) -> List[str]:
        """Get keys matching pattern"""
        try:
            keys = await self.redis.keys(pattern)
            return [k.decode() if isinstance(k, bytes) else k for k in keys]
        except Exception as e:
            logger.error("l2_pattern_error", pattern=pattern, error=str(e))
            return []
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete keys matching pattern"""
        try:
            keys = await self.get_keys_by_pattern(pattern)
            if keys:
                return await self.redis.delete(*keys)
            return 0
        except Exception as e:
            logger.error("l2_delete_pattern_error", pattern=pattern, error=str(e))
            return 0
    
    async def get_size(self) -> int:
        """Get number of keys in database"""
        try:
            return await self.redis.dbsize()
        except Exception:
            return 0


# ============================================================================
# Compression Manager
# ============================================================================

class CompressionManager:
    """Handles data compression"""
    
    def __init__(self, enable: bool = True, algorithm: str = "gzip", 
                 threshold_bytes: int = 1024):
        self.enable = enable
        self.algorithm = algorithm
        self.threshold_bytes = threshold_bytes
        logger.info("compression_manager_initialized", enable=enable)
    
    def should_compress(self, data: bytes) -> bool:
        """Check if data should be compressed"""
        return self.enable and len(data) >= self.threshold_bytes
    
    def compress(self, data: Any) -> Tuple[bytes, bool]:
        """Compress data if needed"""
        # Serialize
        serialized = pickle.dumps(data)
        
        # Check if should compress
        if self.should_compress(serialized):
            compressed = gzip.compress(serialized)
            logger.debug("data_compressed", 
                        original=len(serialized), 
                        compressed=len(compressed),
                        ratio=len(compressed)/len(serialized))
            return compressed, True
        
        return serialized, False
    
    def decompress(self, data: bytes, compressed: bool) -> Any:
        """Decompress and deserialize data"""
        if compressed:
            data = gzip.decompress(data)
        return pickle.loads(data)


# ============================================================================
# Invalidation Manager
# ============================================================================

class InvalidationManager:
    """Manages cache invalidation"""
    
    def __init__(self):
        self.event_subscriptions: Dict[EventTrigger, Set[str]] = {}
        self.dependency_graph: Dict[str, Set[str]] = {}
        logger.info("invalidation_manager_initialized")
    
    def register_event_subscription(self, event: EventTrigger, key: str) -> None:
        """Register key to be invalidated on event"""
        if event not in self.event_subscriptions:
            self.event_subscriptions[event] = set()
        self.event_subscriptions[event].add(key)
        logger.debug("event_subscription_registered", event=event.value, key=key)
    
    def register_dependency(self, key: str, depends_on: str) -> None:
        """Register that key depends on another key"""
        if depends_on not in self.dependency_graph:
            self.dependency_graph[depends_on] = set()
        self.dependency_graph[depends_on].add(key)
        logger.debug("dependency_registered", key=key, depends_on=depends_on)
    
    def get_keys_to_invalidate(self, event: Optional[EventTrigger] = None,
                               dependency: Optional[str] = None) -> Set[str]:
        """Get keys that should be invalidated"""
        keys = set()
        
        # Event-based invalidation
        if event and event in self.event_subscriptions:
            keys.update(self.event_subscriptions[event])
        
        # Dependency-based invalidation
        if dependency and dependency in self.dependency_graph:
            keys.update(self.dependency_graph[dependency])
            # Recursively get dependent keys
            for dep_key in list(self.dependency_graph[dependency]):
                keys.update(self.get_keys_to_invalidate(dependency=dep_key))
        
        return keys
    
    def clear_subscriptions(self, key: str) -> None:
        """Clear all subscriptions for a key"""
        for event_keys in self.event_subscriptions.values():
            event_keys.discard(key)
        
        # Remove from dependency graph
        for dep_keys in self.dependency_graph.values():
            dep_keys.discard(key)


# ============================================================================
# Caching Agent
# ============================================================================

class CachingAgent:
    """Main caching agent with multi-tier support"""
    
    def __init__(self, config_path: str = "config.yaml"):
        self.config = self._load_config(config_path)
        
        # Initialize components
        self.l1_cache = L1Cache(
            max_size_mb=self.config["l1"]["max_size_mb"],
            ttl=self.config["l1"]["ttl"]
        )
        
        # Redis client (initialized in startup)
        self.redis_client: Optional[aioredis.Redis] = None
        self.l2_cache: Optional[L2Cache] = None
        
        self.compression_manager = CompressionManager(
            enable=self.config["compression"]["enable"],
            algorithm=self.config["compression"]["algorithm"],
            threshold_bytes=self.config["compression"]["threshold_bytes"]
        )
        
        self.invalidation_manager = InvalidationManager()
        
        # Write-back buffer
        self.write_buffer = WriteBatchBuffer(
            max_size=self.config["write_back"]["batch_size"],
            flush_interval=self.config["write_back"]["flush_interval"]
        )
        
        # Statistics
        self.stats = CacheStats()
        
        # Background tasks
        self.background_tasks: Set[asyncio.Task] = set()
        
        logger.info("caching_agent_initialized")
    
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration"""
        try:
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            
            # Extract relevant sections
            return {
                "redis": config["redis"],
                "l1": config["cache_tiers"]["l1"],
                "l2": config["cache_tiers"]["l2"],
                "default_strategy": CacheStrategy(config["strategies"]["default"]),
                "write_back": config["strategies"]["write_back"],
                "cache_policies": config["cache_policies"],
                "compression": config["compression"],
                "monitoring": config["monitoring"]
            }
        except Exception as e:
            logger.error("config_load_failed", error=str(e))
            raise ValueError(f"Failed to load config: {str(e)}")
    
    async def initialize_redis(self) -> None:
        """Initialize Redis connection"""
        try:
            self.redis_client = await aioredis.from_url(
                f"redis://{self.config['redis']['host']}:{self.config['redis']['port']}/{self.config['redis']['db']}",
                password=self.config['redis'].get('password'),
                max_connections=self.config['redis']['max_connections'],
                socket_timeout=self.config['redis']['socket_timeout'],
                decode_responses=False
            )
            
            self.l2_cache = L2Cache(
                redis_client=self.redis_client,
                ttl=self.config["l2"]["ttl"]
            )
            
            logger.info("redis_initialized")
        except Exception as e:
            logger.error("redis_init_failed", error=str(e))
            raise
    
    def _generate_cache_key(self, key: str) -> str:
        """Generate cache key with namespace"""
        return f"cache:{hashlib.md5(key.encode()).hexdigest()[:16]}:{key}"
    
    def _get_policy(self, key: str) -> Dict[str, Any]:
        """Get cache policy for key"""
        # Check if key matches any policy pattern
        for policy_name, policy_config in self.config["cache_policies"].items():
            if policy_name in key or key.startswith(policy_name):
                return policy_config
        
        # Return default policy
        return {
            "ttl": 3600,
            "strategy": self.config["default_strategy"].value,
            "compress": False
        }
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        start_time = time.time()
        cache_key = self._generate_cache_key(key)
        
        try:
            # Try L1 cache
            value = self.l1_cache.get(cache_key)
            if value is not None:
                self.stats.hits += 1
                latency = time.time() - start_time
                self.stats.total_latency += latency
                logger.info("cache_hit", key=key, tier="l1", latency=latency)
                return value
            
            # Try L2 cache
            if self.l2_cache:
                value = await self.l2_cache.get(cache_key)
                if value is not None:
                    # Promote to L1
                    policy = self._get_policy(key)
                    self.l1_cache.set(cache_key, value, ttl=policy["ttl"])
                    
                    self.stats.hits += 1
                    latency = time.time() - start_time
                    self.stats.total_latency += latency
                    logger.info("cache_hit", key=key, tier="l2", latency=latency)
                    return value
            
            # Cache miss
            self.stats.misses += 1
            latency = time.time() - start_time
            self.stats.total_latency += latency
            logger.info("cache_miss", key=key, latency=latency)
            return None
        
        except Exception as e:
            logger.error("cache_get_error", key=key, error=str(e))
            self.stats.misses += 1
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None,
                  strategy: Optional[CacheStrategy] = None,
                  compress: Optional[bool] = None,
                  tags: Optional[List[str]] = None,
                  dependencies: Optional[List[str]] = None) -> bool:
        """Set value in cache"""
        cache_key = self._generate_cache_key(key)
        
        try:
            # Get policy
            policy = self._get_policy(key)
            if ttl is None:
                ttl = policy["ttl"]
            if strategy is None:
                strategy = CacheStrategy(policy["strategy"])
            if compress is None:
                compress = policy["compress"]
            
            # Handle compression
            if compress:
                compressed_value, is_compressed = self.compression_manager.compress(value)
                cache_value = compressed_value
            else:
                cache_value = value
                is_compressed = False
            
            # Register dependencies
            if dependencies:
                for dep in dependencies:
                    self.invalidation_manager.register_dependency(cache_key, dep)
            
            # Write strategy
            if strategy == CacheStrategy.WRITE_THROUGH:
                # Write to both caches synchronously
                self.l1_cache.set(cache_key, cache_value, ttl, is_compressed,
                                 set(dependencies) if dependencies else None,
                                 set(tags) if tags else None)
                if self.l2_cache:
                    await self.l2_cache.set(cache_key, cache_value, ttl)
            
            elif strategy == CacheStrategy.WRITE_BACK:
                # Write to L1, buffer L2 write
                self.l1_cache.set(cache_key, cache_value, ttl, is_compressed,
                                 set(dependencies) if dependencies else None,
                                 set(tags) if tags else None)
                self.write_buffer.items[cache_key] = (cache_value, ttl)
                
                # Flush if buffer full
                if len(self.write_buffer.items) >= self.write_buffer.max_size:
                    await self._flush_write_buffer()
            
            elif strategy == CacheStrategy.WRITE_AROUND:
                # Write only to L2
                if self.l2_cache:
                    await self.l2_cache.set(cache_key, cache_value, ttl)
            
            self.stats.sets += 1
            logger.info("cache_set", key=key, strategy=strategy.value, ttl=ttl)
            return True
        
        except Exception as e:
            logger.error("cache_set_error", key=key, error=str(e))
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete value from cache"""
        cache_key = self._generate_cache_key(key)
        
        try:
            # Delete from both tiers
            l1_deleted = self.l1_cache.delete(cache_key)
            l2_deleted = False
            if self.l2_cache:
                l2_deleted = await self.l2_cache.delete(cache_key)
            
            # Clear invalidation subscriptions
            self.invalidation_manager.clear_subscriptions(cache_key)
            
            # Remove from write buffer
            self.write_buffer.items.pop(cache_key, None)
            
            self.stats.deletes += 1
            logger.info("cache_deleted", key=key, l1=l1_deleted, l2=l2_deleted)
            return l1_deleted or l2_deleted
        
        except Exception as e:
            logger.error("cache_delete_error", key=key, error=str(e))
            return False
    
    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate keys matching pattern"""
        try:
            count = 0
            
            # Invalidate L1
            l1_keys = self.l1_cache.get_keys_by_pattern(pattern)
            for key in l1_keys:
                self.l1_cache.delete(key)
                count += 1
            
            # Invalidate L2
            if self.l2_cache:
                l2_count = await self.l2_cache.delete_pattern(pattern)
                count += l2_count
            
            self.stats.invalidations += count
            logger.info("pattern_invalidated", pattern=pattern, count=count)
            return count
        
        except Exception as e:
            logger.error("invalidate_pattern_error", pattern=pattern, error=str(e))
            return 0
    
    async def invalidate_by_tags(self, tags: List[str]) -> int:
        """Invalidate keys with specific tags"""
        try:
            count = 0
            keys_to_delete = set()
            
            for tag in tags:
                keys = self.l1_cache.get_keys_by_tag(tag)
                keys_to_delete.update(keys)
            
            for key in keys_to_delete:
                await self.delete(key)
                count += 1
            
            self.stats.invalidations += count
            logger.info("tags_invalidated", tags=tags, count=count)
            return count
        
        except Exception as e:
            logger.error("invalidate_tags_error", tags=tags, error=str(e))
            return 0
    
    async def invalidate_by_event(self, event: EventTrigger) -> int:
        """Invalidate keys based on event trigger"""
        try:
            keys = self.invalidation_manager.get_keys_to_invalidate(event=event)
            count = 0
            
            for key in keys:
                await self.delete(key)
                count += 1
            
            self.stats.invalidations += count
            logger.info("event_invalidated", event=event.value, count=count)
            return count
        
        except Exception as e:
            logger.error("invalidate_event_error", event=event.value, error=str(e))
            return 0
    
    async def get_or_compute(self, key: str, compute_fn: Callable[[], Any],
                            ttl: Optional[int] = None) -> Any:
        """Get from cache or compute and cache"""
        # Try to get from cache
        value = await self.get(key)
        if value is not None:
            return value
        
        # Compute value
        try:
            value = compute_fn()
            if asyncio.iscoroutine(value):
                value = await value
            
            # Cache the computed value
            await self.set(key, value, ttl)
            return value
        
        except Exception as e:
            logger.error("compute_error", key=key, error=str(e))
            raise
    
    async def batch_get(self, keys: List[str]) -> Dict[str, Any]:
        """Get multiple keys"""
        results = {}
        for key in keys:
            value = await self.get(key)
            if value is not None:
                results[key] = value
        return results
    
    async def batch_set(self, items: Dict[str, Any], ttl: Optional[int] = None,
                       strategy: Optional[CacheStrategy] = None) -> bool:
        """Set multiple keys"""
        try:
            for key, value in items.items():
                await self.set(key, value, ttl, strategy)
            return True
        except Exception as e:
            logger.error("batch_set_error", error=str(e))
            return False
    
    async def warm_cache(self, keys: List[str], compute_fn: Callable[[str], Any]) -> None:
        """Warm up cache with computed values"""
        logger.info("cache_warmup_started", keys_count=len(keys))
        
        for key in keys:
            try:
                value = compute_fn(key)
                if asyncio.iscoroutine(value):
                    value = await value
                
                await self.set(key, value)
            except Exception as e:
                logger.error("warmup_error", key=key, error=str(e))
        
        logger.info("cache_warmup_completed", keys_count=len(keys))
    
    async def _flush_write_buffer(self) -> None:
        """Flush write-back buffer to L2"""
        if not self.l2_cache or not self.write_buffer.items:
            return
        
        try:
            items = list(self.write_buffer.items.items())
            for cache_key, (value, ttl) in items:
                await self.l2_cache.set(cache_key, value, ttl)
            
            self.write_buffer.items.clear()
            self.write_buffer.last_flush = time.time()
            logger.info("write_buffer_flushed", items_count=len(items))
        
        except Exception as e:
            logger.error("flush_buffer_error", error=str(e))
    
    async def _periodic_flush(self) -> None:
        """Periodically flush write buffer"""
        while True:
            try:
                await asyncio.sleep(self.write_buffer.flush_interval)
                
                if time.time() - self.write_buffer.last_flush >= self.write_buffer.flush_interval:
                    await self._flush_write_buffer()
            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("periodic_flush_error", error=str(e))
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        self.stats.l1_size = self.l1_cache.get_size()
        
        return {
            "hits": self.stats.hits,
            "misses": self.stats.misses,
            "hit_rate": self.stats.hit_rate,
            "sets": self.stats.sets,
            "deletes": self.stats.deletes,
            "invalidations": self.stats.invalidations,
            "avg_latency_ms": self.stats.avg_latency * 1000,
            "l1_size": self.stats.l1_size,
            "l2_size": self.stats.l2_size,
            "write_buffer_size": len(self.write_buffer.items)
        }
    
    async def start_background_tasks(self) -> None:
        """Start background tasks"""
        # Periodic flush task
        flush_task = asyncio.create_task(self._periodic_flush())
        self.background_tasks.add(flush_task)
        flush_task.add_done_callback(self.background_tasks.discard)
        
        logger.info("background_tasks_started")
    
    async def stop_background_tasks(self) -> None:
        """Stop background tasks"""
        for task in self.background_tasks:
            task.cancel()
        
        await asyncio.gather(*self.background_tasks, return_exceptions=True)
        self.background_tasks.clear()
        
        logger.info("background_tasks_stopped")
    
    async def close(self) -> None:
        """Close connections"""
        await self.stop_background_tasks()
        
        # Flush remaining writes
        await self._flush_write_buffer()
        
        if self.redis_client:
            await self.redis_client.close()
        
        logger.info("caching_agent_closed")


# ============================================================================
# Global Agent Instance
# ============================================================================

agent: Optional[CachingAgent] = None


# ============================================================================
# API Endpoints
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize agent on startup"""
    global agent
    try:
        config_path = os.getenv("CONFIG_PATH", "config.yaml")
        agent = CachingAgent(config_path)
        await agent.initialize_redis()
        await agent.start_background_tasks()
        logger.info("agent_started", port=8014)
    except Exception as e:
        logger.error("startup_failed", error=str(e))
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    global agent
    if agent:
        await agent.close()
        logger.info("agent_stopped")


@app.get("/health")
async def health_check():
    """Health check"""
    return {
        "status": "healthy",
        "agent": "caching_agent",
        "timestamp": time.time()
    }


@app.get("/cache/{key}")
async def get_cache(key: str):
    """Get cached value"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    value = await agent.get(key)
    if value is None:
        raise HTTPException(status_code=404, detail="Key not found")
    
    return {"key": key, "value": value}


@app.post("/cache")
async def set_cache(request: CacheSetRequest):
    """Set cache value"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    strategy = CacheStrategy(request.strategy) if request.strategy else None
    
    success = await agent.set(
        key=request.key,
        value=request.value,
        ttl=request.ttl,
        strategy=strategy,
        compress=request.compress,
        tags=request.tags,
        dependencies=request.dependencies
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to set cache")
    
    return {"success": True, "key": request.key}


@app.delete("/cache/{key}")
async def delete_cache(key: str):
    """Delete cached value"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    success = await agent.delete(key)
    
    return {"success": success, "key": key}


@app.post("/cache/batch-get")
async def batch_get_cache(request: BatchGetRequest):
    """Batch get cached values"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    results = await agent.batch_get(request.keys)
    
    return {"results": results, "count": len(results)}


@app.post("/cache/batch-set")
async def batch_set_cache(request: BatchSetRequest):
    """Batch set cache values"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    strategy = CacheStrategy(request.strategy) if request.strategy else None
    
    success = await agent.batch_set(request.items, request.ttl, strategy)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to batch set")
    
    return {"success": True, "count": len(request.items)}


@app.post("/invalidate")
async def invalidate_cache(request: InvalidateRequest):
    """Invalidate cache by pattern, tags, or event"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    count = 0
    
    if request.pattern:
        count += await agent.invalidate_pattern(request.pattern)
    
    if request.tags:
        count += await agent.invalidate_by_tags(request.tags)
    
    if request.event:
        event = EventTrigger(request.event)
        count += await agent.invalidate_by_event(event)
    
    return {"invalidated_count": count}


@app.get("/stats")
async def get_stats():
    """Get cache statistics"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    # Update L2 size
    if agent.l2_cache:
        agent.stats.l2_size = await agent.l2_cache.get_size()
    
    stats = agent.get_stats()
    
    # Check hit rate alert
    if agent.config["monitoring"]["track_hit_rate"]:
        alert_threshold = agent.config["monitoring"]["alert_on_low_hit_rate"]
        if stats["hit_rate"] < alert_threshold:
            logger.warning("low_hit_rate_alert", 
                          hit_rate=stats["hit_rate"],
                          threshold=alert_threshold)
    
    return stats


@app.post("/warm-up")
async def warm_up_cache(request: WarmUpRequest, background_tasks: BackgroundTasks):
    """Warm up cache"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    # Define compute function
    def compute_fn(key: str) -> Any:
        return request.compute_data.get(key, f"computed_value_for_{key}")
    
    # Run warmup in background
    background_tasks.add_task(agent.warm_cache, request.keys, compute_fn)
    
    return {"status": "warming", "keys_count": len(request.keys)}


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    import os
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8014,
        log_level="info"
    )
