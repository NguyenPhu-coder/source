"""
Infrastructure Agent - Production-ready infrastructure management system

Provides Docker/K8s management, monitoring, auto-scaling, deployment orchestration,
database backup/restore, and health monitoring capabilities.

Architecture:
- Docker container management with Docker SDK
- Kubernetes orchestration (optional)
- Prometheus metrics collection
- Auto-scaling based on metrics
- Blue/green and rolling deployments
- Database backup/restore
- Multi-channel alerting
"""

import asyncio
import docker
import json
import logging
import os
import subprocess
import time
import yaml
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
from enum import Enum

import structlog
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
import httpx

# Optional Kubernetes support
try:
    from kubernetes import client, config as k8s_config
    K8S_AVAILABLE = True
except ImportError:
    K8S_AVAILABLE = False

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ]
)
logger = structlog.get_logger()


class DeploymentStrategy(str, Enum):
    """Deployment strategies"""
    ROLLING = "rolling"
    BLUE_GREEN = "blue_green"
    CANARY = "canary"


class AlertChannel(str, Enum):
    """Alert notification channels"""
    SLACK = "slack"
    EMAIL = "email"
    PAGERDUTY = "pagerduty"


# Pydantic models
class MetricsResponse(BaseModel):
    """System metrics response"""
    timestamp: str
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    network_io: Dict[str, float]
    request_rate: float
    error_rate: float
    latency_p99: float


class HealthResponse(BaseModel):
    """Health check response"""
    service: str
    healthy: bool
    status_code: Optional[int] = None
    response_time_ms: Optional[float] = None
    message: Optional[str] = None


class ScaleRequest(BaseModel):
    """Scale service request"""
    service: str
    replicas: int = Field(ge=0, le=100)


class DeployRequest(BaseModel):
    """Deploy service request"""
    service: str
    version: str
    strategy: DeploymentStrategy = DeploymentStrategy.ROLLING
    image: Optional[str] = None


class RollbackRequest(BaseModel):
    """Rollback deployment request"""
    service: str
    version: str


class BackupRequest(BaseModel):
    """Database backup request"""
    database: str  # postgresql, neo4j, redis
    output_path: Optional[str] = None


class RestoreRequest(BaseModel):
    """Database restore request"""
    database: str
    backup_file: str


class LogsResponse(BaseModel):
    """Service logs response"""
    service: str
    lines: List[str]
    timestamp: str


class DockerManager:
    """Docker container management"""
    
    def __init__(self, config: dict):
        self.config = config
        self.docker_socket = config.get("docker", {}).get("socket", "/var/run/docker.sock")
        self.compose_file = config.get("docker", {}).get("compose_file", "docker-compose.yml")
        self.registry = config.get("docker", {}).get("registry", "docker.io")
        
        try:
            self.client = docker.DockerClient(base_url=f"unix://{self.docker_socket}")
            logger.info("docker_client_initialized", socket=self.docker_socket)
        except Exception as e:
            logger.error("docker_client_init_failed", error=str(e))
            self.client = None
    
    def list_containers(self) -> List[dict]:
        """List all containers"""
        if not self.client:
            return []
        
        try:
            containers = self.client.containers.list(all=True)
            return [
                {
                    "id": c.id[:12],
                    "name": c.name,
                    "image": c.image.tags[0] if c.image.tags else "unknown",
                    "status": c.status,
                    "created": c.attrs["Created"]
                }
                for c in containers
            ]
        except Exception as e:
            logger.error("list_containers_failed", error=str(e))
            return []
    
    def get_container(self, service: str) -> Optional[Any]:
        """Get container by service name"""
        if not self.client:
            return None
        
        try:
            return self.client.containers.get(service)
        except docker.errors.NotFound:
            logger.warning("container_not_found", service=service)
            return None
        except Exception as e:
            logger.error("get_container_failed", service=service, error=str(e))
            return None
    
    def scale_service(self, service: str, replicas: int) -> bool:
        """Scale service to specified replicas"""
        try:
            # Use docker-compose for scaling
            result = subprocess.run(
                ["docker-compose", "-f", self.compose_file, "up", "-d", "--scale", f"{service}={replicas}"],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            success = result.returncode == 0
            if success:
                logger.info("service_scaled", service=service, replicas=replicas)
            else:
                logger.error("scale_failed", service=service, error=result.stderr)
            
            return success
        except Exception as e:
            logger.error("scale_service_failed", service=service, error=str(e))
            return False
    
    def deploy_container(self, service: str, image: str, version: str) -> bool:
        """Deploy container with specified image and version"""
        if not self.client:
            return False
        
        try:
            full_image = f"{self.registry}/{image}:{version}"
            
            # Pull image
            logger.info("pulling_image", image=full_image)
            self.client.images.pull(full_image)
            
            # Stop existing container
            container = self.get_container(service)
            if container:
                container.stop()
                container.remove()
            
            # Start new container
            self.client.containers.run(
                full_image,
                name=service,
                detach=True,
                restart_policy={"Name": "always"}
            )
            
            logger.info("container_deployed", service=service, image=full_image)
            return True
        except Exception as e:
            logger.error("deploy_container_failed", service=service, error=str(e))
            return False
    
    def get_container_stats(self, service: str) -> Dict[str, Any]:
        """Get container resource stats"""
        container = self.get_container(service)
        if not container:
            return {}
        
        try:
            stats = container.stats(stream=False)
            
            # Calculate CPU usage
            cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] - \
                       stats["precpu_stats"]["cpu_usage"]["total_usage"]
            system_delta = stats["cpu_stats"]["system_cpu_usage"] - \
                          stats["precpu_stats"]["system_cpu_usage"]
            cpu_percent = (cpu_delta / system_delta) * 100.0 if system_delta > 0 else 0.0
            
            # Calculate memory usage
            memory_usage = stats["memory_stats"].get("usage", 0)
            memory_limit = stats["memory_stats"].get("limit", 1)
            memory_percent = (memory_usage / memory_limit) * 100.0
            
            return {
                "cpu_percent": cpu_percent,
                "memory_percent": memory_percent,
                "memory_usage_mb": memory_usage / (1024 * 1024),
                "network_rx_bytes": stats["networks"]["eth0"]["rx_bytes"] if "networks" in stats else 0,
                "network_tx_bytes": stats["networks"]["eth0"]["tx_bytes"] if "networks" in stats else 0
            }
        except Exception as e:
            logger.error("get_stats_failed", service=service, error=str(e))
            return {}
    
    def get_container_logs(self, service: str, lines: int = 100) -> List[str]:
        """Get container logs"""
        container = self.get_container(service)
        if not container:
            return []
        
        try:
            logs = container.logs(tail=lines, timestamps=True).decode("utf-8")
            return logs.split("\n")
        except Exception as e:
            logger.error("get_logs_failed", service=service, error=str(e))
            return []


