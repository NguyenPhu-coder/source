"""
Orchestration Agent - Main coordinator for Learn Your Way Platform
Handles request routing, task distribution, monitoring, and result aggregation
"""

import asyncio
import time
import uuid
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
from concurrent.futures import Future

import httpx
import pika
import structlog
import yaml
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Gauge, Histogram, generate_latest
from pydantic import BaseModel, Field, validator
from pydantic_settings import BaseSettings
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

# Prometheus metrics - with duplicate handling
from prometheus_client import REGISTRY

def get_or_create_counter(name, documentation, labelnames):
    try:
        return Counter(name, documentation, labelnames)
    except ValueError:
        return REGISTRY._names_to_collectors[name]

def get_or_create_histogram(name, documentation, labelnames):
    try:
        return Histogram(name, documentation, labelnames)
    except ValueError:
        return REGISTRY._names_to_collectors[name]

def get_or_create_gauge(name, documentation, labelnames=None):
    try:
        return Gauge(name, documentation, labelnames or [])
    except ValueError:
        return REGISTRY._names_to_collectors[name]

REQUEST_COUNT = get_or_create_counter(
    "orchestrator_requests_total", "Total requests", ["method", "endpoint", "status"]
)
REQUEST_DURATION = get_or_create_histogram(
    "orchestrator_request_duration_seconds", "Request duration", ["endpoint"]
)
ACTIVE_TASKS = get_or_create_gauge("orchestrator_active_tasks", "Number of active tasks")
AGENT_HEALTH = get_or_create_gauge("orchestrator_agent_health", "Agent health status", ["agent"])
QUEUE_SIZE = get_or_create_gauge("orchestrator_queue_size", "Priority queue size", ["priority"])
CIRCUIT_BREAKER_STATE = get_or_create_gauge(
    "orchestrator_circuit_breaker_state", "Circuit breaker state", ["agent"]
)


class TaskStatus(str, Enum):
    """Task execution status"""

    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


class CircuitBreakerState(str, Enum):
    """Circuit breaker states"""

    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class LoadBalancingStrategy(str, Enum):
    """Load balancing strategies"""

    ROUND_ROBIN = "round_robin"
    LEAST_CONNECTIONS = "least_connections"
    WEIGHTED = "weighted"


class TaskRequest(BaseModel):
    """Task request model"""

    pattern: str = Field(..., description="Task pattern to match routing rule")
    payload: Dict[str, Any] = Field(..., description="Task payload data")
    priority: Optional[int] = Field(1, ge=1, le=5, description="Task priority (1-5)")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    timeout: Optional[int] = Field(None, description="Custom timeout in seconds")
    callback_url: Optional[str] = Field(None, description="Callback URL for async tasks")

    @validator("pattern")
    def validate_pattern(cls, v):
        if not v or not v.strip():
            raise ValueError("Pattern cannot be empty")
        return v.strip()


# Alias for compatibility
OrchestrationRequest = TaskRequest


class TaskResponse(BaseModel):
    """Task response model"""

    task_id: str
    status: TaskStatus
    agent: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    execution_time: Optional[float] = None


class HealthResponse(BaseModel):
    """Health check response"""

    status: str
    timestamp: datetime
    version: str
    agents_healthy: int
    agents_total: int
    active_tasks: int
    queue_size: int


class MetricsResponse(BaseModel):
    """Metrics response"""

    total_requests: int
    active_tasks: int
    agents_status: Dict[str, str]
    queue_sizes: Dict[str, int]


class RoutingRule(BaseModel):
    """Routing rule configuration"""

    pattern: str
    target_agent: str
    endpoint: str
    timeout: int = 60
    priority: int = 3


class Config(BaseSettings):
    """Application configuration"""

    config_path: str = "config.yaml"

    class Config:
        env_prefix = "ORCHESTRATOR_"


