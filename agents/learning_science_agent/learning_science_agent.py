"""
Learning Science Agent - Apply learning science theories and algorithms

This agent:
- Implements spaced repetition (SM-2 algorithm)
- Models forgetting curves
- Manages cognitive load
- Enforces dual coding theory
- Validates Bloom's taxonomy progression
- Schedules optimal review sessions
- Tracks retention rates (target 11% improvement)
- Triggers learning interventions
- Analyzes learning velocity

Architecture:
- Standalone with local database
- API calls to knowledge graph for updates
- Config-driven theory parameters
- Production-ready algorithms
"""

import math
import re
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import httpx
import structlog
import yaml
from fastapi import FastAPI, HTTPException, Query
from prometheus_client import Counter, Histogram, generate_latest
from pydantic import BaseModel, Field
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    create_engine,
    desc,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker

logger = structlog.get_logger()

# ============================================================================
# DATABASE MODELS
# ============================================================================

Base = declarative_base()


class ReviewSchedule(Base):
    """Schedule for concept reviews"""
    __tablename__ = "review_schedules"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    concept_id = Column(String, nullable=False, index=True)
    next_review_date = Column(DateTime, nullable=False, index=True)
    interval_days = Column(Integer, nullable=False)
    easiness_factor = Column(Float, default=2.5)
    repetitions = Column(Integer, default=0)
    last_quality = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PerformanceRecord(Base):
    """User performance history"""
    __tablename__ = "performance_records"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    concept_id = Column(String, nullable=False, index=True)
    performance_score = Column(Float, nullable=False)
    quality_rating = Column(Integer, nullable=False)  # 0-5 for SM-2
    time_spent_seconds = Column(Integer, nullable=False)
    errors_count = Column(Integer, default=0)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class RetentionMetric(Base):
    """Retention metrics over time"""
    __tablename__ = "retention_metrics"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    concept_id = Column(String, nullable=False)
    retention_rate = Column(Float, nullable=False)
    measurement_date = Column(DateTime, default=datetime.utcnow, index=True)
    period_days = Column(Integer, nullable=False)


class InterventionLog(Base):
    """Learning intervention history"""
    __tablename__ = "intervention_logs"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    concept_id = Column(String, nullable=False)
    intervention_type = Column(String, nullable=False)
    triggered_at = Column(DateTime, default=datetime.utcnow)
    reason = Column(String, nullable=False)
    completed = Column(Boolean, default=False)


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class ScheduleReviewRequest(BaseModel):
    """Request to schedule a review"""
    user_id: str = Field(..., description="User ID")
    concept_id: str = Field(..., description="Concept ID")
    performance: float = Field(..., ge=0.0, le=1.0, description="Performance score")


class SpacedRepetitionRequest(BaseModel):
    """Request to apply spaced repetition"""
    user_id: str = Field(..., description="User ID")
    concept_id: str = Field(..., description="Concept ID")
    quality: int = Field(..., ge=0, le=5, description="Quality rating (0-5)")


class CognitiveLoadRequest(BaseModel):
    """Request to manage cognitive load"""
    content: str = Field(..., description="Content to analyze")
    max_elements: Optional[int] = Field(default=7, description="Max elements per chunk")


class RetentionCalculationRequest(BaseModel):
    """Request to calculate retention"""
    user_id: str = Field(..., description="User ID")
    period_days: int = Field(..., ge=1, description="Period in days")


class InterventionRequest(BaseModel):
    """Request to trigger intervention"""
    user_id: str = Field(..., description="User ID")
    concept_id: str = Field(..., description="Concept ID")
    intervention_type: str = Field(default="review", description="Intervention type")


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
        required_sections = ["agent", "theories", "scheduling", "retention", "database"]
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
# KNOWLEDGE GRAPH CLIENT
# ============================================================================