class KubernetesManager:
    """Kubernetes orchestration"""
    
    def __init__(self, config: dict):
        self.config = config
        self.enabled = config.get("kubernetes", {}).get("enable", False)
        self.namespace = config.get("kubernetes", {}).get("namespace", "learn-your-way")
        
        if self.enabled and K8S_AVAILABLE:
            try:
                kubeconfig = config.get("kubernetes", {}).get("kubeconfig", "~/.kube/config")
                k8s_config.load_kube_config(config_file=os.path.expanduser(kubeconfig))
                self.apps_v1 = client.AppsV1Api()
                self.core_v1 = client.CoreV1Api()
                logger.info("kubernetes_client_initialized", namespace=self.namespace)
            except Exception as e:
                logger.error("kubernetes_init_failed", error=str(e))
                self.enabled = False
    
    def scale_deployment(self, deployment: str, replicas: int) -> bool:
        """Scale Kubernetes deployment"""
        if not self.enabled:
            return False
        
        try:
            body = {"spec": {"replicas": replicas}}
            self.apps_v1.patch_namespaced_deployment_scale(
                name=deployment,
                namespace=self.namespace,
                body=body
            )
            logger.info("k8s_deployment_scaled", deployment=deployment, replicas=replicas)
            return True
        except Exception as e:
            logger.error("k8s_scale_failed", deployment=deployment, error=str(e))
            return False
    
    def get_deployment_status(self, deployment: str) -> Dict[str, Any]:
        """Get deployment status"""
        if not self.enabled:
            return {}
        
        try:
            dep = self.apps_v1.read_namespaced_deployment(
                name=deployment,
                namespace=self.namespace
            )
            return {
                "replicas": dep.spec.replicas,
                "ready_replicas": dep.status.ready_replicas or 0,
                "available_replicas": dep.status.available_replicas or 0,
                "updated_replicas": dep.status.updated_replicas or 0
            }
        except Exception as e:
            logger.error("get_deployment_status_failed", deployment=deployment, error=str(e))
            return {}


