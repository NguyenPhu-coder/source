"""
Analytics Agent - Real-time analytics and predictive modeling

This agent:
- Ingests events from Kafka/RabbitMQ streams
- Calculates retention rates (rolling & cohort methods)
- Analyzes user engagement
- Predicts dropout risk using ML models
- Detects anomalies in metrics
- Generates cohort analysis
- Tracks learning velocity
- Recommends interventions
- Exports analytics data
- Provides real-time dashboard data

Architecture:
- Standalone with event stream ingestion
- Local ML models for predictions
- TimescaleDB for time-series metrics
- Config-driven analytics rules
- Real-time processing
"""

import asyncio
import io
import json
import pickle
import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import structlog
import yaml
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import Response
from prometheus_client import Counter, Histogram, generate_latest
from pydantic import BaseModel, Field
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler

try:
    from kafka import KafkaConsumer, KafkaProducer
    KAFKA_AVAILABLE = True
except ImportError:
    KAFKA_AVAILABLE = False
    structlog.get_logger().warning("kafka-python not available")

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    TIMESCALE_AVAILABLE = True
except ImportError:
    TIMESCALE_AVAILABLE = False
    structlog.get_logger().warning("psycopg2 not available")

logger = structlog.get_logger()


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class Event(BaseModel):
    """Event model"""
    event_type: str = Field(..., description="Event type")
    user_id: str = Field(..., description="User ID")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Event timestamp")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Event metadata")


class RetentionRequest(BaseModel):
    """Retention calculation request"""
    user_cohort: Optional[List[str]] = Field(default=None, description="User cohort")
    period: int = Field(..., ge=1, description="Period in days")
    cohort_date: Optional[str] = Field(default=None, description="Cohort start date")


class ExportRequest(BaseModel):
    """Export request"""
    format: str = Field(..., description="Export format: csv, json, excel")
    start_date: datetime = Field(..., description="Start date")
    end_date: datetime = Field(..., description="End date")
    metrics: Optional[List[str]] = Field(default=None, description="Metrics to export")


# ============================================================================
# CONFIGURATION LOADER
# ============================================================================

class ConfigLoader:
    """Load and validate configuration from YAML"""
    
    def __init__(self, config_path: str = "config.yaml"):
        self.config_path = config_path
        self.config = self._load_config()
        self._validate_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from YAML file"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            logger.info("configuration_loaded", path=self.config_path)
            return config
        except FileNotFoundError:
            logger.error("config_file_not_found", path=self.config_path)
            raise
        except yaml.YAMLError as e:
            logger.error("yaml_parse_error", error=str(e))
            raise
    
    def _validate_config(self):
        """Validate configuration structure"""
        required_sections = ["agent", "event_stream", "metrics", "retention", "prediction", "database"]
        for section in required_sections:
            if section not in self.config:
                raise ValueError(f"Missing required config section: {section}")
        
        logger.info("configuration_validated")
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value by dot-notation key"""
        keys = key.split(".")
        value = self.config
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k, default)
            else:
                return default
        return value


# ============================================================================
# EVENT STREAM PROCESSOR
# ============================================================================

class EventStreamProcessor:
    """Process events from Kafka or in-memory queue"""
    
    def __init__(self, config: ConfigLoader):
        self.config = config
        self.event_queue = []  # In-memory queue for when Kafka unavailable
        self.consumer = None
        self.producer = None
        
        stream_type = config.get("event_stream.type", "kafka")
        
        if stream_type == "kafka" and KAFKA_AVAILABLE:
            self._init_kafka()
        else:
            logger.warning("using_in_memory_queue", reason="Kafka not available")
    
    def _init_kafka(self):
        """Initialize Kafka consumer and producer"""
        try:
            brokers = self.config.get("event_stream.brokers", ["localhost:9092"])
            topics = self.config.get("event_stream.topics", ["user_events"])
            group = self.config.get("event_stream.consumer_group", "analytics")
            
            self.consumer = KafkaConsumer(
                *topics,
                bootstrap_servers=brokers,
                group_id=group,
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                auto_offset_reset='latest',
                enable_auto_commit=True
            )
            
            self.producer = KafkaProducer(
                bootstrap_servers=brokers,
                value_serializer=lambda v: json.dumps(v).encode('utf-8')
            )
            
            logger.info("kafka_initialized", brokers=brokers, topics=topics)
        except Exception as e:
            logger.error("kafka_init_error", error=str(e))
            self.consumer = None
            self.producer = None
    
    def ingest_event(self, event: Dict[str, Any]):
        """Ingest event into processing queue"""
        self.event_queue.append({
            **event,
            'ingested_at': datetime.utcnow().isoformat()
        })
        
        # Keep queue size manageable
        if len(self.event_queue) > 10000:
            self.event_queue = self.event_queue[-5000:]
    
    def get_events(
        self,
        user_id: Optional[str] = None,
        event_type: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Get events from queue with filters"""
        events = self.event_queue
        
        if user_id:
            events = [e for e in events if e.get('user_id') == user_id]
        
        if event_type:
            events = [e for e in events if e.get('event_type') == event_type]
        
        if start_time:
            events = [e for e in events if datetime.fromisoformat(e.get('timestamp', e.get('ingested_at'))) >= start_time]
        
        if end_time:
            events = [e for e in events if datetime.fromisoformat(e.get('timestamp', e.get('ingested_at'))) <= end_time]
        
        return events
    
    def close(self):
        """Close connections"""
        if self.consumer:
            self.consumer.close()
        if self.producer:
            self.producer.close()