class CircuitBreaker:
    """Circuit breaker implementation for fault tolerance"""

    def __init__(self, threshold: int, timeout: int):
        self.threshold = threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.state = CircuitBreakerState.CLOSED
        self.logger = structlog.get_logger()

    def record_success(self):
        """Record successful call"""
        if self.state == CircuitBreakerState.HALF_OPEN:
            self.state = CircuitBreakerState.CLOSED
            self.failure_count = 0
            self.logger.info("circuit_breaker_closed")

    def record_failure(self):
        """Record failed call"""
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.failure_count >= self.threshold:
            self.state = CircuitBreakerState.OPEN
            self.logger.warning(
                "circuit_breaker_opened", failure_count=self.failure_count
            )

    def can_execute(self) -> bool:
        """Check if execution is allowed"""
        if self.state == CircuitBreakerState.CLOSED:
            return True

        if self.state == CircuitBreakerState.OPEN:
            if (
                self.last_failure_time
                and time.time() - self.last_failure_time >= self.timeout
            ):
                self.state = CircuitBreakerState.HALF_OPEN
                self.logger.info("circuit_breaker_half_open")
                return True
            return False

        return True  # HALF_OPEN

    def get_state_value(self) -> int:
        """Get numeric state value for metrics"""
        return {
            CircuitBreakerState.CLOSED: 0,
            CircuitBreakerState.HALF_OPEN: 1,
            CircuitBreakerState.OPEN: 2,
        }[self.state]


class PriorityQueue:
    """Priority queue for task management"""

    def __init__(self, max_size: int = 10000):
        self.max_size = max_size
        self.queues: Dict[int, deque] = defaultdict(deque)
        self.task_lookup: Dict[str, int] = {}
        self.lock = asyncio.Lock()

    async def enqueue(self, task_id: str, priority: int, task_data: Dict[str, Any]):
        """Add task to priority queue"""
        async with self.lock:
            total_size = sum(len(q) for q in self.queues.values())
            if total_size >= self.max_size:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Queue is full",
                )

            self.queues[priority].append({"task_id": task_id, "data": task_data})
            self.task_lookup[task_id] = priority
            QUEUE_SIZE.labels(priority=priority).set(len(self.queues[priority]))

    async def dequeue(self) -> Optional[Dict[str, Any]]:
        """Get highest priority task"""
        async with self.lock:
            for priority in sorted(self.queues.keys(), reverse=True):
                if self.queues[priority]:
                    task = self.queues[priority].popleft()
                    if task["task_id"] in self.task_lookup:
                        del self.task_lookup[task["task_id"]]
                    QUEUE_SIZE.labels(priority=priority).set(len(self.queues[priority]))
                    return task
            return None

    async def remove(self, task_id: str) -> bool:
        """Remove task from queue"""
        async with self.lock:
            if task_id not in self.task_lookup:
                return False

            priority = self.task_lookup[task_id]
            queue = self.queues[priority]
            original_len = len(queue)

            self.queues[priority] = deque(
                item for item in queue if item["task_id"] != task_id
            )

            if len(self.queues[priority]) < original_len:
                del self.task_lookup[task_id]
                QUEUE_SIZE.labels(priority=priority).set(len(self.queues[priority]))
                return True

            return False

    def get_size(self) -> int:
        """Get total queue size"""
        return sum(len(q) for q in self.queues.values())


class RateLimiter:
    """Token bucket rate limiter"""

    def __init__(self, rate: int, burst_size: int):
        self.rate = rate  # tokens per minute
        self.burst_size = burst_size
        self.tokens = burst_size
        self.last_update = time.time()
        self.lock = asyncio.Lock()

    async def acquire(self) -> bool:
        """Try to acquire a token"""
        async with self.lock:
            now = time.time()
            elapsed = now - self.last_update

            # Replenish tokens
            self.tokens = min(
                self.burst_size, self.tokens + (elapsed * self.rate / 60.0)
            )
            self.last_update = now

            if self.tokens >= 1:
                self.tokens -= 1
                return True

            return False