class PrometheusMonitor:
    """Prometheus metrics collection"""
    
    def __init__(self, config: dict):
        self.config = config
        self.prometheus_url = config.get("monitoring", {}).get("prometheus", {}).get("url", "http://prometheus:9090")
        self.scrape_interval = config.get("monitoring", {}).get("prometheus", {}).get("scrape_interval", 15)
        self.metrics = config.get("monitoring", {}).get("metrics", [])
    
    async def query_metric(self, metric: str) -> Optional[float]:
        """Query Prometheus metric"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.prometheus_url}/api/v1/query",
                    params={"query": metric}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == "success" and data.get("data", {}).get("result"):
                        return float(data["data"]["result"][0]["value"][1])
                
                return None
        except Exception as e:
            logger.error("prometheus_query_failed", metric=metric, error=str(e))
            return None
    
    async def collect_metrics(self) -> Dict[str, Any]:
        """Collect all configured metrics"""
        metrics_data = {}
        
        # Query each metric
        for metric_name in self.metrics:
            value = await self.query_metric(metric_name)
            if value is not None:
                metrics_data[metric_name] = value
        
        # Add system metrics if not from Prometheus
        if "cpu_usage" not in metrics_data:
            metrics_data["cpu_usage"] = await self._get_cpu_usage()
        
        if "memory_usage" not in metrics_data:
            metrics_data["memory_usage"] = await self._get_memory_usage()
        
        if "disk_usage" not in metrics_data:
            metrics_data["disk_usage"] = await self._get_disk_usage()
        
        if "network_io" not in metrics_data:
            metrics_data["network_io"] = await self._get_network_io()
        
        return metrics_data
    
    async def _get_cpu_usage(self) -> float:
        """Get CPU usage percentage"""
        try:
            result = subprocess.run(
                ["ps", "aux"],
                capture_output=True,
                text=True,
                timeout=5
            )
            # Simple CPU calculation from ps output
            lines = result.stdout.split("\n")[1:]
            total_cpu = sum(float(line.split()[2]) for line in lines if line.strip())
            return min(total_cpu, 100.0)
        except Exception:
            return 0.0
    
    async def _get_memory_usage(self) -> float:
        """Get memory usage percentage"""
        try:
            result = subprocess.run(
                ["free", "-m"],
                capture_output=True,
                text=True,
                timeout=5
            )
            lines = result.stdout.split("\n")
            mem_line = [l for l in lines if l.startswith("Mem:")][0]
            parts = mem_line.split()
            total = float(parts[1])
            used = float(parts[2])
            return (used / total) * 100.0 if total > 0 else 0.0
        except Exception:
            return 0.0
    
    async def _get_disk_usage(self) -> float:
        """Get disk usage percentage"""
        try:
            result = subprocess.run(
                ["df", "-h", "/"],
                capture_output=True,
                text=True,
                timeout=5
            )
            lines = result.stdout.split("\n")
            disk_line = lines[1]
            parts = disk_line.split()
            usage_str = parts[4].replace("%", "")
            return float(usage_str)
        except Exception:
            return 0.0
    
    async def _get_network_io(self) -> Dict[str, float]:
        """Get network I/O stats"""
        try:
            result = subprocess.run(
                ["cat", "/proc/net/dev"],
                capture_output=True,
                text=True,
                timeout=5
            )
            lines = result.stdout.split("\n")[2:]  # Skip header lines
            
            total_rx = 0
            total_tx = 0
            
            for line in lines:
                if line.strip():
                    parts = line.split()
                    if len(parts) >= 10:
                        total_rx += int(parts[1])
                        total_tx += int(parts[9])
            
            return {
                "rx_bytes": total_rx,
                "tx_bytes": total_tx,
                "rx_mb": total_rx / (1024 * 1024),
                "tx_mb": total_tx / (1024 * 1024)
            }
        except Exception:
            return {"rx_bytes": 0, "tx_bytes": 0, "rx_mb": 0, "tx_mb": 0}


class AlertManager:
    """Alert notification system"""
    
    def __init__(self, config: dict):
        self.config = config
        self.channels = config.get("alerting", {}).get("channels", {})
        self.rules = config.get("alerting", {}).get("rules", [])
        self.alert_history = []
    
    async def send_alert(self, alert: dict, channel: str) -> bool:
        """Send alert to specified channel"""
        if channel == AlertChannel.SLACK:
            return await self._send_slack_alert(alert)
        elif channel == AlertChannel.EMAIL:
            return await self._send_email_alert(alert)
        elif channel == AlertChannel.PAGERDUTY:
            return await self._send_pagerduty_alert(alert)
        else:
            logger.warning("unknown_alert_channel", channel=channel)
            return False
    
    async def _send_slack_alert(self, alert: dict) -> bool:
        """Send Slack notification"""
        webhook = self.channels.get("slack", {}).get("webhook", "")
        if not webhook:
            return False
        
        # Expand environment variable
        webhook = os.path.expandvars(webhook)
        
        try:
            severity_emoji = {
                "critical": "🚨",
                "warning": "⚠️",
                "info": "ℹ️"
            }
            
            emoji = severity_emoji.get(alert.get("severity", "info"), "📊")
            
            message = {
                "text": f"{emoji} Infrastructure Alert",
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": f"{emoji} {alert.get('title', 'Alert')}"
                        }
                    },
                    {
                        "type": "section",
                        "fields": [
                            {
                                "type": "mrkdwn",
                                "text": f"*Service:*\n{alert.get('service', 'N/A')}"
                            },
                            {
                                "type": "mrkdwn",
                                "text": f"*Metric:*\n{alert.get('metric', 'N/A')}"
                            },
                            {
                                "type": "mrkdwn",
                                "text": f"*Value:*\n{alert.get('value', 'N/A')}"
                            },
                            {
                                "type": "mrkdwn",
                                "text": f"*Threshold:*\n{alert.get('threshold', 'N/A')}"
                            }
                        ]
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"*Message:*\n{alert.get('message', '')}"
                        }
                    }
                ]
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(webhook, json=message)
                
                success = response.status_code == 200
                if success:
                    logger.info("slack_alert_sent", alert_title=alert.get("title"))
                else:
                    logger.error("slack_alert_failed", status=response.status_code)
                
                return success
        except Exception as e:
            logger.error("send_slack_alert_failed", error=str(e))
            return False
    
    async def _send_email_alert(self, alert: dict) -> bool:
        """Send email notification"""
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        recipients = self.channels.get("email", {}).get("recipients", [])
        if not recipients:
            return False
        
        try:
            smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
            smtp_port = int(os.getenv("SMTP_PORT", "587"))
            smtp_user = os.getenv("SMTP_USER", "")
            smtp_password = os.getenv("SMTP_PASSWORD", "")
            
            if not smtp_user or not smtp_password:
                logger.warning("smtp_credentials_missing")
                return False
            
            msg = MIMEMultipart()
            msg["From"] = smtp_user
            msg["To"] = ", ".join(recipients)
            msg["Subject"] = f"Infrastructure Alert: {alert.get('title', 'Alert')}"
            
            body = f"""