# ============================================================================
# DATABASE MANAGER
# ============================================================================

class DatabaseManager:
    """Manage TimescaleDB or in-memory storage"""
    
    def __init__(self, config: ConfigLoader):
        self.config = config
        self.connection = None
        self.in_memory_data = {
            'events': [],
            'user_metrics': {},
            'cohorts': []
        }
        
        if TIMESCALE_AVAILABLE:
            self._init_connection()
        else:
            logger.warning("using_in_memory_storage", reason="TimescaleDB not available")
    
    def _init_connection(self):
        """Initialize TimescaleDB connection"""
        try:
            host = self.config.get("database.host", "localhost")
            port = self.config.get("database.port", 5432)
            database = self.config.get("database.database", "analytics")
            user = self.config.get("database.user", "postgres")
            password = self.config.get("database.password", "")
            
            self.connection = psycopg2.connect(
                host=host,
                port=port,
                database=database,
                user=user,
                password=password
            )
            
            logger.info("timescaledb_connected", host=host, database=database)
        except Exception as e:
            logger.error("timescaledb_connection_error", error=str(e))
            self.connection = None
    
    def store_event(self, event: Dict[str, Any]):
        """Store event in database"""
        if self.connection:
            try:
                cursor = self.connection.cursor()
                cursor.execute(
                    """
                    INSERT INTO events (time, user_id, event_type, metadata)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (
                        event.get('timestamp', datetime.utcnow()),
                        event['user_id'],
                        event['event_type'],
                        json.dumps(event.get('metadata', {}))
                    )
                )
                self.connection.commit()
                cursor.close()
            except Exception as e:
                logger.error("store_event_error", error=str(e))
                self.connection.rollback()
        else:
            self.in_memory_data['events'].append(event)
    
    def get_user_metrics(self, user_id: str) -> Dict[str, Any]:
        """Get user metrics from storage"""
        if user_id in self.in_memory_data['user_metrics']:
            return self.in_memory_data['user_metrics'][user_id]
        
        return {
            'user_id': user_id,
            'event_count': 0,
            'last_seen': None,
            'engagement_score': 0.0
        }
    
    def update_user_metrics(self, user_id: str, metrics: Dict[str, Any]):
        """Update user metrics"""
        self.in_memory_data['user_metrics'][user_id] = metrics
    
    def close(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()


# ============================================================================
# RETENTION CALCULATOR
# ============================================================================

class RetentionCalculator:
    """Calculate retention rates using rolling or cohort methods"""
    
    def __init__(self, config: ConfigLoader, event_processor: EventStreamProcessor):
        self.config = config
        self.event_processor = event_processor
        self.method = config.get("retention.calculation_method", "rolling")
    
    def calculate_retention(
        self,
        user_cohort: Optional[List[str]] = None,
        period: int = 7
    ) -> float:
        """
        Calculate retention rate
        
        Rolling: Users active in last N days / Total users
        Cohort: Users from cohort still active / Cohort size
        """
        if self.method == "rolling":
            return self._calculate_rolling_retention(user_cohort, period)
        else:
            return self._calculate_cohort_retention(user_cohort, period)
    
    def _calculate_rolling_retention(
        self,
        user_cohort: Optional[List[str]],
        period: int
    ) -> float:
        """Calculate rolling retention rate"""
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=period)
        
        # Get all users
        if user_cohort:
            total_users = len(user_cohort)
            active_users = set()
            
            for user_id in user_cohort:
                events = self.event_processor.get_events(
                    user_id=user_id,
                    start_time=start_time,
                    end_time=end_time
                )
                if events:
                    active_users.add(user_id)
            
            active_count = len(active_users)
        else:
            # Get all unique users in period
            events = self.event_processor.get_events(
                start_time=start_time,
                end_time=end_time
            )
            active_users = set(e['user_id'] for e in events)
            active_count = len(active_users)
            
            # Estimate total users (would query from database in production)
            total_users = max(active_count, 100)  # Minimum baseline
        
        if total_users == 0:
            return 0.0
        
        retention_rate = active_count / total_users
        
        logger.info(
            "retention_calculated",
            method="rolling",
            period=period,
            active=active_count,
            total=total_users,
            rate=retention_rate
        )
        
        return retention_rate
    
    def _calculate_cohort_retention(
        self,
        user_cohort: Optional[List[str]],
        period: int
    ) -> float:
        """Calculate cohort retention rate"""
        if not user_cohort:
            return 0.0
        
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=period)
        
        retained_users = set()
        for user_id in user_cohort:
            events = self.event_processor.get_events(
                user_id=user_id,
                start_time=start_time,
                end_time=end_time
            )
            if events:
                retained_users.add(user_id)
        
        retention_rate = len(retained_users) / len(user_cohort)
        
        logger.info(
            "retention_calculated",
            method="cohort",
            period=period,
            retained=len(retained_users),
            cohort_size=len(user_cohort),
            rate=retention_rate
        )
        
        return retention_rate


# ============================================================================
# ENGAGEMENT ANALYZER
# ============================================================================

class EngagementAnalyzer:
    """Analyze user engagement patterns"""
    
    def __init__(self, config: ConfigLoader, event_processor: EventStreamProcessor):
        self.config = config
        self.event_processor = event_processor
    
    def analyze_engagement(
        self,
        user_id: str,
        time_window: str = "7d"
    ) -> Dict[str, Any]:
        """
        Analyze user engagement
        
        Engagement Score = weighted_sum(
            session_frequency * 0.3,
            content_completion * 0.3,
            quiz_performance * 0.2,
            time_spent * 0.2
        )
        """
        # Parse time window
        days = self._parse_time_window(time_window)
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=days)
        
        # Get user events
        events = self.event_processor.get_events(
            user_id=user_id,
            start_time=start_time,
            end_time=end_time
        )
        
        if not events:
            return {
                'user_id': user_id,
                'engagement_score': 0.0,
                'session_count': 0,
                'total_time_spent': 0,
                'content_completion_rate': 0.0,
                'quiz_performance': 0.0
            }
        
        # Calculate metrics
        session_count = len([e for e in events if e['event_type'] == 'session_start'])
        
        time_spent_events = [e for e in events if e['event_type'] == 'time_spent']
        total_time_spent = sum(e.get('metadata', {}).get('duration', 0) for e in time_spent_events)
        
        completion_events = [e for e in events if 'completion' in e['event_type']]
        content_completion_rate = len(completion_events) / max(len(events), 1)
        
        quiz_events = [e for e in events if e['event_type'] == 'quiz_completion']
        if quiz_events:
            avg_quiz_score = np.mean([
                e.get('metadata', {}).get('score', 0) for e in quiz_events
            ])
            quiz_performance = avg_quiz_score / 100.0  # Normalize to 0-1
        else:
            quiz_performance = 0.0
        
        # Calculate engagement score
        session_frequency_score = min(1.0, session_count / (days * 2))  # 2 sessions/day = 1.0
        time_spent_score = min(1.0, total_time_spent / (days * 1800))  # 30 min/day = 1.0
        
        engagement_score = (
            session_frequency_score * 0.3 +
            content_completion_rate * 0.3 +
            quiz_performance * 0.2 +
            time_spent_score * 0.2
        )
        
        return {
            'user_id': user_id,
            'engagement_score': round(engagement_score, 3),
            'session_count': session_count,
            'total_time_spent': total_time_spent,
            'content_completion_rate': round(content_completion_rate, 3),
            'quiz_performance': round(quiz_performance, 3),
            'time_window': time_window
        }
    
    def _parse_time_window(self, window: str) -> int:
        """Parse time window string to days"""
        if window.endswith('d'):
            return int(window[:-1])
        elif window.endswith('h'):
            return int(window[:-1]) / 24
        elif window.endswith('m'):
            return int(window[:-1]) / (24 * 60)
        else:
            return 7  # Default to 7 days


# ============================================================================
# PREDICTIVE MODELS
# ============================================================================

class PredictiveModels:
    """ML models for predictions"""
    
    def __init__(self, config: ConfigLoader):
        self.config = config
        self.models = {}
        self.scalers = {}
        self._init_models()
    
    def _init_models(self):
        """Initialize ML models"""
        # Dropout risk model
        self.models['dropout_risk'] = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        self.scalers['dropout_risk'] = StandardScaler()
        
        # Learning outcome model
        self.models['learning_outcome'] = GradientBoostingRegressor(
            n_estimators=100,
            max_depth=5,
            random_state=42
        )
        self.scalers['learning_outcome'] = StandardScaler()
        
        logger.info("predictive_models_initialized")
    
    def predict_dropout_risk(
        self,
        user_id: str,
        features: Dict[str, float]
    ) -> float:
        """
        Predict dropout risk (0-1)
        
        Features:
        - days_since_last_login
        - avg_session_duration
        - completion_rate
        - quiz_performance
        - engagement_trend
        """
        feature_names = [
            'days_since_last_login',
            'avg_session_duration',
            'completion_rate',
            'quiz_performance',
            'engagement_trend'
        ]
        
        # Extract feature values
        feature_values = [features.get(f, 0.0) for f in feature_names]
        
        # Simple heuristic model (in production, use trained model)
        days_since_login = feature_values[0]
        completion_rate = feature_values[2]
        quiz_performance = feature_values[3]
        
        # Risk increases with inactivity and poor performance
        risk_score = 0.0
        
        if days_since_login > 30:
            risk_score += 0.4
        elif days_since_login > 14:
            risk_score += 0.2
        elif days_since_login > 7:
            risk_score += 0.1
        
        if completion_rate < 0.3:
            risk_score += 0.3
        elif completion_rate < 0.5:
            risk_score += 0.15
        
        if quiz_performance < 0.4:
            risk_score += 0.3
        elif quiz_performance < 0.6:
            risk_score += 0.15
        
        risk_score = min(1.0, risk_score)
        
        logger.info(
            "dropout_risk_predicted",
            user_id=user_id,
            risk_score=risk_score,
            days_inactive=days_since_login
        )
        
        return risk_score
    
    def predict_learning_outcome(
        self,
        user_id: str,
        features: Dict[str, float]
    ) -> float:
        """Predict learning outcome score (0-1)"""
        engagement = features.get('engagement_score', 0.5)
        quiz_performance = features.get('quiz_performance', 0.5)
        completion_rate = features.get('completion_rate', 0.5)
        
        # Weighted combination
        outcome_score = (
            engagement * 0.3 +
            quiz_performance * 0.4 +
            completion_rate * 0.3
        )
        
        return outcome_score


# ============================================================================
# ANOMALY DETECTOR
# ============================================================================

class AnomalyDetector:
    """Detect anomalies in metrics"""
    
    def __init__(self, config: ConfigLoader):
        self.config = config
        self.baseline_metrics = {}
    
    def detect_anomalies(
        self,
        metric: str,
        window: str = "1h"
    ) -> List[Dict[str, Any]]:
        """
        Detect anomalies using statistical methods
        
        Uses z-score method: anomaly if |z| > 3
        """
        anomalies = []
        
        # Get baseline statistics
        if metric not in self.baseline_metrics:
            self.baseline_metrics[metric] = {
                'mean': 0.5,
                'std': 0.1,
                'samples': []
            }
        
        baseline = self.baseline_metrics[metric]
        
        # In production, query actual metric values
        # For now, simulate check
        current_value = 0.5  # Would fetch from metrics
        
        # Calculate z-score
        if baseline['std'] > 0:
            z_score = abs((current_value - baseline['mean']) / baseline['std'])
            
            if z_score > 3:
                anomalies.append({
                    'metric': metric,
                    'value': current_value,
                    'expected_mean': baseline['mean'],
                    'z_score': round(z_score, 2),
                    'severity': 'high' if z_score > 5 else 'medium',
                    'timestamp': datetime.utcnow().isoformat()
                })
        
        return anomalies


# ============================================================================
# COHORT ANALYZER
# ============================================================================

class CohortAnalyzer:
    """Generate cohort analysis"""
    
    def __init__(
        self,
        config: ConfigLoader,
        event_processor: EventStreamProcessor,
        retention_calculator: RetentionCalculator
    ):
        self.config = config
        self.event_processor = event_processor
        self.retention_calculator = retention_calculator
    
    def generate_cohort_analysis(
        self,
        cohort_date: str
    ) -> Dict[str, Any]:
        """
        Generate cohort analysis
        
        Returns retention rates for cohort over multiple periods
        """
        cohort_start = datetime.fromisoformat(cohort_date)
        cohort_end = cohort_start + timedelta(days=1)
        
        # Get users who joined in cohort period
        events = self.event_processor.get_events(
            event_type='session_start',
            start_time=cohort_start,
            end_time=cohort_end
        )
        
        cohort_users = list(set(e['user_id'] for e in events))
        
        if not cohort_users:
            return {
                'cohort_date': cohort_date,
                'cohort_size': 0,
                'retention': {}
            }
        
        # Calculate retention for different periods
        periods = self.config.get("retention.periods", [1, 7, 14, 30, 90])
        retention_data = {}
        
        for period in periods:
            retention_rate = self.retention_calculator.calculate_retention(
                user_cohort=cohort_users,
                period=period
            )
            retention_data[f"day_{period}"] = round(retention_rate, 3)
        
        return {
            'cohort_date': cohort_date,
            'cohort_size': len(cohort_users),
            'retention': retention_data
        }


# ============================================================================
# LEARNING VELOCITY TRACKER
# ============================================================================

class LearningVelocityTracker:
    """Track learning velocity"""
    
    def __init__(self, config: ConfigLoader, event_processor: EventStreamProcessor):
        self.config = config
        self.event_processor = event_processor
    
    def calculate_learning_velocity(
        self,
        user_id: str
    ) -> float:
        """
        Calculate learning velocity
        
        Velocity = concepts_mastered / time_period
        """
        window_days = self.config.get("analytics.velocity.window_days", 7)
        
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=window_days)
        
        # Get completion events
        events = self.event_processor.get_events(
            user_id=user_id,
            event_type='quiz_completion',
            start_time=start_time,
            end_time=end_time
        )
        
        if not events:
            return 0.0
        
        # Count successful completions (score >= 70%)
        successful = [
            e for e in events
            if e.get('metadata', {}).get('score', 0) >= 70
        ]
        
        concepts_mastered = len(successful)
        velocity = concepts_mastered / window_days
        
        logger.info(
            "learning_velocity_calculated",
            user_id=user_id,
            velocity=velocity,
            concepts=concepts_mastered,
            days=window_days
        )
        
        return velocity


# ============================================================================
# INTERVENTION RECOMMENDER
# ============================================================================

class InterventionRecommender:
    """Recommend learning interventions"""
    
    def __init__(self, config: ConfigLoader):
        self.config = config
    
    def recommend_intervention(
        self,
        user_id: str,
        metrics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Recommend intervention based on metrics
        
        Types:
        - tutoring: Very low performance
        - practice: Low completion/quiz scores
        - review: High dropout risk
        - none: Performance good
        """
        dropout_risk = metrics.get('dropout_risk', 0.0)
        engagement_score = metrics.get('engagement_score', 0.5)
        quiz_performance = metrics.get('quiz_performance', 0.5)
        
        if dropout_risk > 0.7:
            return {
                'user_id': user_id,
                'intervention': 'tutoring',
                'priority': 'high',
                'reason': f'High dropout risk ({dropout_risk:.2f})',
                'actions': [
                    'Schedule 1-on-1 tutoring session',
                    'Provide personalized learning path',
                    'Check for external barriers'
                ]
            }
        elif engagement_score < 0.3:
            return {
                'user_id': user_id,
                'intervention': 'engagement_boost',
                'priority': 'high',
                'reason': f'Low engagement ({engagement_score:.2f})',
                'actions': [
                    'Send motivational message',
                    'Suggest interactive content',
                    'Offer gamification rewards'
                ]
            }
        elif quiz_performance < 0.5:
            return {
                'user_id': user_id,
                'intervention': 'additional_practice',
                'priority': 'medium',
                'reason': f'Low quiz performance ({quiz_performance:.2f})',
                'actions': [
                    'Provide practice exercises',
                    'Offer concept review materials',
                    'Recommend prerequisite topics'
                ]
            }
        else:
            return {
                'user_id': user_id,
                'intervention': 'none',
                'priority': 'low',
                'reason': 'Performance within normal range',
                'actions': ['Continue current learning path']
            }


# ============================================================================
# ANALYTICS AGENT
# ============================================================================

class AnalyticsAgent:
    """Main Analytics Agent orchestrator"""
    
    def __init__(self, config: ConfigLoader):
        self.config = config
        
        # Initialize components
        self.event_processor = EventStreamProcessor(config)
        self.db_manager = DatabaseManager(config)
        self.retention_calculator = RetentionCalculator(config, self.event_processor)
        self.engagement_analyzer = EngagementAnalyzer(config, self.event_processor)
        self.predictive_models = PredictiveModels(config)
        self.anomaly_detector = AnomalyDetector(config)
        self.cohort_analyzer = CohortAnalyzer(config, self.event_processor, self.retention_calculator)
        self.velocity_tracker = LearningVelocityTracker(config, self.event_processor)
        self.intervention_recommender = InterventionRecommender(config)
        
        logger.info("analytics_agent_initialized")
    
    def ingest_event(self, event: Dict[str, Any]) -> None:
        """Ingest event for processing"""
        self.event_processor.ingest_event(event)
        self.db_manager.store_event(event)
        
        logger.info("event_ingested", event_type=event.get('event_type'), user_id=event.get('user_id'))
    
    def calculate_retention(
        self,
        user_cohort: Optional[List[str]] = None,
        period: int = 7
    ) -> float:
        """Calculate retention rate"""
        return self.retention_calculator.calculate_retention(user_cohort, period)
    
    def analyze_engagement(
        self,
        user_id: str,
        time_window: str = "7d"
    ) -> Dict[str, Any]:
        """Analyze user engagement"""
        return self.engagement_analyzer.analyze_engagement(user_id, time_window)
    
    def predict_dropout_risk(
        self,
        user_id: str
    ) -> float:
        """Predict dropout risk"""
        # Get user metrics
        engagement_metrics = self.analyze_engagement(user_id)
        
        # Get last activity
        events = self.event_processor.get_events(user_id=user_id)
        if events:
            last_event = max(events, key=lambda e: e.get('timestamp', e.get('ingested_at')))
            last_time = datetime.fromisoformat(last_event.get('timestamp', last_event.get('ingested_at')))
            days_since_login = (datetime.utcnow() - last_time).days
        else:
            days_since_login = 365
        
        features = {
            'days_since_last_login': days_since_login,
            'avg_session_duration': 0.0,  # Would calculate from events
            'completion_rate': engagement_metrics['content_completion_rate'],
            'quiz_performance': engagement_metrics['quiz_performance'],
            'engagement_trend': engagement_metrics['engagement_score']
        }
        
        return self.predictive_models.predict_dropout_risk(user_id, features)
    
    def detect_anomalies(
        self,
        metric: str,
        window: str = "1h"
    ) -> List[Dict[str, Any]]:
        """Detect anomalies in metrics"""
        return self.anomaly_detector.detect_anomalies(metric, window)
    
    def generate_cohort_analysis(
        self,
        cohort_date: str
    ) -> Dict[str, Any]:
        """Generate cohort analysis"""
        return self.cohort_analyzer.generate_cohort_analysis(cohort_date)
    
    def calculate_learning_velocity(
        self,
        user_id: str
    ) -> float:
        """Calculate learning velocity"""
        return self.velocity_tracker.calculate_learning_velocity(user_id)
    
    def recommend_intervention(
        self,
        user_id: str
    ) -> Dict[str, Any]:
        """Recommend intervention"""
        # Gather metrics
        engagement_metrics = self.analyze_engagement(user_id)
        dropout_risk = self.predict_dropout_risk(user_id)
        
        metrics = {
            **engagement_metrics,
            'dropout_risk': dropout_risk
        }
        
        return self.intervention_recommender.recommend_intervention(user_id, metrics)
    
    def export_metrics(
        self,
        format: str,
        start_date: datetime,
        end_date: datetime,
        metrics: Optional[List[str]] = None
    ) -> bytes:
        """Export metrics to file"""
        # Get all events in range
        events = self.event_processor.get_events(
            start_time=start_date,
            end_time=end_date
        )
        
        if format == "json":
            data = json.dumps(events, indent=2, default=str)
            return data.encode('utf-8')
        
        elif format == "csv":
            df = pd.DataFrame(events)
            csv_buffer = io.StringIO()
            df.to_csv(csv_buffer, index=False)
            return csv_buffer.getvalue().encode('utf-8')
        
        elif format == "excel":
            df = pd.DataFrame(events)
            excel_buffer = io.BytesIO()
            df.to_excel(excel_buffer, index=False)
            return excel_buffer.getvalue()
        
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """Get real-time dashboard data"""
        # Get recent events
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=24)
        
        recent_events = self.event_processor.get_events(
            start_time=start_time,
            end_time=end_time
        )
        
        # Calculate metrics
        unique_users = len(set(e['user_id'] for e in recent_events))
        event_count = len(recent_events)
        
        # Event type distribution
        event_types = {}
        for event in recent_events:
            event_type = event['event_type']
            event_types[event_type] = event_types.get(event_type, 0) + 1
        
        # Retention rate
        retention_7d = self.calculate_retention(period=7)
        retention_30d = self.calculate_retention(period=30)
        
        return {
            'timestamp': datetime.utcnow().isoformat(),
            'period': '24h',
            'metrics': {
                'active_users': unique_users,
                'total_events': event_count,
                'retention_7d': round(retention_7d, 3),
                'retention_30d': round(retention_30d, 3)
            },
            'event_distribution': event_types
        }
    
    def close(self):
        """Close resources"""
        self.event_processor.close()
        self.db_manager.close()