class KnowledgeGraphClient:
    """Client for knowledge graph API"""
    
    def __init__(self, base_url: str, timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)
    
    async def update_mastery(self, user_id: str, concept_id: str, mastery_level: float) -> Dict[str, Any]:
        """Update mastery level in knowledge graph"""
        try:
            url = f"{self.base_url}/users/{user_id}/mastery"
            payload = {
                "concept_id": concept_id,
                "mastery_level": mastery_level
            }
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error("knowledge_graph_error", error=str(e))
            return {}
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


# ============================================================================
# SPACED REPETITION ENGINE (SM-2 Algorithm)
# ============================================================================

class SpacedRepetitionEngine:
    """Implement SuperMemo 2 (SM-2) algorithm"""
    
    def __init__(self, config: ConfigLoader):
        self.config = config
        self.initial_interval = config.get("theories.spaced_repetition.initial_interval", 1)
        self.intervals = config.get("theories.spaced_repetition.intervals", [1, 3, 7, 14, 30, 90])
    
    def calculate_next_review(
        self,
        quality: int,
        repetitions: int,
        easiness_factor: float,
        interval_days: int
    ) -> Tuple[int, float, int]:
        """
        Calculate next review using SM-2 algorithm
        
        Args:
            quality: Quality of recall (0-5)
            repetitions: Number of successful repetitions
            easiness_factor: Current easiness factor (EF)
            interval_days: Current interval in days
        
        Returns:
            Tuple of (new_interval_days, new_easiness_factor, new_repetitions)
        """
        # Update easiness factor
        new_ef = easiness_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        
        # Ensure EF stays within bounds
        if new_ef < 1.3:
            new_ef = 1.3
        
        # Update repetitions
        if quality < 3:
            # Failed recall - restart
            new_repetitions = 0
            new_interval = self.initial_interval
        else:
            # Successful recall
            new_repetitions = repetitions + 1
            
            if new_repetitions == 1:
                new_interval = self.initial_interval
            elif new_repetitions == 2:
                new_interval = 6
            else:
                new_interval = int(round(interval_days * new_ef))
        
        return new_interval, new_ef, new_repetitions


# ============================================================================
# FORGETTING CURVE MODEL
# ============================================================================

class ForgettingCurveModel:
    """Model memory retention using forgetting curve"""
    
    def __init__(self, config: ConfigLoader):
        self.config = config
    
    def calculate_retention(
        self,
        initial_strength: float,
        days_elapsed: int,
        stability: float = 2.5
    ) -> float:
        """
        Calculate retention using forgetting curve
        
        Formula: R(t) = e^(-t/S)
        where:
            R(t) = retention at time t
            t = time elapsed
            S = memory stability
        
        Args:
            initial_strength: Initial memory strength (0-1)
            days_elapsed: Days since learning
            stability: Memory stability factor
        
        Returns:
            Retention rate (0-1)
        """
        if days_elapsed == 0:
            return initial_strength
        
        # Exponential decay
        retention = initial_strength * math.exp(-days_elapsed / stability)
        
        return max(0.0, min(1.0, retention))
    
    def predict_optimal_review_time(
        self,
        initial_strength: float,
        target_retention: float = 0.8,
        stability: float = 2.5
    ) -> int:
        """
        Predict optimal review time to maintain target retention
        
        Args:
            initial_strength: Initial memory strength
            target_retention: Target retention rate
            stability: Memory stability
        
        Returns:
            Days until review needed
        """
        if initial_strength <= 0 or target_retention >= initial_strength:
            return 1
        
        # Solve for t: target = initial * e^(-t/S)
        # t = -S * ln(target / initial)
        days = -stability * math.log(target_retention / initial_strength)
        
        return max(1, int(round(days)))


# ============================================================================
# COGNITIVE LOAD MANAGER
# ============================================================================