Infrastructure Alert

Service: {alert.get('service', 'N/A')}
Metric: {alert.get('metric', 'N/A')}
Value: {alert.get('value', 'N/A')}
Threshold: {alert.get('threshold', 'N/A')}
Severity: {alert.get('severity', 'info')}

Message: {alert.get('message', '')}

Timestamp: {alert.get('timestamp', datetime.utcnow().isoformat())}
"""
            
            msg.attach(MIMEText(body, "plain"))
            
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.send_message(msg)
            
            logger.info("email_alert_sent", recipients=recipients)
            return True
        except Exception as e:
            logger.error("send_email_alert_failed", error=str(e))
            return False
    
    async def _send_pagerduty_alert(self, alert: dict) -> bool:
        """Send PagerDuty notification"""
        api_key = self.channels.get("pagerduty", {}).get("api_key", "")
        if not api_key:
            return False
        
        # Expand environment variable
        api_key = os.path.expandvars(api_key)
        
        try:
            event = {
                "routing_key": api_key,
                "event_action": "trigger",
                "payload": {
                    "summary": alert.get("title", "Infrastructure Alert"),
                    "severity": alert.get("severity", "warning"),
                    "source": alert.get("service", "infrastructure_agent"),
                    "custom_details": {
                        "metric": alert.get("metric"),
                        "value": alert.get("value"),
                        "threshold": alert.get("threshold"),
                        "message": alert.get("message")
                    }
                }
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    "https://events.pagerduty.com/v2/enqueue",
                    json=event
                )
                
                success = response.status_code == 202
                if success:
                    logger.info("pagerduty_alert_sent", alert_title=alert.get("title"))
                else:
                    logger.error("pagerduty_alert_failed", status=response.status_code)
                
                return success
        except Exception as e:
            logger.error("send_pagerduty_alert_failed", error=str(e))
            return False
    
    def check_alert_rules(self, metrics: dict) -> List[dict]:
        """Check if metrics trigger any alert rules"""
        triggered_alerts = []
        
        for rule in self.rules:
            metric = rule.get("metric")
            threshold = rule.get("threshold")
            action = rule.get("action")
            
            if metric in metrics:
                value = metrics[metric]
                
                if value > threshold:
                    alert = {
                        "title": f"{metric} exceeds threshold",
                        "service": "infrastructure",
                        "metric": metric,
                        "value": value,
                        "threshold": threshold,
                        "action": action,
                        "severity": "critical" if value > threshold * 1.2 else "warning",
                        "message": f"{metric} is {value}, exceeding threshold of {threshold}",
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    triggered_alerts.append(alert)
        
        return triggered_alerts


class AutoScaler:
    """Auto-scaling service"""
    
    def __init__(self, config: dict, docker_manager: DockerManager, k8s_manager: KubernetesManager):
        self.config = config
        self.docker_manager = docker_manager
        self.k8s_manager = k8s_manager
        self.enabled = config.get("auto_scaling", {}).get("enable", True)
        self.min_replicas = config.get("auto_scaling", {}).get("min_replicas", 2)
        self.max_replicas = config.get("auto_scaling", {}).get("max_replicas", 10)
        self.scale_up_threshold = config.get("auto_scaling", {}).get("scale_up", {}).get("cpu_threshold", 70)
        self.scale_down_threshold = config.get("auto_scaling", {}).get("scale_down", {}).get("cpu_threshold", 30)
        self.scale_up_cooldown = config.get("auto_scaling", {}).get("scale_up", {}).get("cooldown_seconds", 300)
        self.scale_down_cooldown = config.get("auto_scaling", {}).get("scale_down", {}).get("cooldown_seconds", 600)
        self.last_scale_time = {}
    
    async def evaluate_scaling(self, service: str, metrics: dict) -> Optional[int]:
        """Evaluate if service needs scaling"""
        if not self.enabled:
            return None
        
        cpu_usage = metrics.get("cpu_usage", 0)
        current_time = time.time()
        last_scale = self.last_scale_time.get(service, 0)
        
        # Get current replicas
        if self.k8s_manager.enabled:
            status = self.k8s_manager.get_deployment_status(service)
            current_replicas = status.get("replicas", 1)
        else:
            # For Docker, assume 1 replica (could be improved)
            current_replicas = 1
        
        # Scale up
        if cpu_usage > self.scale_up_threshold:
            if current_time - last_scale > self.scale_up_cooldown:
                new_replicas = min(current_replicas + 1, self.max_replicas)
                if new_replicas > current_replicas:
                    self.last_scale_time[service] = current_time
                    logger.info("scaling_up", service=service, replicas=new_replicas, cpu=cpu_usage)
                    return new_replicas
        
        # Scale down
        elif cpu_usage < self.scale_down_threshold:
            if current_time - last_scale > self.scale_down_cooldown:
                new_replicas = max(current_replicas - 1, self.min_replicas)
                if new_replicas < current_replicas:
                    self.last_scale_time[service] = current_time
                    logger.info("scaling_down", service=service, replicas=new_replicas, cpu=cpu_usage)
                    return new_replicas
        
        return None


class DeploymentOrchestrator:
    """Deployment orchestration with multiple strategies"""
    
    def __init__(self, config: dict, docker_manager: DockerManager):
        self.config = config
        self.docker_manager = docker_manager
        self.deployment_history = []
    
    async def deploy(self, service: str, version: str, strategy: str, image: Optional[str] = None) -> bool:
        """Deploy service with specified strategy"""
        if strategy == DeploymentStrategy.ROLLING:
            return await self._rolling_deployment(service, version, image)
        elif strategy == DeploymentStrategy.BLUE_GREEN:
            return await self._blue_green_deployment(service, version, image)
        elif strategy == DeploymentStrategy.CANARY:
            return await self._canary_deployment(service, version, image)
        else:
            logger.error("unknown_deployment_strategy", strategy=strategy)
            return False
    
    async def _rolling_deployment(self, service: str, version: str, image: Optional[str] = None) -> bool:
        """Rolling update deployment"""
        try:
            full_image = image or f"{service}:{version}"
            
            logger.info("starting_rolling_deployment", service=service, version=version)
            
            # Deploy new version
            success = self.docker_manager.deploy_container(service, full_image, version)
            
            if success:
                # Wait for health check
                await asyncio.sleep(5)
                
                # Verify deployment
                container = self.docker_manager.get_container(service)
                if container and container.status == "running":
                    self._record_deployment(service, version, "rolling", "success")
                    logger.info("rolling_deployment_success", service=service, version=version)
                    return True
            
            self._record_deployment(service, version, "rolling", "failed")
            return False
        except Exception as e:
            logger.error("rolling_deployment_failed", service=service, error=str(e))
            self._record_deployment(service, version, "rolling", "failed")
            return False
    
    async def _blue_green_deployment(self, service: str, version: str, image: Optional[str] = None) -> bool:
        """Blue/green deployment"""
        try:
            config = self.config.get("deployment", {}).get("blue_green", {})
            health_check_timeout = config.get("health_check_timeout", 60)
            rollback_on_failure = config.get("rollback_on_failure", True)
            
            logger.info("starting_blue_green_deployment", service=service, version=version)
            
            # Deploy green environment
            green_service = f"{service}-green"
            full_image = image or f"{service}:{version}"
            
            success = self.docker_manager.deploy_container(green_service, full_image, version)
            
            if not success:
                self._record_deployment(service, version, "blue_green", "failed")
                return False
            
            # Health check with timeout
            start_time = time.time()
            healthy = False
            
            while time.time() - start_time < health_check_timeout:
                container = self.docker_manager.get_container(green_service)
                if container and container.status == "running":
                    # Additional health check could go here
                    healthy = True
                    break
                await asyncio.sleep(2)
            
            if healthy:
                # Switch traffic (stop blue, rename green)
                blue_container = self.docker_manager.get_container(service)
                if blue_container:
                    blue_container.stop()
                    blue_container.remove()
                
                green_container = self.docker_manager.get_container(green_service)
                green_container.rename(service)
                
                self._record_deployment(service, version, "blue_green", "success")
                logger.info("blue_green_deployment_success", service=service, version=version)
                return True
            else:
                # Rollback
                if rollback_on_failure:
                    logger.warning("blue_green_health_check_failed_rolling_back", service=service)
                    green_container = self.docker_manager.get_container(green_service)
                    if green_container:
                        green_container.stop()
                        green_container.remove()
                
                self._record_deployment(service, version, "blue_green", "failed")
                return False
        except Exception as e:
            logger.error("blue_green_deployment_failed", service=service, error=str(e))
            self._record_deployment(service, version, "blue_green", "failed")
            return False
    
    async def _canary_deployment(self, service: str, version: str, image: Optional[str] = None) -> bool:
        """Canary deployment"""
        try:
            config = self.config.get("deployment", {}).get("canary", {})
            traffic_split = config.get("traffic_split", 10)
            duration_minutes = config.get("duration_minutes", 15)
            
            logger.info("starting_canary_deployment", service=service, version=version, traffic_split=traffic_split)
            
            # Deploy canary instance
            canary_service = f"{service}-canary"
            full_image = image or f"{service}:{version}"
            
            success = self.docker_manager.deploy_container(canary_service, full_image, version)
            
            if not success:
                self._record_deployment(service, version, "canary", "failed")
                return False
            
            # Monitor canary for duration
            logger.info("monitoring_canary", duration_minutes=duration_minutes)
            await asyncio.sleep(duration_minutes * 60)
            
            # Check canary health
            canary_container = self.docker_manager.get_container(canary_service)
            if canary_container and canary_container.status == "running":
                # Promote canary to production
                logger.info("promoting_canary_to_production", service=service)
                
                # Stop old version
                old_container = self.docker_manager.get_container(service)
                if old_container:
                    old_container.stop()
                    old_container.remove()
                
                # Rename canary to main service
                canary_container.rename(service)
                
                self._record_deployment(service, version, "canary", "success")
                logger.info("canary_deployment_success", service=service, version=version)
                return True
            else:
                # Rollback canary
                logger.warning("canary_unhealthy_rolling_back", service=service)
                if canary_container:
                    canary_container.stop()
                    canary_container.remove()
                
                self._record_deployment(service, version, "canary", "failed")
                return False
        except Exception as e:
            logger.error("canary_deployment_failed", service=service, error=str(e))
            self._record_deployment(service, version, "canary", "failed")
            return False
    
    def _record_deployment(self, service: str, version: str, strategy: str, status: str):
        """Record deployment in history"""
        self.deployment_history.append({
            "service": service,
            "version": version,
            "strategy": strategy,
            "status": status,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Keep only last 100 deployments
        if len(self.deployment_history) > 100:
            self.deployment_history = self.deployment_history[-100:]
    
    async def rollback(self, service: str, version: str) -> bool:
        """Rollback to previous version"""
        try:
            logger.info("starting_rollback", service=service, version=version)
            
            # Find previous successful deployment
            previous = None
            for deployment in reversed(self.deployment_history):
                if deployment["service"] == service and deployment["status"] == "success":
                    if deployment["version"] != version:
                        previous = deployment
                        break
            
            if not previous:
                logger.error("no_previous_version_found", service=service)
                return False
            
            # Deploy previous version
            full_image = f"{service}:{previous['version']}"
            success = self.docker_manager.deploy_container(service, full_image, previous["version"])
            
            if success:
                self._record_deployment(service, previous["version"], "rollback", "success")
                logger.info("rollback_success", service=service, version=previous["version"])
            else:
                self._record_deployment(service, previous["version"], "rollback", "failed")
            
            return success
        except Exception as e:
            logger.error("rollback_failed", service=service, error=str(e))
            return False


class DatabaseManager:
    """Database backup and restore"""
    
    def __init__(self, config: dict):
        self.config = config
        self.db_config = config.get("database_management", {})
    
    async def backup_database(self, database: str, output_path: Optional[str] = None) -> str:
        """Backup database"""
        if database == "postgresql":
            return await self._backup_postgresql(output_path)
        elif database == "neo4j":
            return await self._backup_neo4j(output_path)
        elif database == "redis":
            return await self._backup_redis(output_path)
        else:
            raise ValueError(f"Unsupported database: {database}")
    
    async def _backup_postgresql(self, output_path: Optional[str] = None) -> str:
        """Backup PostgreSQL database"""
        try:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            backup_file = output_path or f"/backups/postgresql_{timestamp}.sql"
            
            # Ensure backup directory exists
            Path(backup_file).parent.mkdir(parents=True, exist_ok=True)
            
            pg_host = os.getenv("POSTGRES_HOST", "localhost")
            pg_port = os.getenv("POSTGRES_PORT", "5432")
            pg_user = os.getenv("POSTGRES_USER", "postgres")
            pg_db = os.getenv("POSTGRES_DB", "learnyourway")
            
            result = subprocess.run(
                [
                    "pg_dump",
                    "-h", pg_host,
                    "-p", pg_port,
                    "-U", pg_user,
                    "-d", pg_db,
                    "-f", backup_file
                ],
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode == 0:
                logger.info("postgresql_backup_success", file=backup_file)
                return backup_file
            else:
                logger.error("postgresql_backup_failed", error=result.stderr)
                raise Exception(f"Backup failed: {result.stderr}")
        except Exception as e:
            logger.error("backup_postgresql_failed", error=str(e))
            raise
    
    async def _backup_neo4j(self, output_path: Optional[str] = None) -> str:
        """Backup Neo4j database"""
        try:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            backup_file = output_path or f"/backups/neo4j_{timestamp}.dump"
            
            Path(backup_file).parent.mkdir(parents=True, exist_ok=True)
            
            result = subprocess.run(
                [
                    "neo4j-admin",
                    "dump",
                    "--database=neo4j",
                    f"--to={backup_file}"
                ],
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode == 0:
                logger.info("neo4j_backup_success", file=backup_file)
                return backup_file
            else:
                logger.error("neo4j_backup_failed", error=result.stderr)
                raise Exception(f"Backup failed: {result.stderr}")
        except Exception as e:
            logger.error("backup_neo4j_failed", error=str(e))
            raise
    
    async def _backup_redis(self, output_path: Optional[str] = None) -> str:
        """Backup Redis database"""
        try:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            backup_file = output_path or f"/backups/redis_{timestamp}.rdb"
            
            Path(backup_file).parent.mkdir(parents=True, exist_ok=True)
            
            # Trigger Redis save
            result = subprocess.run(
                ["redis-cli", "BGSAVE"],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            # Wait for save to complete
            await asyncio.sleep(5)
            
            # Copy RDB file
            redis_data_dir = os.getenv("REDIS_DATA_DIR", "/var/lib/redis")
            source_file = f"{redis_data_dir}/dump.rdb"
            
            subprocess.run(["cp", source_file, backup_file], check=True, timeout=30)
            
            logger.info("redis_backup_success", file=backup_file)
            return backup_file
        except Exception as e:
            logger.error("backup_redis_failed", error=str(e))
            raise
    
    async def restore_database(self, database: str, backup_file: str) -> bool:
        """Restore database from backup"""
        if database == "postgresql":
            return await self._restore_postgresql(backup_file)
        elif database == "neo4j":
            return await self._restore_neo4j(backup_file)
        elif database == "redis":
            return await self._restore_redis(backup_file)
        else:
            raise ValueError(f"Unsupported database: {database}")
    
    async def _restore_postgresql(self, backup_file: str) -> bool:
        """Restore PostgreSQL database"""
        try:
            pg_host = os.getenv("POSTGRES_HOST", "localhost")
            pg_port = os.getenv("POSTGRES_PORT", "5432")
            pg_user = os.getenv("POSTGRES_USER", "postgres")
            pg_db = os.getenv("POSTGRES_DB", "learnyourway")
            
            result = subprocess.run(
                [
                    "psql",
                    "-h", pg_host,
                    "-p", pg_port,
                    "-U", pg_user,
                    "-d", pg_db,
                    "-f", backup_file
                ],
                capture_output=True,
                text=True,
                timeout=300
            )
            
            success = result.returncode == 0
            if success:
                logger.info("postgresql_restore_success", file=backup_file)
            else:
                logger.error("postgresql_restore_failed", error=result.stderr)
            
            return success
        except Exception as e:
            logger.error("restore_postgresql_failed", error=str(e))
            return False
    
    async def _restore_neo4j(self, backup_file: str) -> bool:
        """Restore Neo4j database"""
        try:
            result = subprocess.run(
                [
                    "neo4j-admin",
                    "load",
                    "--from", backup_file,
                    "--database=neo4j",
                    "--force"
                ],
                capture_output=True,
                text=True,
                timeout=300
            )
            
            success = result.returncode == 0
            if success:
                logger.info("neo4j_restore_success", file=backup_file)
            else:
                logger.error("neo4j_restore_failed", error=result.stderr)
            
            return success
        except Exception as e:
            logger.error("restore_neo4j_failed", error=str(e))
            return False
    
    async def _restore_redis(self, backup_file: str) -> bool:
        """Restore Redis database"""
        try:
            redis_data_dir = os.getenv("REDIS_DATA_DIR", "/var/lib/redis")
            target_file = f"{redis_data_dir}/dump.rdb"
            
            # Stop Redis
            subprocess.run(["redis-cli", "SHUTDOWN", "NOSAVE"], timeout=30)
            await asyncio.sleep(2)
            
            # Copy backup file
            subprocess.run(["cp", backup_file, target_file], check=True, timeout=30)
            
            # Start Redis
            subprocess.run(["redis-server", "--daemonize", "yes"], timeout=30)
            await asyncio.sleep(2)
            
            logger.info("redis_restore_success", file=backup_file)
            return True
        except Exception as e:
            logger.error("restore_redis_failed", error=str(e))
            return False


class InfrastructureAgent:
    """Main Infrastructure Agent orchestrator"""
    
    def __init__(self, config: dict):
        self.config = config
        self.docker_manager = DockerManager(config)
        self.k8s_manager = KubernetesManager(config)
        self.prometheus_monitor = PrometheusMonitor(config)
        self.alert_manager = AlertManager(config)
        self.auto_scaler = AutoScaler(config, self.docker_manager, self.k8s_manager)
        self.deployment_orchestrator = DeploymentOrchestrator(config, self.docker_manager)
        self.database_manager = DatabaseManager(config)
        
        logger.info("infrastructure_agent_initialized")
    
    async def monitor_metrics(self) -> dict:
        """Collect system metrics"""
        metrics = await self.prometheus_monitor.collect_metrics()
        
        # Check alert rules
        triggered_alerts = self.alert_manager.check_alert_rules(metrics)
        
        # Send alerts
        for alert in triggered_alerts:
            if alert["action"] == "alert":
                await self.alert_manager.send_alert(alert, AlertChannel.SLACK)
            elif alert["action"] == "scale_up":
                # Trigger auto-scaling
                service = alert.get("service", "orchestration")
                await self.auto_scaler.evaluate_scaling(service, metrics)
        
        return metrics
    
    async def check_health(self, service: str) -> bool:
        """Health check for service"""
        health_endpoints = self.config.get("health_checks", {}).get("endpoints", [])
        timeout = self.config.get("health_checks", {}).get("timeout_seconds", 5)
        
        # Find service endpoint
        endpoint = None
        for ep in health_endpoints:
            if service in ep:
                endpoint = ep
                break
        
        if not endpoint:
            logger.warning("no_health_endpoint_found", service=service)
            return False
        
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(endpoint)
                healthy = response.status_code == 200
                
                logger.info("health_check_complete", service=service, healthy=healthy)
                return healthy
        except Exception as e:
            logger.error("health_check_failed", service=service, error=str(e))
            return False
    
    async def scale_service(self, service: str, replicas: int) -> bool:
        """Scale service to specified replicas"""
        if self.k8s_manager.enabled:
            return self.k8s_manager.scale_deployment(service, replicas)
        else:
            return self.docker_manager.scale_service(service, replicas)
    
    async def deploy_service(self, service: str, version: str, strategy: str, image: Optional[str] = None) -> bool:
        """Deploy service with specified strategy"""
        return await self.deployment_orchestrator.deploy(service, version, strategy, image)
    
    async def rollback_deployment(self, service: str, version: str) -> bool:
        """Rollback deployment to previous version"""
        return await self.deployment_orchestrator.rollback(service, version)
    
    async def backup_database(self, database: str, output_path: Optional[str] = None) -> str:
        """Create database backup"""
        return await self.database_manager.backup_database(database, output_path)
    
    async def restore_database(self, database: str, backup_file: str) -> bool:
        """Restore database from backup"""
        return await self.database_manager.restore_database(database, backup_file)
    
    async def send_alert(self, alert: dict, channel: str) -> bool:
        """Send alert notification"""
        return await self.alert_manager.send_alert(alert, channel)


# FastAPI application
app = FastAPI(
    title="Infrastructure Agent",
    description="Production-ready infrastructure management system",
    version="1.0.0"
)

# Load configuration
config_path = os.getenv("CONFIG_PATH", "config.yaml")
with open(config_path, "r") as f:
    config = yaml.safe_load(f)

# Initialize agent
agent = InfrastructureAgent(config)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Infrastructure Agent",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/metrics", response_model=MetricsResponse)
async def get_metrics():
    """Get system metrics"""
    try:
        metrics = await agent.monitor_metrics()
        
        return MetricsResponse(
            timestamp=datetime.utcnow().isoformat(),
            cpu_usage=metrics.get("cpu_usage", 0.0),
            memory_usage=metrics.get("memory_usage", 0.0),
            disk_usage=metrics.get("disk_usage", 0.0),
            network_io=metrics.get("network_io", {}),
            request_rate=metrics.get("request_rate", 0.0),
            error_rate=metrics.get("error_rate", 0.0),
            latency_p99=metrics.get("latency_p99", 0.0)
        )
    except Exception as e:
        logger.error("get_metrics_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health/{service}", response_model=HealthResponse)
async def check_service_health(service: str):
    """Check service health"""
    try:
        start_time = time.time()
        healthy = await agent.check_health(service)
        response_time = (time.time() - start_time) * 1000
        
        return HealthResponse(
            service=service,
            healthy=healthy,
            status_code=200 if healthy else 503,
            response_time_ms=response_time,
            message="Service is healthy" if healthy else "Service is unhealthy"
        )
    except Exception as e:
        logger.error("check_health_failed", service=service, error=str(e))
        return HealthResponse(
            service=service,
            healthy=False,
            message=str(e)
        )


@app.post("/scale")
async def scale_service(request: ScaleRequest):
    """Scale service"""
    try:
        success = await agent.scale_service(request.service, request.replicas)
        
        if success:
            return {
                "success": True,
                "service": request.service,
                "replicas": request.replicas,
                "message": f"Service scaled to {request.replicas} replicas"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to scale service")
    except Exception as e:
        logger.error("scale_service_failed", service=request.service, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/deploy")
async def deploy_service(request: DeployRequest, background_tasks: BackgroundTasks):
    """Deploy service"""
    try:
        # Run deployment in background
        background_tasks.add_task(
            agent.deploy_service,
            request.service,
            request.version,
            request.strategy,
            request.image
        )
        
        return {
            "success": True,
            "service": request.service,
            "version": request.version,
            "strategy": request.strategy,
            "message": f"Deployment started for {request.service}:{request.version}"
        }
    except Exception as e:
        logger.error("deploy_service_failed", service=request.service, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rollback")
async def rollback_deployment(request: RollbackRequest):
    """Rollback deployment"""
    try:
        success = await agent.rollback_deployment(request.service, request.version)
        
        if success:
            return {
                "success": True,
                "service": request.service,
                "version": request.version,
                "message": f"Rollback completed for {request.service}"
            }
        else:
            raise HTTPException(status_code=500, detail="Rollback failed")
    except Exception as e:
        logger.error("rollback_failed", service=request.service, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/backup")
async def backup_database(request: BackupRequest):
    """Backup database"""
    try:
        backup_file = await agent.backup_database(request.database, request.output_path)
        
        return {
            "success": True,
            "database": request.database,
            "backup_file": backup_file,
            "message": f"Backup created: {backup_file}"
        }
    except Exception as e:
        logger.error("backup_failed", database=request.database, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/restore")
async def restore_database(request: RestoreRequest):
    """Restore database"""
    try:
        success = await agent.restore_database(request.database, request.backup_file)
        
        if success:
            return {
                "success": True,
                "database": request.database,
                "backup_file": request.backup_file,
                "message": f"Database restored from {request.backup_file}"
            }
        else:
            raise HTTPException(status_code=500, detail="Restore failed")
    except Exception as e:
        logger.error("restore_failed", database=request.database, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/logs/{service}", response_model=LogsResponse)
async def get_service_logs(service: str, lines: int = 100):
    """Get service logs"""
    try:
        log_lines = agent.docker_manager.get_container_logs(service, lines)
        
        return LogsResponse(
            service=service,
            lines=log_lines,
            timestamp=datetime.utcnow().isoformat()
        )
    except Exception as e:
        logger.error("get_logs_failed", service=service, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    
    port = config.get("agent", {}).get("port", 8019)
    host = config.get("agent", {}).get("host", "0.0.0.0")
    
    uvicorn.run(app, host=host, port=port)