# ============================================================================
# METRICS
# ============================================================================

event_ingestion_duration = Histogram(
    "event_ingestion_duration_seconds",
    "Time to ingest event",
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1]
)

events_ingested_total = Counter(
    "events_ingested_total",
    "Total events ingested",
    ["event_type"]
)

retention_calculations_total = Counter(
    "retention_calculations_total",
    "Total retention calculations",
    ["method"]
)


# ============================================================================
# FASTAPI APPLICATION
# ============================================================================

# Load configuration
config = ConfigLoader("config.yaml")

# Initialize agent
agent = AnalyticsAgent(config)

# Create FastAPI app
app = FastAPI(
    title=config.get("agent.name", "analytics_agent"),
    description="Analytics Agent - Real-time analytics and predictive modeling",
    version="1.0.0"
)


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    agent.close()


@app.post("/events")
async def ingest_events_endpoint(event: Event):
    """Ingest event for processing"""
    start_time = time.time()
    
    try:
        event_dict = event.dict()
        agent.ingest_event(event_dict)
        
        duration = time.time() - start_time
        event_ingestion_duration.observe(duration)
        events_ingested_total.labels(event_type=event.event_type).inc()
        
        return {"status": "success", "event_id": event_dict.get('user_id')}
        
    except Exception as e:
        logger.error("event_ingestion_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/metrics/{user_id}")