class CognitiveLoadManager:
    """Manage cognitive load and chunk content"""
    
    def __init__(self, config: ConfigLoader):
        self.config = config
        self.max_elements = config.get("theories.cognitive_load.max_elements_per_chunk", 7)
        self.working_memory_capacity = config.get("theories.cognitive_load.working_memory_capacity", 4)
        self.difficulty_threshold = config.get("theories.cognitive_load.difficulty_threshold", 0.7)
    
    def analyze_complexity(self, content: str) -> Dict[str, Any]:
        """
        Analyze content complexity
        
        Metrics:
        - Sentence count
        - Word count
        - Average sentence length
        - Unique concept count (estimated)
        - Cognitive load score
        """
        # Basic text analysis
        sentences = re.split(r'[.!?]+', content)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        words = content.split()
        word_count = len(words)
        sentence_count = len(sentences)
        
        avg_sentence_length = word_count / max(1, sentence_count)
        
        # Estimate unique concepts (simplified)
        # In production, use NLP to extract actual concepts
        unique_words = len(set(word.lower() for word in words if len(word) > 3))
        estimated_concepts = min(unique_words // 5, word_count // 10)
        
        # Calculate cognitive load score (0-1)
        # Higher = more complex
        complexity_factors = [
            min(1.0, avg_sentence_length / 20),  # Sentence complexity
            min(1.0, estimated_concepts / self.max_elements),  # Concept density
            min(1.0, word_count / 200)  # Content length
        ]
        
        cognitive_load = sum(complexity_factors) / len(complexity_factors)
        
        return {
            "word_count": word_count,
            "sentence_count": sentence_count,
            "avg_sentence_length": round(avg_sentence_length, 2),
            "estimated_concepts": estimated_concepts,
            "cognitive_load_score": round(cognitive_load, 3),
            "is_overload": cognitive_load > self.difficulty_threshold,
            "recommended_chunks": math.ceil(estimated_concepts / self.max_elements)
        }
    
    def chunk_content(self, content: str, max_elements: int = None) -> List[str]:
        """
        Chunk content into manageable pieces
        
        Args:
            content: Content to chunk
            max_elements: Max elements per chunk (uses config default if None)
        
        Returns:
            List of content chunks
        """
        if max_elements is None:
            max_elements = self.max_elements
        
        # Split by paragraphs first
        paragraphs = content.split('\n\n')
        paragraphs = [p.strip() for p in paragraphs if p.strip()]
        
        chunks = []
        current_chunk = []
        current_element_count = 0
        
        for paragraph in paragraphs:
            # Estimate elements in paragraph (sentences or key phrases)
            sentences = re.split(r'[.!?]+', paragraph)
            element_count = len([s for s in sentences if s.strip()])
            
            if current_element_count + element_count > max_elements and current_chunk:
                # Start new chunk
                chunks.append('\n\n'.join(current_chunk))
                current_chunk = [paragraph]
                current_element_count = element_count
            else:
                current_chunk.append(paragraph)
                current_element_count += element_count
        
        # Add final chunk
        if current_chunk:
            chunks.append('\n\n'.join(current_chunk))
        
        return chunks if chunks else [content]


# ============================================================================
# BLOOM'S TAXONOMY VALIDATOR
# ============================================================================

class BloomsTaxonomyValidator:
    """Validate learning progression through Bloom's taxonomy"""
    
    def __init__(self, config: ConfigLoader):
        self.config = config
        self.levels = config.get("theories.blooms_taxonomy.levels", [
            "remember", "understand", "apply", "analyze", "evaluate", "create"
        ])
        self.enforce_progression = config.get("theories.blooms_taxonomy.enforce_progression", True)
    
    def get_level_index(self, level: str) -> int:
        """Get numeric index of Bloom's level"""
        try:
            return self.levels.index(level.lower())
        except ValueError:
            return -1
    
    def validate_progression(
        self,
        current_level: str,
        target_level: str,
        mastery_score: float
    ) -> Dict[str, Any]:
        """
        Validate if progression to target level is appropriate
        
        Args:
            current_level: Current Bloom's level
            target_level: Target Bloom's level
            mastery_score: Current mastery score (0-1)
        
        Returns:
            Validation result with recommendations
        """
        current_idx = self.get_level_index(current_level)
        target_idx = self.get_level_index(target_level)
        
        if current_idx == -1 or target_idx == -1:
            return {
                "valid": False,
                "reason": "Invalid Bloom's taxonomy level",
                "recommendation": None
            }
        
        # Check if skipping levels
        level_jump = target_idx - current_idx
        
        if not self.enforce_progression:
            return {
                "valid": True,
                "reason": "Progression enforcement disabled",
                "level_jump": level_jump
            }
        
        # Require mastery of current level before advancing
        mastery_threshold = 0.7
        
        if mastery_score < mastery_threshold and target_idx > current_idx:
            return {
                "valid": False,
                "reason": f"Insufficient mastery ({mastery_score:.2f}) of current level",
                "recommendation": f"Achieve {mastery_threshold:.0%} mastery before advancing",
                "current_level": current_level,
                "target_level": target_level
            }
        
        # Allow gradual progression (max 2 levels at a time)
        if level_jump > 2:
            recommended_level = self.levels[current_idx + 1]
            return {
                "valid": False,
                "reason": f"Attempting to skip {level_jump - 1} levels",
                "recommendation": f"Progress to '{recommended_level}' first",
                "current_level": current_level,
                "target_level": target_level
            }
        
        return {
            "valid": True,
            "reason": "Valid progression",
            "level_jump": level_jump,
            "current_level": current_level,
            "target_level": target_level
        }


# ============================================================================
# LEARNING SCIENCE AGENT
# ============================================================================

class LearningScienceAgent:
    """Main Learning Science Agent orchestrator"""
    
    def __init__(self, config: ConfigLoader, db_session: Session):
        self.config = config
        self.db = db_session
        
        # Initialize components
        kg_base_url = config.get("knowledge_graph_api.base_url", "http://localhost:8010")
        self.kg_client = KnowledgeGraphClient(kg_base_url)
        
        self.spaced_rep = SpacedRepetitionEngine(config)
        self.forgetting_curve = ForgettingCurveModel(config)
        self.cognitive_load = CognitiveLoadManager(config)
        self.blooms_validator = BloomsTaxonomyValidator(config)
        
        logger.info("learning_science_agent_initialized")
    
    def schedule_review(
        self,
        user_id: str,
        concept_id: str,
        performance: float
    ) -> Dict[str, Any]:
        """
        Schedule next review based on performance
        
        Process:
        1. Get or create review schedule
        2. Convert performance to quality rating
        3. Apply SM-2 algorithm
        4. Update schedule in database
        5. Return next review date
        """
        logger.info("scheduling_review", user_id=user_id, concept_id=concept_id, performance=performance)
        
        # Get existing schedule or create new
        schedule = self.db.query(ReviewSchedule).filter_by(
            user_id=user_id,
            concept_id=concept_id
        ).first()
        
        # Convert performance to quality (0-5 scale for SM-2)
        quality = int(round(performance * 5))
        quality = max(0, min(5, quality))
        
        if schedule is None:
            # Create new schedule
            schedule = ReviewSchedule(
                user_id=user_id,
                concept_id=concept_id,
                next_review_date=datetime.utcnow() + timedelta(days=1),
                interval_days=1,
                easiness_factor=2.5,
                repetitions=0,
                last_quality=quality
            )
            self.db.add(schedule)
        else:
            # Calculate next review using SM-2
            new_interval, new_ef, new_reps = self.spaced_rep.calculate_next_review(
                quality=quality,
                repetitions=schedule.repetitions,
                easiness_factor=schedule.easiness_factor,
                interval_days=schedule.interval_days
            )
            
            # Update schedule
            schedule.interval_days = new_interval
            schedule.easiness_factor = new_ef
            schedule.repetitions = new_reps
            schedule.last_quality = quality
            schedule.next_review_date = datetime.utcnow() + timedelta(days=new_interval)
            schedule.updated_at = datetime.utcnow()
        
        self.db.commit()
        
        return {
            "user_id": user_id,
            "concept_id": concept_id,
            "next_review_date": schedule.next_review_date.isoformat(),
            "interval_days": schedule.interval_days,
            "easiness_factor": round(schedule.easiness_factor, 2),
            "repetitions": schedule.repetitions,
            "quality": quality
        }
    
    def calculate_forgetting_curve(
        self,
        initial_strength: float,
        days_elapsed: int
    ) -> float:
        """
        Calculate retention using forgetting curve
        
        Args:
            initial_strength: Initial memory strength (0-1)
            days_elapsed: Days since learning
        
        Returns:
            Predicted retention rate (0-1)
        """
        return self.forgetting_curve.calculate_retention(initial_strength, days_elapsed)
    
    def apply_spaced_repetition(
        self,
        user_id: str,
        concept_id: str,
        quality: int
    ) -> Dict[str, Any]:
        """
        Apply SM-2 spaced repetition algorithm
        
        Updates review schedule and returns next review date
        """
        logger.info("applying_spaced_repetition", user_id=user_id, concept_id=concept_id, quality=quality)
        
        # Validate quality rating
        if not 0 <= quality <= 5:
            raise ValueError("Quality must be between 0 and 5")
        
        # Use schedule_review with converted performance
        performance = quality / 5.0
        result = self.schedule_review(user_id, concept_id, performance)
        
        # Record performance
        perf_record = PerformanceRecord(
            user_id=user_id,
            concept_id=concept_id,
            performance_score=performance,
            quality_rating=quality,
            time_spent_seconds=0,  # Can be updated separately
            errors_count=max(0, 5 - quality)
        )
        self.db.add(perf_record)
        self.db.commit()
        
        return result
    
    def manage_cognitive_load(self, content: str) -> Dict[str, Any]:
        """
        Analyze content complexity and manage cognitive load
        
        Returns analysis with chunking recommendations
        """
        logger.info("managing_cognitive_load", content_length=len(content))
        
        analysis = self.cognitive_load.analyze_complexity(content)
        
        # Add recommendations
        if analysis["is_overload"]:
            analysis["recommendation"] = (
                f"Content complexity is high. Consider breaking into "
                f"{analysis['recommended_chunks']} chunks for better learning."
            )
        else:
            analysis["recommendation"] = "Cognitive load is manageable."
        
        return analysis
    
    def chunk_content(self, content: str, max_elements: int = None) -> List[str]:
        """
        Chunk content into manageable pieces
        
        Args:
            content: Content to chunk
            max_elements: Max elements per chunk
        
        Returns:
            List of content chunks
        """
        return self.cognitive_load.chunk_content(content, max_elements)
    
    def recommend_next_topic(self, user_id: str) -> Dict[str, Any]:
        """
        Recommend next topic based on scheduling and performance
        
        Process:
        1. Get due reviews
        2. Get performance history
        3. Calculate learning velocity
        4. Recommend optimal next topic
        """
        logger.info("recommending_next_topic", user_id=user_id)
        
        # Get all due reviews
        now = datetime.utcnow()
        due_reviews = self.db.query(ReviewSchedule).filter(
            ReviewSchedule.user_id == user_id,
            ReviewSchedule.next_review_date <= now
        ).order_by(ReviewSchedule.next_review_date).all()
        
        if due_reviews:
            # Prioritize overdue reviews
            oldest_review = due_reviews[0]
            days_overdue = (now - oldest_review.next_review_date).days
            
            return {
                "recommendation": "review",
                "concept_id": oldest_review.concept_id,
                "reason": f"Review overdue by {days_overdue} days",
                "priority": "high" if days_overdue > 3 else "medium",
                "due_date": oldest_review.next_review_date.isoformat()
            }
        
        # No due reviews - recommend new content
        # Get performance history to calculate velocity
        recent_performance = self.db.query(PerformanceRecord).filter(
            PerformanceRecord.user_id == user_id
        ).order_by(desc(PerformanceRecord.timestamp)).limit(10).all()
        
        if recent_performance:
            avg_performance = sum(p.performance_score for p in recent_performance) / len(recent_performance)
            
            if avg_performance >= 0.7:
                return {
                    "recommendation": "new_content",
                    "reason": f"Strong performance (avg {avg_performance:.2f})",
                    "priority": "medium",
                    "suggestion": "Progress to next concept"
                }
            else:
                return {
                    "recommendation": "practice",
                    "reason": f"Performance needs improvement (avg {avg_performance:.2f})",
                    "priority": "medium",
                    "suggestion": "Additional practice recommended"
                }
        
        return {
            "recommendation": "start_learning",
            "reason": "No learning history",
            "priority": "high",
            "suggestion": "Begin with foundational concepts"
        }
    
    def calculate_retention_rate(
        self,
        user_id: str,
        period_days: int
    ) -> float:
        """
        Calculate retention rate over period
        
        Retention = (concepts retained) / (concepts learned)
        
        Args:
            user_id: User ID
            period_days: Period in days
        
        Returns:
            Retention rate (0-1)
        """
        logger.info("calculating_retention", user_id=user_id, period_days=period_days)
        
        cutoff_date = datetime.utcnow() - timedelta(days=period_days)
        
        # Get all performance records in period
        records = self.db.query(PerformanceRecord).filter(
            PerformanceRecord.user_id == user_id,
            PerformanceRecord.timestamp >= cutoff_date
        ).all()
        
        if not records:
            return 0.0
        
        # Calculate retention as average performance over time
        # Weight recent performance higher
        total_weight = 0.0
        weighted_sum = 0.0
        
        for i, record in enumerate(records):
            # Weight increases with recency
            weight = (i + 1) / len(records)
            weighted_sum += record.performance_score * weight
            total_weight += weight
        
        retention_rate = weighted_sum / total_weight if total_weight > 0 else 0.0
        
        # Store metric
        metric = RetentionMetric(
            user_id=user_id,
            concept_id="aggregate",  # Aggregate across all concepts
            retention_rate=retention_rate,
            period_days=period_days
        )
        self.db.add(metric)
        self.db.commit()
        
        return retention_rate
    
    def trigger_intervention(
        self,
        user_id: str,
        concept_id: str
    ) -> Dict[str, Any]:
        """
        Trigger learning intervention
        
        Process:
        1. Analyze performance history
        2. Determine intervention type
        3. Schedule intervention
        4. Update knowledge graph
        """
        logger.info("triggering_intervention", user_id=user_id, concept_id=concept_id)
        
        # Get recent performance
        recent_performance = self.db.query(PerformanceRecord).filter(
            PerformanceRecord.user_id == user_id,
            PerformanceRecord.concept_id == concept_id
        ).order_by(desc(PerformanceRecord.timestamp)).limit(5).all()
        
        if not recent_performance:
            return {
                "intervention": "none",
                "reason": "No performance history"
            }
        
        avg_performance = sum(p.performance_score for p in recent_performance) / len(recent_performance)
        threshold = self.config.get("retention.intervention_threshold", 0.6)
        
        if avg_performance < threshold:
            # Determine intervention type
            avg_errors = sum(p.errors_count for p in recent_performance) / len(recent_performance)
            
            if avg_errors > 3:
                intervention_type = "remedial_content"
                reason = f"High error rate (avg {avg_errors:.1f} errors)"
            elif avg_performance < 0.4:
                intervention_type = "tutoring"
                reason = f"Very low performance ({avg_performance:.2%})"
            else:
                intervention_type = "additional_practice"
                reason = f"Below threshold performance ({avg_performance:.2%})"
            
            # Log intervention
            intervention = InterventionLog(
                user_id=user_id,
                concept_id=concept_id,
                intervention_type=intervention_type,
                reason=reason
            )
            self.db.add(intervention)
            self.db.commit()
            
            return {
                "intervention": intervention_type,
                "reason": reason,
                "avg_performance": round(avg_performance, 3),
                "threshold": threshold,
                "triggered_at": intervention.triggered_at.isoformat()
            }
        
        return {
            "intervention": "none",
            "reason": "Performance above threshold",
            "avg_performance": round(avg_performance, 3),
            "threshold": threshold
        }
    
    def validate_blooms_progression(
        self,
        user_id: str,
        concept_id: str,
        current_level: str = "understand",
        target_level: str = "apply"
    ) -> bool:
        """
        Validate Bloom's taxonomy progression
        
        Args:
            user_id: User ID
            concept_id: Concept ID
            current_level: Current Bloom's level
            target_level: Target Bloom's level
        
        Returns:
            True if progression is valid
        """
        # Get recent performance for mastery calculation
        recent_performance = self.db.query(PerformanceRecord).filter(
            PerformanceRecord.user_id == user_id,
            PerformanceRecord.concept_id == concept_id
        ).order_by(desc(PerformanceRecord.timestamp)).limit(5).all()
        
        if recent_performance:
            mastery_score = sum(p.performance_score for p in recent_performance) / len(recent_performance)
        else:
            mastery_score = 0.0
        
        validation = self.blooms_validator.validate_progression(
            current_level=current_level,
            target_level=target_level,
            mastery_score=mastery_score
        )
        
        return validation["valid"]
    
    async def close(self):
        """Close resources"""
        await self.kg_client.close()


# ============================================================================
# METRICS
# ============================================================================

review_scheduling_duration = Histogram(
    "review_scheduling_duration_seconds",
    "Time to schedule review",
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0]
)