class MessageQueueClient:
    """Message queue client for RabbitMQ"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.connection: Optional[pika.BlockingConnection] = None
        self.channel: Optional[pika.channel.Channel] = None
        self.logger = structlog.get_logger()

    def connect(self):
        """Establish connection to message queue"""
        try:
            credentials = pika.PlainCredentials(
                self.config.get("username", "guest"),
                self.config.get("password", "guest"),
            )
            parameters = pika.ConnectionParameters(
                host=self.config.get("host", "localhost"),
                port=self.config.get("port", 5672),
                credentials=credentials,
            )
            self.connection = pika.BlockingConnection(parameters)
            self.channel = self.connection.channel()

            # Declare exchange
            self.channel.exchange_declare(
                exchange=self.config.get("exchange", "learn_your_way"),
                exchange_type="topic",
                durable=self.config.get("durable", True),
            )

            self.logger.info("message_queue_connected")
        except Exception as e:
            self.logger.error("message_queue_connection_failed", error=str(e))
            raise

    def publish(self, routing_key: str, message: Dict[str, Any]):
        """Publish message to queue"""
        if not self.channel:
            self.connect()

        try:
            self.channel.basic_publish(
                exchange=self.config.get("exchange", "learn_your_way"),
                routing_key=routing_key,
                body=str(message).encode(),
                properties=pika.BasicProperties(
                    delivery_mode=2 if self.config.get("durable", True) else 1
                ),
            )
        except Exception as e:
            self.logger.error("message_publish_failed", error=str(e))
            self.connect()  # Reconnect on failure
            raise

    def close(self):
        """Close connection"""
        if self.connection and not self.connection.is_closed:
            self.connection.close()
            self.logger.info("message_queue_disconnected")


class OrchestrationAgent:
    """Main orchestration agent"""

    def __init__(self, config_path: str = "config.yaml"):
        self.config = self._load_config(config_path)
        self.routing_rules: Dict[str, RoutingRule] = {}
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        self.rate_limiters: Dict[str, RateLimiter] = {}
        self.tasks: Dict[str, Dict[str, Any]] = {}
        self.priority_queue = PriorityQueue(
            max_size=self.config["priority_queue"]["max_queue_size"]
        )
        self.agent_connections: Dict[str, int] = defaultdict(int)
        self.agent_round_robin: Dict[str, int] = defaultdict(int)
        self.message_queue: Optional[MessageQueueClient] = None
        self.http_client: Optional[httpx.AsyncClient] = None
        self.background_tasks: Set[asyncio.Task] = set()
        self.logger = structlog.get_logger()

        self._initialize()

    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from YAML file"""
        try:
            path = Path(config_path)
            if not path.exists():
                path = Path(__file__).parent / config_path

            with open(path, "r") as f:
                config = yaml.safe_load(f)

            logger.info("config_loaded", path=str(path))
            return config
        except Exception as e:
            logger.error("config_load_failed", error=str(e))
            raise

    def _initialize(self):
        """Initialize agent components"""
        # Load routing rules
        for rule_config in self.config["routing_rules"]:
            rule = RoutingRule(**rule_config)
            self.routing_rules[rule.pattern] = rule

        # Initialize circuit breakers
        cb_config = self.config["error_recovery"]
        for rule in self.routing_rules.values():
            self.circuit_breakers[rule.target_agent] = CircuitBreaker(
                threshold=cb_config["circuit_breaker_threshold"],
                timeout=cb_config["circuit_breaker_timeout"],
            )

        # Initialize rate limiters
        if self.config["rate_limiting"]["enabled"]:
            default_rate = self.config["rate_limiting"]["default_rate"]
            burst_size = self.config["rate_limiting"]["burst_size"]

            for rule in self.routing_rules.values():
                agent_rate = self.config["rate_limiting"]["per_agent_limits"].get(
                    rule.target_agent, default_rate
                )
                self.rate_limiters[rule.target_agent] = RateLimiter(
                    rate=agent_rate, burst_size=burst_size
                )

        # Initialize message queue
        if self.config["message_queue"]["type"] == "rabbitmq":
            self.message_queue = MessageQueueClient(self.config["message_queue"])

        self.logger.info(
            "orchestrator_initialized", routing_rules=len(self.routing_rules)
        )

    async def startup(self):
        """Startup procedures"""
        # Initialize HTTP client
        self.http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(
                self.config["timeouts"]["default_task_timeout"], connect=5.0
            ),
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
        )

        # Connect message queue
        if self.message_queue:
            try:
                self.message_queue.connect()
            except Exception as e:
                self.logger.warning("message_queue_startup_failed", error=str(e))

        # Start background tasks
        health_check_task = asyncio.create_task(self._health_check_loop())
        self.background_tasks.add(health_check_task)
        health_check_task.add_done_callback(self.background_tasks.discard)

        queue_processor_task = asyncio.create_task(self._process_queue())
        self.background_tasks.add(queue_processor_task)
        queue_processor_task.add_done_callback(self.background_tasks.discard)

        self.logger.info("orchestrator_started")

    async def shutdown(self):
        """Shutdown procedures"""
        # Cancel background tasks
        for task in self.background_tasks:
            task.cancel()

        await asyncio.gather(*self.background_tasks, return_exceptions=True)

        # Close HTTP client
        if self.http_client:
            await self.http_client.aclose()

        # Close message queue
        if self.message_queue:
            self.message_queue.close()

        self.logger.info("orchestrator_stopped")

    def route_request(self, request: TaskRequest) -> str:
        """Analyze and route request to appropriate agent"""
        pattern = request.pattern

        if pattern not in self.routing_rules:
            available_patterns = list(self.routing_rules.keys())
            self.logger.error(
                "pattern_not_found",
                pattern=pattern,
                available_patterns=available_patterns,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown pattern '{pattern}'. Available patterns: {available_patterns}",
            )

        rule = self.routing_rules[pattern]
        agent = rule.target_agent

        # Check circuit breaker
        if not self.circuit_breakers[agent].can_execute():
            self.logger.warning("circuit_breaker_open", agent=agent)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Agent '{agent}' is currently unavailable",
            )

        self.logger.info("request_routed", pattern=pattern, agent=agent)
        return agent

    async def distribute_task(
        self, task: TaskRequest, agent: str
    ) -> Dict[str, Any]:
        """Send task to agent and return future"""
        rule = self.routing_rules[task.pattern]

        # Check rate limit
        if agent in self.rate_limiters:
            if not await self.rate_limiters[agent].acquire():
                self.logger.warning("rate_limit_exceeded", agent=agent)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded for agent '{agent}'",
                )

        # Create task record
        task_id = str(uuid.uuid4())
        task_data = {
            "task_id": task_id,
            "agent": agent,
            "pattern": task.pattern,
            "payload": task.payload,
            "priority": task.priority or rule.priority,
            "status": TaskStatus.PENDING,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "endpoint": rule.endpoint,
            "timeout": task.timeout or rule.timeout,
            "callback_url": task.callback_url,
            "metadata": task.metadata,
            "retry_count": 0,
        }

        self.tasks[task_id] = task_data
        ACTIVE_TASKS.inc()

        # Add to priority queue
        await self.priority_queue.enqueue(
            task_id, task_data["priority"], task_data
        )

        self.logger.info(
            "task_distributed",
            task_id=task_id,
            agent=agent,
            priority=task_data["priority"],
        )

        return {"task_id": task_id, "status": TaskStatus.QUEUED}

    async def _process_queue(self):
        """Background task to process priority queue"""
        while True:
            try:
                task_item = await self.priority_queue.dequeue()

                if task_item:
                    task_id = task_item["task_id"]
                    task_data = task_item["data"]

                    # Execute task
                    asyncio.create_task(self._execute_task(task_id, task_data))

                else:
                    # No tasks, sleep briefly
                    await asyncio.sleep(0.1)

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error("queue_processing_error", error=str(e))
                await asyncio.sleep(1)

    async def _execute_task(self, task_id: str, task_data: Dict[str, Any]):
        """Execute individual task"""
        start_time = time.time()
        agent = task_data["agent"]

        try:
            # Update status
            task_data["status"] = TaskStatus.RUNNING
            task_data["updated_at"] = datetime.utcnow()

            # Execute with retry logic
            result = await self._execute_with_retry(task_data)

            # Update success
            task_data["status"] = TaskStatus.COMPLETED
            task_data["result"] = result
            task_data["execution_time"] = time.time() - start_time
            task_data["updated_at"] = datetime.utcnow()

            # Record success for circuit breaker
            self.circuit_breakers[agent].record_success()

            # Publish to message queue
            if self.message_queue:
                try:
                    self.message_queue.publish(
                        f"task.completed.{agent}",
                        {
                            "task_id": task_id,
                            "status": TaskStatus.COMPLETED,
                            "result": result,
                        },
                    )
                except Exception as e:
                    self.logger.warning("message_publish_failed", error=str(e))

            # Call callback if provided
            if task_data.get("callback_url"):
                asyncio.create_task(self._send_callback(task_data))

            self.logger.info(
                "task_completed",
                task_id=task_id,
                agent=agent,
                execution_time=task_data["execution_time"],
            )

        except Exception as e:
            # Update failure
            task_data["status"] = TaskStatus.FAILED
            task_data["error"] = str(e)
            task_data["execution_time"] = time.time() - start_time
            task_data["updated_at"] = datetime.utcnow()

            # Record failure for circuit breaker
            self.circuit_breakers[agent].record_failure()

            self.logger.error(
                "task_failed",
                task_id=task_id,
                agent=agent,
                error=str(e),
            )

        finally:
            ACTIVE_TASKS.dec()

            # Update agent connections
            if agent in self.agent_connections:
                self.agent_connections[agent] -= 1

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError)),
    )
    async def _execute_with_retry(self, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute task with retry logic"""
        endpoint = task_data["endpoint"]
        timeout = task_data["timeout"]
        payload = task_data["payload"]
        agent = task_data["agent"]

        task_data["retry_count"] += 1

        # Update connection count
        self.agent_connections[agent] += 1

        try:
            response = await self.http_client.post(
                endpoint,
                json=payload,
                timeout=timeout,
            )
            response.raise_for_status()
            return response.json()

        except httpx.TimeoutException as e:
            self.logger.warning(
                "task_timeout",
                task_id=task_data["task_id"],
                endpoint=endpoint,
                retry=task_data["retry_count"],
            )
            raise

        except httpx.HTTPStatusError as e:
            self.logger.error(
                "task_http_error",
                task_id=task_data["task_id"],
                status_code=e.response.status_code,
                error=str(e),
            )
            raise

        except Exception as e:
            self.logger.error(
                "task_execution_error",
                task_id=task_data["task_id"],
                error=str(e),
            )
            raise

    async def _send_callback(self, task_data: Dict[str, Any]):
        """Send callback notification"""
        try:
            callback_url = task_data["callback_url"]
            callback_payload = {
                "task_id": task_data["task_id"],
                "status": task_data["status"],
                "result": task_data.get("result"),
                "error": task_data.get("error"),
            }

            await self.http_client.post(
                callback_url,
                json=callback_payload,
                timeout=10,
            )

            self.logger.info("callback_sent", task_id=task_data["task_id"])

        except Exception as e:
            self.logger.error(
                "callback_failed",
                task_id=task_data["task_id"],
                error=str(e),
            )

    async def monitor_execution(self, task_id: str) -> Dict[str, Any]:
        """Track task progress"""
        if task_id not in self.tasks:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task '{task_id}' not found",
            )

        task_data = self.tasks[task_id]

        return {
            "task_id": task_id,
            "status": task_data["status"],
            "agent": task_data["agent"],
            "created_at": task_data["created_at"],
            "updated_at": task_data["updated_at"],
            "execution_time": task_data.get("execution_time"),
            "retry_count": task_data.get("retry_count", 0),
            "result": task_data.get("result"),
            "error": task_data.get("error"),
        }

    async def aggregate_results(self, task_ids: List[str]) -> Dict[str, Any]:
        """Combine multi-agent results"""
        results = []
        errors = []
        completed_count = 0
        failed_count = 0

        for task_id in task_ids:
            if task_id not in self.tasks:
                errors.append({"task_id": task_id, "error": "Task not found"})
                continue

            task_data = self.tasks[task_id]

            if task_data["status"] == TaskStatus.COMPLETED:
                completed_count += 1
                results.append(
                    {
                        "task_id": task_id,
                        "agent": task_data["agent"],
                        "result": task_data.get("result"),
                        "execution_time": task_data.get("execution_time"),
                    }
                )
            elif task_data["status"] == TaskStatus.FAILED:
                failed_count += 1
                errors.append(
                    {
                        "task_id": task_id,
                        "agent": task_data["agent"],
                        "error": task_data.get("error"),
                    }
                )

        return {
            "total_tasks": len(task_ids),
            "completed": completed_count,
            "failed": failed_count,
            "results": results,
            "errors": errors,
        }

    async def handle_failure(
        self, task_id: str, error: Exception
    ) -> Dict[str, Any]:
        """Error recovery for failed tasks"""
        if task_id not in self.tasks:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task '{task_id}' not found",
            )

        task_data = self.tasks[task_id]
        agent = task_data["agent"]
        max_retries = self.config["error_recovery"]["max_retries"]

        self.logger.warning(
            "handling_task_failure",
            task_id=task_id,
            agent=agent,
            error=str(error),
            retry_count=task_data.get("retry_count", 0),
        )

        # Check if we should retry
        if task_data.get("retry_count", 0) < max_retries:
            # Re-queue task
            task_data["status"] = TaskStatus.PENDING
            task_data["updated_at"] = datetime.utcnow()
            await self.priority_queue.enqueue(
                task_id, task_data["priority"], task_data
            )

            return {
                "task_id": task_id,
                "status": "retrying",
                "retry_count": task_data["retry_count"],
                "max_retries": max_retries,
            }

        else:
            # Max retries reached, send to dead letter queue
            if (
                self.config["error_recovery"]["dead_letter_queue_enabled"]
                and self.message_queue
            ):
                try:
                    self.message_queue.publish(
                        "task.dead_letter",
                        {
                            "task_id": task_id,
                            "agent": agent,
                            "error": str(error),
                            "task_data": task_data,
                        },
                    )
                except Exception as e:
                    self.logger.error("dead_letter_publish_failed", error=str(e))

            return {
                "task_id": task_id,
                "status": "failed_permanently",
                "error": str(error),
                "retry_count": task_data["retry_count"],
            }

    async def _health_check_loop(self):
        """Periodic health check for agents"""
        interval = self.config["load_balancing"]["health_check_interval"]

        while True:
            try:
                await asyncio.sleep(interval)

                for agent, rule in self.routing_rules.items():
                    try:
                        # Simple health check
                        endpoint = rule.endpoint.rsplit("/", 1)[0] + "/health"
                        response = await self.http_client.get(
                            endpoint,
                            timeout=self.config["timeouts"]["health_check_timeout"],
                        )

                        if response.status_code == 200:
                            AGENT_HEALTH.labels(agent=rule.target_agent).set(1)
                        else:
                            AGENT_HEALTH.labels(agent=rule.target_agent).set(0)

                    except Exception as e:
                        AGENT_HEALTH.labels(agent=rule.target_agent).set(0)
                        self.logger.warning(
                            "agent_health_check_failed",
                            agent=rule.target_agent,
                            error=str(e),
                        )

                    # Update circuit breaker metrics
                    cb_state = self.circuit_breakers[rule.target_agent].get_state_value()
                    CIRCUIT_BREAKER_STATE.labels(agent=rule.target_agent).set(cb_state)

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error("health_check_loop_error", error=str(e))

    def get_health_status(self) -> HealthResponse:
        """Get overall health status"""
        agents_total = len(self.routing_rules)
        agents_healthy = sum(
            1
            for agent in self.routing_rules.values()
            if self.circuit_breakers[agent.target_agent].state
            == CircuitBreakerState.CLOSED
        )

        return HealthResponse(
            status="healthy" if agents_healthy > 0 else "degraded",
            timestamp=datetime.utcnow(),
            version=self.config["agent"]["version"],
            agents_healthy=agents_healthy,
            agents_total=agents_total,
            active_tasks=len([t for t in self.tasks.values() if t["status"] == TaskStatus.RUNNING]),
            queue_size=self.priority_queue.get_size(),
        )

    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics"""
        agents_status = {}
        for agent, cb in self.circuit_breakers.items():
            agents_status[agent] = cb.state.value

        queue_sizes = {}
        for priority, queue in self.priority_queue.queues.items():
            queue_sizes[f"priority_{priority}"] = len(queue)

        return {
            "total_tasks": len(self.tasks),
            "active_tasks": len([t for t in self.tasks.values() if t["status"] == TaskStatus.RUNNING]),
            "completed_tasks": len([t for t in self.tasks.values() if t["status"] == TaskStatus.COMPLETED]),
            "failed_tasks": len([t for t in self.tasks.values() if t["status"] == TaskStatus.FAILED]),
            "agents_status": agents_status,
            "queue_sizes": queue_sizes,
        }


# Global agent instance
orchestrator: Optional[OrchestrationAgent] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global orchestrator

    # Startup
    config_path = Config().config_path
    orchestrator = OrchestrationAgent(config_path)
    await orchestrator.startup()

    yield

    # Shutdown
    if orchestrator:
        await orchestrator.shutdown()


# FastAPI application
app = FastAPI(
    title="Orchestration Agent",
    description="Main coordinator for Learn Your Way Platform",
    version="1.0.0",
    lifespan=lifespan,
)


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    """Collect request metrics"""
    start_time = time.time()

    response = await call_next(request)

    duration = time.time() - start_time
    REQUEST_DURATION.labels(endpoint=request.url.path).observe(duration)
    REQUEST_COUNT.labels(
        method=request.method, endpoint=request.url.path, status=response.status_code
    ).inc()

    return response


@app.post("/orchestrate", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED)
async def orchestrate_task(task_request: TaskRequest):
    """
    Main orchestration endpoint
    Routes and distributes tasks to appropriate agents
    """
    try:
        # Route request
        agent = orchestrator.route_request(task_request)

        # Distribute task
        result = await orchestrator.distribute_task(task_request, agent)

        # Get task details
        task_data = orchestrator.tasks[result["task_id"]]

        return TaskResponse(
            task_id=result["task_id"],
            status=TaskStatus(result["status"]),
            agent=agent,
            created_at=task_data["created_at"],
            updated_at=task_data["updated_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        orchestrator.logger.error("orchestration_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Orchestration failed: {str(e)}",
        )


@app.get("/status/{task_id}", response_model=TaskResponse)
async def get_task_status(task_id: str):
    """Get task execution status"""
    try:
        task_info = await orchestrator.monitor_execution(task_id)

        return TaskResponse(
            task_id=task_info["task_id"],
            status=TaskStatus(task_info["status"]),
            agent=task_info["agent"],
            result=task_info.get("result"),
            error=task_info.get("error"),
            created_at=task_info["created_at"],
            updated_at=task_info["updated_at"],
            execution_time=task_info.get("execution_time"),
        )

    except HTTPException:
        raise
    except Exception as e:
        orchestrator.logger.error("status_check_error", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Status check failed: {str(e)}",
        )


@app.post("/aggregate", response_model=Dict[str, Any])
async def aggregate_tasks(task_ids: List[str]):
    """Aggregate results from multiple tasks"""
    try:
        results = await orchestrator.aggregate_results(task_ids)
        return results

    except Exception as e:
        orchestrator.logger.error("aggregation_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Aggregation failed: {str(e)}",
        )


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return orchestrator.get_health_status()


@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    metrics_data = orchestrator.get_metrics()
    prometheus_metrics = generate_latest()
    
    return JSONResponse(
        content=metrics_data,
        headers={"X-Prometheus-Metrics": prometheus_metrics.decode()},
    )


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Orchestration Agent",
        "version": orchestrator.config["agent"]["version"],
        "status": "running",
    }


if __name__ == "__main__":
    import uvicorn

    config = Config()
    agent_config = OrchestrationAgent(config.config_path).config["agent"]

    uvicorn.run(
        "orchestration_agent:app",
        host=agent_config["host"],
        port=agent_config["port"],
        reload=False,
        log_level="info",
    )