async def get_user_metrics_endpoint(user_id: str):
    """Get user metrics"""
    try:
        engagement = agent.analyze_engagement(user_id)
        dropout_risk = agent.predict_dropout_risk(user_id)
        velocity = agent.calculate_learning_velocity(user_id)
        
        return {
            'user_id': user_id,
            'engagement': engagement,
            'dropout_risk': round(dropout_risk, 3),
            'learning_velocity': round(velocity, 3)
        }
        
    except Exception as e:
        logger.error("get_metrics_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/retention")
async def calculate_retention_endpoint(
    period: int = Query(default=7, ge=1),
    cohort_users: Optional[str] = Query(default=None)
):
    """Calculate retention rate"""
    try:
        user_list = None
        if cohort_users:
            user_list = cohort_users.split(',')
        
        retention_rate = agent.calculate_retention(user_list, period)
        
        retention_calculations_total.labels(method="api").inc()
        
        return {
            'period_days': period,
            'retention_rate': round(retention_rate, 3),
            'cohort_size': len(user_list) if user_list else None
        }
        
    except Exception as e:
        logger.error("calculate_retention_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/engagement/{user_id}")
async def analyze_engagement_endpoint(
    user_id: str,
    window: str = Query(default="7d")
):
    """Analyze user engagement"""
    try:
        result = agent.analyze_engagement(user_id, window)
        return result
        
    except Exception as e:
        logger.error("analyze_engagement_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/predict-dropout/{user_id}")