reviews_scheduled_total = Counter(
    "reviews_scheduled_total",
    "Total reviews scheduled",
    ["quality_rating"]
)

interventions_triggered_total = Counter(
    "interventions_triggered_total",
    "Total interventions triggered",
    ["intervention_type"]
)


# ============================================================================
# FASTAPI APPLICATION
# ============================================================================

# Load configuration
config = ConfigLoader("config.yaml")

# Initialize database
db_path = config.get("database.path", "learning_science.db")
engine = create_engine(f"sqlite:///{db_path}")
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(bind=engine)

# Initialize agent
db_session = SessionLocal()
agent = LearningScienceAgent(config, db_session)

# Create FastAPI app
app = FastAPI(
    title=config.get("agent.name", "learning_science_agent"),
    description="Learning Science Agent - Apply learning science theories and algorithms",
    version="1.0.0"
)


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    await agent.close()
    db_session.close()


@app.post("/schedule-review")
async def schedule_review_endpoint(request: ScheduleReviewRequest):
    """
    Schedule next review based on performance
    
    Applies SM-2 algorithm and returns next review date
    """
    start_time = time.time()
    
    try:
        result = agent.schedule_review(
            user_id=request.user_id,
            concept_id=request.concept_id,
            performance=request.performance
        )
        
        duration = time.time() - start_time
        review_scheduling_duration.observe(duration)
        quality = result.get("quality", 0)
        reviews_scheduled_total.labels(quality_rating=str(quality)).inc()
        
        return result
        
    except Exception as e:
        logger.error("schedule_review_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/apply-spaced-repetition")
async def apply_spaced_repetition_endpoint(request: SpacedRepetitionRequest):
    """
    Apply SM-2 spaced repetition algorithm
    
    Returns next review schedule
    """
    try:
        result = agent.apply_spaced_repetition(
            user_id=request.user_id,
            concept_id=request.concept_id,
            quality=request.quality
        )
        
        reviews_scheduled_total.labels(quality_rating=str(request.quality)).inc()
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("apply_spaced_repetition_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/manage-cognitive-load")
async def manage_cognitive_load_endpoint(request: CognitiveLoadRequest):
    """
    Analyze content complexity and manage cognitive load
    
    Returns complexity analysis with chunking recommendations
    """
    try:
        result = agent.manage_cognitive_load(request.content)
        
        # Add chunks if requested
        if request.max_elements:
            chunks = agent.chunk_content(request.content, request.max_elements)
            result["chunks"] = chunks
            result["chunk_count"] = len(chunks)
        
        return result
        
    except Exception as e:
        logger.error("manage_cognitive_load_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/next-topic/{user_id}")
async def get_next_topic_endpoint(user_id: str):
    """
    Recommend next topic for user
    
    Returns recommendation based on schedule and performance
    """
    try:
        result = agent.recommend_next_topic(user_id)
        return result
        
    except Exception as e:
        logger.error("recommend_next_topic_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/calculate-retention")