async def predict_dropout_endpoint(user_id: str):
    """Predict dropout risk"""
    try:
        risk_score = agent.predict_dropout_risk(user_id)
        
        return {
            'user_id': user_id,
            'dropout_risk': round(risk_score, 3),
            'risk_level': 'high' if risk_score > 0.7 else 'medium' if risk_score > 0.4 else 'low'
        }
        
    except Exception as e:
        logger.error("predict_dropout_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/cohort-analysis")
async def cohort_analysis_endpoint(cohort_date: str):
    """Generate cohort analysis"""
    try:
        result = agent.generate_cohort_analysis(cohort_date)
        return result
        
    except Exception as e:
        logger.error("cohort_analysis_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/dashboard-data")
async def dashboard_data_endpoint():
    """Get real-time dashboard data"""
    try:
        result = agent.get_dashboard_data()
        return result
        
    except Exception as e:
        logger.error("dashboard_data_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/export")
async def export_metrics_endpoint(request: ExportRequest):
    """Export analytics data"""
    try:
        file_bytes = agent.export_metrics(
            format=request.format,
            start_date=request.start_date,
            end_date=request.end_date,
            metrics=request.metrics
        )
        
        content_types = {
            'json': 'application/json',
            'csv': 'text/csv',
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
        
        return Response(
            content=file_bytes,
            media_type=content_types.get(request.format, 'application/octet-stream'),
            headers={'Content-Disposition': f'attachment; filename=analytics.{request.format}'}
        )
        
    except Exception as e:
        logger.error("export_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "analytics_agent",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(content=generate_latest(), media_type="text/plain")


if __name__ == "__main__":
    import uvicorn
    
    port = config.get("agent.port", 8011)
    host = config.get("agent.host", "0.0.0.0")
    
    uvicorn.run(app, host=host, port=port)