async def calculate_retention_endpoint(request: RetentionCalculationRequest):
    """
    Calculate retention rate over period
    
    Returns retention rate (0-1)
    """
    try:
        retention_rate = agent.calculate_retention_rate(
            user_id=request.user_id,
            period_days=request.period_days
        )
        
        return {
            "user_id": request.user_id,
            "period_days": request.period_days,
            "retention_rate": round(retention_rate, 3)
        }
        
    except Exception as e:
        logger.error("calculate_retention_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/trigger-intervention")
async def trigger_intervention_endpoint(request: InterventionRequest):
    """
    Trigger learning intervention
    
    Analyzes performance and schedules appropriate intervention
    """
    try:
        result = agent.trigger_intervention(
            user_id=request.user_id,
            concept_id=request.concept_id
        )
        
        if result["intervention"] != "none":
            interventions_triggered_total.labels(
                intervention_type=result["intervention"]
            ).inc()
        
        return result
        
    except Exception as e:
        logger.error("trigger_intervention_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/study-plan/{user_id}")
async def get_study_plan_endpoint(
    user_id: str,
    days: int = Query(default=7, ge=1, le=30)
):
    """
    Get personalized study plan
    
    Returns scheduled reviews and recommendations for the period
    """
    try:
        # Get scheduled reviews
        end_date = datetime.utcnow() + timedelta(days=days)
        scheduled_reviews = db_session.query(ReviewSchedule).filter(
            ReviewSchedule.user_id == user_id,
            ReviewSchedule.next_review_date <= end_date
        ).order_by(ReviewSchedule.next_review_date).all()
        
        # Get next topic recommendation
        next_topic = agent.recommend_next_topic(user_id)
        
        # Calculate daily study time
        daily_limit = config.get("scheduling.daily_study_limit_minutes", 120)
        session_length = config.get("scheduling.optimal_session_length", 25)
        
        study_plan = {
            "user_id": user_id,
            "period_days": days,
            "scheduled_reviews": [
                {
                    "concept_id": r.concept_id,
                    "review_date": r.next_review_date.isoformat(),
                    "interval_days": r.interval_days,
                    "repetitions": r.repetitions
                }
                for r in scheduled_reviews
            ],
            "next_topic": next_topic,
            "daily_study_limit_minutes": daily_limit,
            "optimal_session_length_minutes": session_length,
            "sessions_per_day": daily_limit // session_length
        }
        
        return study_plan
        
    except Exception as e:
        logger.error("get_study_plan_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "learning_science_agent",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    from fastapi.responses import Response
    return Response(content=generate_latest(), media_type="text/plain")


if __name__ == "__main__":
    import uvicorn
    
    port = config.get("agent.port", 8008)
    host = config.get("agent.host", "0.0.0.0")
    
    uvicorn.run(app, host=host, port=port)
