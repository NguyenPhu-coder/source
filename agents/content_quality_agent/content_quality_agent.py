"""
Content Quality Agent for Learn Your Way Platform

Provides comprehensive content validation including fact-checking, safety scanning,
plagiarism detection, bias detection, quality scoring, and human review queue.

Architecture:
- Fact-checking via Knowledge Graph API
- ML models for safety and bias detection
- Embedding-based plagiarism detection
- Age-appropriate filtering (COPPA compliant)
- Human review queue system
"""

import asyncio
import json
import logging
import re
import time
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from enum import Enum
from dataclasses import dataclass, asdict
from collections import deque
import hashlib
import uuid

import yaml
import numpy as np
import torch
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    pipeline
)
from sentence_transformers import SentenceTransformer
from detoxify import Detoxify
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import httpx
import structlog


# ============================================================================
# Configuration and Data Models
# ============================================================================

class ContentType(str, Enum):
    """Content types"""
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"


class SafetyIssue(str, Enum):
    """Safety issues"""
    PROFANITY = "profanity"
    VIOLENCE = "violence"
    NSFW = "nsfw"
    HATE_SPEECH = "hate_speech"
    SELF_HARM = "self_harm"


class BiasType(str, Enum):
    """Bias types"""
    GENDER = "gender"
    RACIAL = "racial"
    CULTURAL = "cultural"
    AGE = "age"
    SOCIOECONOMIC = "socioeconomic"


class ReviewPriority(str, Enum):
    """Review priorities"""
    SAFETY_FAIL = "safety_fail"
    LOW_QUALITY = "low_quality"
    BIAS_DETECTED = "bias_detected"
    PLAGIARISM = "plagiarism"
    MANUAL_REQUEST = "manual_request"


@dataclass
class FactCheckResult:
    """Fact-checking result"""
    claims: List[Dict[str, Any]]
    verified_count: int
    unverified_count: int
    confidence: float
    sources: List[str]
    passed: bool


@dataclass
class SafetyCheckResult:
    """Safety check result"""
    age_appropriate: bool
    issues_found: List[SafetyIssue]
    toxicity_score: float
    profanity_detected: bool
    violence_detected: bool
    nsfw_detected: bool
    hate_speech_detected: bool
    passed: bool
    details: Dict[str, Any]


@dataclass
class PlagiarismResult:
    """Plagiarism check result"""
    similarity_score: float
    matches: List[Dict[str, Any]]
    sources_checked: int
    is_plagiarized: bool
    passed: bool


@dataclass
class BiasResult:
    """Bias detection result"""
    biases_found: List[BiasType]
    bias_scores: Dict[str, float]
    overall_bias_score: float
    passed: bool
    details: Dict[str, Any]


@dataclass
class QualityScore:
    """Quality score"""
    overall_score: float
    accuracy_score: float
    safety_score: float
    originality_score: float
    bias_free_score: float
    passed: bool


@dataclass
class ValidationResult:
    """Complete validation result"""
    content_id: str
    fact_check: Optional[FactCheckResult]
    safety_check: SafetyCheckResult
    plagiarism_check: PlagiarismResult
    bias_check: BiasResult
    quality_score: QualityScore
    passed: bool
    requires_human_review: bool
    review_reason: Optional[str]
    timestamp: float


@dataclass
class ReviewQueueItem:
    """Human review queue item"""
    content_id: str
    content: str
    validation_result: ValidationResult
    priority: ReviewPriority
    queued_at: float
    reviewed: bool = False
    reviewer_id: Optional[str] = None
    review_notes: Optional[str] = None


class ValidateRequest(BaseModel):
    """Validate content request"""
    content: str
    content_type: ContentType
    target_age: Optional[int] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class FactCheckRequest(BaseModel):
    """Fact-check request"""
    content: str
    claims: Optional[List[str]] = None


class SafetyCheckRequest(BaseModel):
    """Safety check request"""
    content: str
    age_group: Optional[str] = None
    target_age: Optional[int] = None


class PlagiarismCheckRequest(BaseModel):
    """Plagiarism check request"""
    content: str


class BiasCheckRequest(BaseModel):
    """Bias check request"""
    content: str


class ApproveRequest(BaseModel):
    """Approve content request"""
    reviewer_id: str
    notes: Optional[str] = None


# ============================================================================
# Fact Checker
# ============================================================================

class FactChecker:
    """Fact-checking using Knowledge Graph API"""
    
    def __init__(
        self,
        knowledge_graph_api: str,
        min_confidence: float = 0.8,
        timeout: int = 30
    ):
        self.kg_api = knowledge_graph_api
        self.min_confidence = min_confidence
        self.timeout = timeout
        self.logger = structlog.get_logger()
        self.client = httpx.AsyncClient(timeout=timeout)
    
    async def check_facts(self, content: str, claims: Optional[List[str]] = None) -> FactCheckResult:
        """Check facts in content"""
        try:
            # Extract claims if not provided
            if not claims:
                claims = self._extract_claims(content)
            
            if not claims:
                return FactCheckResult(
                    claims=[],
                    verified_count=0,
                    unverified_count=0,
                    confidence=1.0,
                    sources=[],
                    passed=True
                )
            
            # Verify each claim
            verified = []
            unverified = []
            all_sources = set()
            
            for claim in claims:
                result = await self._verify_claim(claim)
                
                if result["verified"]:
                    verified.append({
                        "claim": claim,
                        "confidence": result["confidence"],
                        "sources": result["sources"]
                    })
                    all_sources.update(result["sources"])
                else:
                    unverified.append({
                        "claim": claim,
                        "reason": result.get("reason", "Not found in knowledge graph")
                    })
            
            # Calculate overall confidence
            if verified:
                avg_confidence = sum(c["confidence"] for c in verified) / len(verified)
            else:
                avg_confidence = 0.0
            
            passed = (
                len(verified) >= len(claims) * 0.5 and
                avg_confidence >= self.min_confidence
            )
            
            return FactCheckResult(
                claims=verified + unverified,
                verified_count=len(verified),
                unverified_count=len(unverified),
                confidence=avg_confidence,
                sources=list(all_sources),
                passed=passed
            )
        
        except Exception as e:
            self.logger.error("fact_check_failed", error=str(e))
            # Return conservative result on error
            return FactCheckResult(
                claims=[],
                verified_count=0,
                unverified_count=len(claims) if claims else 0,
                confidence=0.0,
                sources=[],
                passed=False
            )
    
    def _extract_claims(self, content: str) -> List[str]:
        """Extract factual claims from content"""
        claims = []
        
        # Split into sentences
        sentences = re.split(r'[.!?]+', content)
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            # Look for factual indicators
            if any(indicator in sentence.lower() for indicator in [
                'is', 'are', 'was', 'were', 'has', 'have', 'discovered',
                'found', 'proved', 'shown', 'demonstrated', 'equals',
                'contains', 'consists', 'located', 'invented', 'born', 'died'
            ]):
                claims.append(sentence)
        
        return claims[:10]  # Limit to 10 claims
    
    async def _verify_claim(self, claim: str) -> Dict[str, Any]:
        """Verify a single claim against knowledge graph"""
        try:
            response = await self.client.post(
                f"{self.kg_api}/query",
                json={"query": claim, "verify": True}
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "verified": data.get("verified", False),
                    "confidence": data.get("confidence", 0.0),
                    "sources": data.get("sources", [])
                }
            else:
                return {
                    "verified": False,
                    "confidence": 0.0,
                    "sources": [],
                    "reason": f"API error: {response.status_code}"
                }
        
        except Exception as e:
            self.logger.warning("claim_verification_failed", claim=claim, error=str(e))
            return {
                "verified": False,
                "confidence": 0.0,
                "sources": [],
                "reason": str(e)
            }
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()


# ============================================================================
# Safety Checker
# ============================================================================

class SafetyChecker:
    """Content safety checking"""
    
    def __init__(
        self,
        config: Dict[str, Any]
    ):
        self.config = config
        self.logger = structlog.get_logger()
        
        # Load detoxify model
        self.detoxify = Detoxify('original')
        
        # Profanity patterns
        self.profanity_patterns = self._load_profanity_patterns()
        
        # Violence keywords
        self.violence_keywords = {
            'kill', 'murder', 'attack', 'assault', 'violence', 'weapon',
            'gun', 'knife', 'blood', 'death', 'harm', 'hurt', 'shoot'
        }
        
        # NSFW keywords
        self.nsfw_keywords = {
            'sexual', 'explicit', 'nude', 'nsfw', 'adult'
        }
    
    def _load_profanity_patterns(self) -> List[re.Pattern]:
        """Load profanity patterns"""
        # Common profanity patterns (simplified for production use real list)
        words = [
            'damn', 'hell', 'crap', 'stupid', 'idiot', 'dumb',
            'suck', 'awful', 'terrible', 'horrible', 'worst'
        ]
        
        return [re.compile(r'\b' + word + r'\b', re.IGNORECASE) for word in words]
    
    async def check_safety(
        self,
        content: str,
        target_age: Optional[int] = None
    ) -> SafetyCheckResult:
        """Check content safety"""
        try:
            issues = []
            details = {}
            
            # Toxicity check using Detoxify
            toxicity = self.detoxify.predict(content)
            toxicity_score = max(toxicity.values())
            details["toxicity"] = toxicity
            
            # Profanity check
            profanity_detected = self._check_profanity(content)
            if profanity_detected:
                issues.append(SafetyIssue.PROFANITY)
            details["profanity"] = profanity_detected
            
            # Violence check
            violence_detected = self._check_violence(content)
            if violence_detected:
                issues.append(SafetyIssue.VIOLENCE)
            details["violence"] = violence_detected
            
            # NSFW check
            nsfw_detected = self._check_nsfw(content)
            if nsfw_detected:
                issues.append(SafetyIssue.NSFW)
            details["nsfw"] = nsfw_detected
            
            # Hate speech check
            hate_speech_detected = toxicity.get('identity_hate', 0) > 0.5
            if hate_speech_detected:
                issues.append(SafetyIssue.HATE_SPEECH)
            details["hate_speech"] = hate_speech_detected
            
            # Self-harm check
            self_harm_detected = self._check_self_harm(content)
            if self_harm_detected:
                issues.append(SafetyIssue.SELF_HARM)
            details["self_harm"] = self_harm_detected
            
            # Age appropriateness
            age_appropriate = True
            if target_age:
                age_appropriate = self._check_age_appropriateness(
                    content,
                    target_age,
                    issues,
                    toxicity_score
                )
            
            # Overall pass/fail
            passed = (
                len(issues) == 0 and
                toxicity_score < 0.5 and
                age_appropriate
            )
            
            return SafetyCheckResult(
                age_appropriate=age_appropriate,
                issues_found=issues,
                toxicity_score=toxicity_score,
                profanity_detected=profanity_detected,
                violence_detected=violence_detected,
                nsfw_detected=nsfw_detected,
                hate_speech_detected=hate_speech_detected,
                passed=passed,
                details=details
            )
        
        except Exception as e:
            self.logger.error("safety_check_failed", error=str(e))
            # Return strict failure on error
            return SafetyCheckResult(
                age_appropriate=False,
                issues_found=[],
                toxicity_score=1.0,
                profanity_detected=False,
                violence_detected=False,
                nsfw_detected=False,
                hate_speech_detected=False,
                passed=False,
                details={"error": str(e)}
            )
    
    def _check_profanity(self, content: str) -> bool:
        """Check for profanity"""
        for pattern in self.profanity_patterns:
            if pattern.search(content):
                return True
        return False
    
    def _check_violence(self, content: str) -> bool:
        """Check for violence"""
        content_lower = content.lower()
        violence_count = sum(1 for keyword in self.violence_keywords if keyword in content_lower)
        return violence_count >= 2  # Need at least 2 keywords
    
    def _check_nsfw(self, content: str) -> bool:
        """Check for NSFW content"""
        content_lower = content.lower()
        return any(keyword in content_lower for keyword in self.nsfw_keywords)
    
    def _check_self_harm(self, content: str) -> bool:
        """Check for self-harm content"""
        self_harm_keywords = {
            'suicide', 'self-harm', 'cut myself', 'kill myself',
            'end my life', 'want to die'
        }
        content_lower = content.lower()
        return any(keyword in content_lower for keyword in self_harm_keywords)
    
    def _check_age_appropriateness(
        self,
        content: str,
        target_age: int,
        issues: List[SafetyIssue],
        toxicity_score: float
    ) -> bool:
        """Check age appropriateness (COPPA compliant)"""
        # COPPA requires special handling for under 13
        if target_age < 13:
            # Strict requirements for young children
            if issues or toxicity_score > 0.1:
                return False
        
        # Age-based thresholds
        if target_age < 6:
            return toxicity_score < 0.05
        elif target_age < 12:
            return toxicity_score < 0.2 and SafetyIssue.VIOLENCE not in issues
        elif target_age < 16:
            return toxicity_score < 0.4
        else:
            return toxicity_score < 0.6
    
    def check_age_appropriateness(self, content: str, target_age: int) -> bool:
        """Public method for age appropriateness check"""
        # Run basic toxicity check
        toxicity = self.detoxify.predict(content)
        toxicity_score = max(toxicity.values())
        
        # Check for issues
        issues = []
        if self._check_profanity(content):
            issues.append(SafetyIssue.PROFANITY)
        if self._check_violence(content):
            issues.append(SafetyIssue.VIOLENCE)
        if self._check_nsfw(content):
            issues.append(SafetyIssue.NSFW)
        
        return self._check_age_appropriateness(content, target_age, issues, toxicity_score)


# ============================================================================
# Plagiarism Detector
# ============================================================================

class PlagiarismDetector:
    """Plagiarism detection using embeddings"""
    
    def __init__(
        self,
        similarity_threshold: float = 0.7,
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    ):
        self.similarity_threshold = similarity_threshold
        self.logger = structlog.get_logger()
        
        # Load embedding model
        self.model = SentenceTransformer(model_name)
        
        # In-memory database of known content (in production, use real DB)
        self.known_content: Dict[str, Dict[str, Any]] = {}
        self._initialize_known_content()
    
    def _initialize_known_content(self):
        """Initialize database with known content"""
        # Sample educational content (in production, load from database)
        samples = [
            {
                "id": "wiki_001",
                "text": "The water cycle describes how water evaporates from the surface of the earth, rises into the atmosphere, cools and condenses into rain or snow in clouds.",
                "source": "wikipedia"
            },
            {
                "id": "edu_001",
                "text": "Photosynthesis is a process used by plants and other organisms to convert light energy into chemical energy.",
                "source": "educational_db"
            },
            {
                "id": "edu_002",
                "text": "The Pythagorean theorem states that in a right-angled triangle, the square of the hypotenuse is equal to the sum of squares of the other two sides.",
                "source": "educational_db"
            }
        ]
        
        for sample in samples:
            embedding = self.model.encode(sample["text"])
            self.known_content[sample["id"]] = {
                "text": sample["text"],
                "source": sample["source"],
                "embedding": embedding
            }
    
    async def check_plagiarism(self, content: str) -> PlagiarismResult:
        """Check for plagiarism"""
        try:
            # Generate embedding for input content
            content_embedding = self.model.encode(content)
            
            # Compare with known content
            matches = []
            
            for content_id, known in self.known_content.items():
                similarity = self._cosine_similarity(
                    content_embedding,
                    known["embedding"]
                )
                
                if similarity >= self.similarity_threshold:
                    matches.append({
                        "content_id": content_id,
                        "similarity": float(similarity),
                        "source": known["source"],
                        "text_snippet": known["text"][:100]
                    })
            
            # Sort by similarity
            matches.sort(key=lambda x: x["similarity"], reverse=True)
            
            is_plagiarized = len(matches) > 0
            max_similarity = max([m["similarity"] for m in matches]) if matches else 0.0
            
            return PlagiarismResult(
                similarity_score=max_similarity,
                matches=matches,
                sources_checked=len(self.known_content),
                is_plagiarized=is_plagiarized,
                passed=not is_plagiarized
            )
        
        except Exception as e:
            self.logger.error("plagiarism_check_failed", error=str(e))
            return PlagiarismResult(
                similarity_score=0.0,
                matches=[],
                sources_checked=0,
                is_plagiarized=False,
                passed=True  # Assume innocent on error
            )
    
    def _cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """Calculate cosine similarity"""
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    def add_content(self, content_id: str, text: str, source: str):
        """Add content to database"""
        embedding = self.model.encode(text)
        self.known_content[content_id] = {
            "text": text,
            "source": source,
            "embedding": embedding
        }


# ============================================================================
# Bias Detector
# ============================================================================

class BiasDetector:
    """Detect various types of bias in content"""
    
    def __init__(
        self,
        threshold: float = 0.6,
        model_name: str = "bert-base-uncased"
    ):
        self.threshold = threshold
        self.logger = structlog.get_logger()
        
        # Bias patterns and keywords
        self.bias_patterns = self._initialize_bias_patterns()
    
    def _initialize_bias_patterns(self) -> Dict[BiasType, Dict[str, Any]]:
        """Initialize bias detection patterns"""
        return {
            BiasType.GENDER: {
                "keywords": [
                    "boys are", "girls are", "men should", "women should",
                    "he is good at", "she is good at", "males are better",
                    "females are better", "women can't", "men can't"
                ],
                "stereotypes": [
                    "women are emotional", "men are strong", "girls like pink",
                    "boys like blue", "women drivers", "men don't cry"
                ]
            },
            BiasType.RACIAL: {
                "keywords": [
                    "all [race] are", "[race] people are", "[race] always",
                    "[race] never", "[race] can't"
                ],
                "stereotypes": []
            },
            BiasType.CULTURAL: {
                "keywords": [
                    "all [culture] people", "[culture] always", "typical [culture]",
                    "[culture] tradition is wrong", "[culture] is primitive"
                ],
                "stereotypes": []
            },
            BiasType.AGE: {
                "keywords": [
                    "old people can't", "young people are lazy",
                    "millennials are", "boomers are", "too old to",
                    "too young to", "elderly people don't understand"
                ],
                "stereotypes": [
                    "old people and technology", "young people are entitled"
                ]
            },
            BiasType.SOCIOECONOMIC: {
                "keywords": [
                    "poor people are", "rich people are", "wealthy always",
                    "working class", "lower class", "upper class",
                    "can't afford means", "poverty causes"
                ],
                "stereotypes": []
            }
        }
    
    async def detect_bias(self, content: str) -> BiasResult:
        """Detect bias in content"""
        try:
            biases_found = []
            bias_scores = {}
            details = {}
            
            content_lower = content.lower()
            
            # Check each bias type
            for bias_type, patterns in self.bias_patterns.items():
                score = 0.0
                matches = []
                
                # Check keywords
                for keyword in patterns["keywords"]:
                    if keyword.lower() in content_lower:
                        score += 0.3
                        matches.append(keyword)
                
                # Check stereotypes
                for stereotype in patterns["stereotypes"]:
                    if stereotype.lower() in content_lower:
                        score += 0.5
                        matches.append(stereotype)
                
                # Normalize score
                score = min(score, 1.0)
                bias_scores[bias_type.value] = score
                
                if score >= self.threshold:
                    biases_found.append(bias_type)
                
                if matches:
                    details[bias_type.value] = matches
            
            # Calculate overall bias score
            overall_score = max(bias_scores.values()) if bias_scores else 0.0
            
            passed = len(biases_found) == 0
            
            return BiasResult(
                biases_found=biases_found,
                bias_scores=bias_scores,
                overall_bias_score=overall_score,
                passed=passed,
                details=details
            )
        
        except Exception as e:
            self.logger.error("bias_detection_failed", error=str(e))
            return BiasResult(
                biases_found=[],
                bias_scores={},
                overall_bias_score=0.0,
                passed=True,  # Assume no bias on error
                details={"error": str(e)}
            )


# ============================================================================
# Quality Scorer
# ============================================================================

class QualityScorer:
    """Calculate content quality score"""
    
    def __init__(
        self,
        min_score: float = 0.7,
        factors: Dict[str, float] = None
    ):
        self.min_score = min_score
        self.factors = factors or {
            "accuracy": 0.3,
            "safety": 0.3,
            "originality": 0.2,
            "bias_free": 0.2
        }
        self.logger = structlog.get_logger()
    
    def calculate_score(
        self,
        fact_check: Optional[FactCheckResult],
        safety_check: SafetyCheckResult,
        plagiarism_check: PlagiarismResult,
        bias_check: BiasResult
    ) -> QualityScore:
        """Calculate overall quality score"""
        try:
            # Accuracy score (from fact-checking)
            if fact_check:
                accuracy_score = fact_check.confidence
            else:
                accuracy_score = 0.8  # Default if no fact-checking
            
            # Safety score (inverse of toxicity)
            safety_score = 1.0 - safety_check.toxicity_score
            if not safety_check.passed:
                safety_score *= 0.5  # Penalty for safety issues
            
            # Originality score (inverse of plagiarism)
            originality_score = 1.0 - plagiarism_check.similarity_score
            
            # Bias-free score
            bias_free_score = 1.0 - bias_check.overall_bias_score
            
            # Calculate weighted overall score
            overall_score = (
                accuracy_score * self.factors["accuracy"] +
                safety_score * self.factors["safety"] +
                originality_score * self.factors["originality"] +
                bias_free_score * self.factors["bias_free"]
            )
            
            passed = overall_score >= self.min_score
            
            return QualityScore(
                overall_score=overall_score,
                accuracy_score=accuracy_score,
                safety_score=safety_score,
                originality_score=originality_score,
                bias_free_score=bias_free_score,
                passed=passed
            )
        
        except Exception as e:
            self.logger.error("quality_scoring_failed", error=str(e))
            return QualityScore(
                overall_score=0.0,
                accuracy_score=0.0,
                safety_score=0.0,
                originality_score=0.0,
                bias_free_score=0.0,
                passed=False
            )


# ============================================================================
# Human Review Queue
# ============================================================================

class HumanReviewQueue:
    """Queue system for human review"""
    
    def __init__(
        self,
        max_size: int = 100,
        priority_order: List[str] = None
    ):
        self.max_size = max_size
        self.priority_order = priority_order or [
            ReviewPriority.SAFETY_FAIL.value,
            ReviewPriority.LOW_QUALITY.value,
            ReviewPriority.BIAS_DETECTED.value,
            ReviewPriority.PLAGIARISM.value,
            ReviewPriority.MANUAL_REQUEST.value
        ]
        self.logger = structlog.get_logger()
        
        # Priority queues
        self.queues: Dict[str, deque] = {
            priority: deque() for priority in self.priority_order
        }
        
        # Item lookup
        self.items: Dict[str, ReviewQueueItem] = {}
    
    def add_to_queue(
        self,
        content_id: str,
        content: str,
        validation_result: ValidationResult,
        priority: ReviewPriority
    ) -> str:
        """Add item to review queue"""
        # Check if already in queue
        if content_id in self.items:
            self.logger.warning("content_already_in_queue", content_id=content_id)
            return content_id
        
        # Check queue size
        total_items = sum(len(q) for q in self.queues.values())
        if total_items >= self.max_size:
            # Remove lowest priority item
            self._remove_lowest_priority()
        
        # Create queue item
        item = ReviewQueueItem(
            content_id=content_id,
            content=content,
            validation_result=validation_result,
            priority=priority,
            queued_at=time.time()
        )
        
        # Add to appropriate queue
        self.queues[priority.value].append(item)
        self.items[content_id] = item
        
        self.logger.info(
            "added_to_review_queue",
            content_id=content_id,
            priority=priority.value
        )
        
        return content_id
    
    def get_next_item(self) -> Optional[ReviewQueueItem]:
        """Get next item for review"""
        for priority in self.priority_order:
            if self.queues[priority]:
                item = self.queues[priority].popleft()
                return item
        
        return None
    
    def get_queue_status(self) -> Dict[str, Any]:
        """Get queue status"""
        return {
            "total_items": sum(len(q) for q in self.queues.values()),
            "by_priority": {
                priority: len(queue)
                for priority, queue in self.queues.items()
            },
            "max_size": self.max_size
        }
    
    def approve_content(
        self,
        content_id: str,
        reviewer_id: str,
        notes: Optional[str] = None
    ) -> bool:
        """Approve content after review"""
        if content_id not in self.items:
            return False
        
        item = self.items[content_id]
        item.reviewed = True
        item.reviewer_id = reviewer_id
        item.review_notes = notes
        
        self.logger.info(
            "content_approved",
            content_id=content_id,
            reviewer_id=reviewer_id
        )
        
        return True
    
    def _remove_lowest_priority(self):
        """Remove lowest priority item to make space"""
        for priority in reversed(self.priority_order):
            if self.queues[priority]:
                item = self.queues[priority].popleft()
                del self.items[item.content_id]
                self.logger.warning(
                    "removed_from_queue",
                    content_id=item.content_id,
                    reason="queue_full"
                )
                return


# ============================================================================
# Content Quality Agent
# ============================================================================

class ContentQualityAgent:
    """Main agent class"""
    
    def __init__(self, config_path: str = "config.yaml"):
        self.config = self._load_config(config_path)
        self.logger = self._setup_logging()
        
        # Initialize components
        self.fact_checker: Optional[FactChecker] = None
        self.safety_checker: Optional[SafetyChecker] = None
        self.plagiarism_detector: Optional[PlagiarismDetector] = None
        self.bias_detector: Optional[BiasDetector] = None
        self.quality_scorer: Optional[QualityScorer] = None
        self.review_queue: Optional[HumanReviewQueue] = None
        
        # Cache for repeated checks
        self.cache: Dict[str, ValidationResult] = {}
    
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from YAML"""
        try:
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            # Return default config
            return {
                "agent": {
                    "name": "content_quality_agent",
                    "port": 8013,
                    "host": "0.0.0.0"
                },
                "fact_checking": {
                    "enable": True,
                    "knowledge_graph_api": "http://localhost:8010",
                    "min_confidence": 0.8,
                    "verify_claims": True
                },
                "safety": {
                    "age_filter": {
                        "enable": True,
                        "min_age": 6,
                        "max_age": 18,
                        "coppa_compliance": True
                    },
                    "content_filters": [
                        "profanity", "violence", "nsfw", "hate_speech", "self_harm"
                    ],
                    "models": {
                        "detoxify": "unitary/toxic-bert",
                        "nsfw_detector": "Falconsai/nsfw_image_detection"
                    }
                },
                "plagiarism": {
                    "enable": True,
                    "similarity_threshold": 0.7,
                    "check_sources": ["wikipedia", "educational_db", "previous_content"],
                    "embedding_model": "sentence-transformers/all-MiniLM-L6-v2"
                },
                "bias_detection": {
                    "enable": True,
                    "types": ["gender", "racial", "cultural", "age", "socioeconomic"],
                    "model": "bert-base-uncased",
                    "threshold": 0.6
                },
                "quality_scoring": {
                    "min_score": 0.7,
                    "factors": {
                        "accuracy": 0.3,
                        "safety": 0.3,
                        "originality": 0.2,
                        "bias_free": 0.2
                    }
                },
                "human_review": {
                    "trigger_threshold": 0.6,
                    "queue_size": 100,
                    "priority": ["safety_fail", "low_quality", "bias_detected"]
                }
            }
    
    def _setup_logging(self) -> structlog.BoundLogger:
        """Setup structured logging"""
        structlog.configure(
            processors=[
                structlog.processors.TimeStamper(fmt="iso"),
                structlog.processors.JSONRenderer()
            ]
        )
        return structlog.get_logger()
    
    async def initialize(self) -> None:
        """Initialize agent"""
        self.logger.info("initializing_agent", name=self.config["agent"]["name"])
        
        # Initialize fact checker
        if self.config["fact_checking"]["enable"]:
            self.fact_checker = FactChecker(
                knowledge_graph_api=self.config["fact_checking"]["knowledge_graph_api"],
                min_confidence=self.config["fact_checking"]["min_confidence"]
            )
        
        # Initialize safety checker
        self.safety_checker = SafetyChecker(config=self.config["safety"])
        
        # Initialize plagiarism detector
        if self.config["plagiarism"]["enable"]:
            self.plagiarism_detector = PlagiarismDetector(
                similarity_threshold=self.config["plagiarism"]["similarity_threshold"],
                model_name=self.config["plagiarism"]["embedding_model"]
            )
        
        # Initialize bias detector
        if self.config["bias_detection"]["enable"]:
            self.bias_detector = BiasDetector(
                threshold=self.config["bias_detection"]["threshold"],
                model_name=self.config["bias_detection"]["model"]
            )
        
        # Initialize quality scorer
        self.quality_scorer = QualityScorer(
            min_score=self.config["quality_scoring"]["min_score"],
            factors=self.config["quality_scoring"]["factors"]
        )
        
        # Initialize review queue
        self.review_queue = HumanReviewQueue(
            max_size=self.config["human_review"]["queue_size"],
            priority_order=self.config["human_review"]["priority"]
        )
        
        self.logger.info("agent_initialized")
    
    async def validate_content(
        self,
        content: str,
        content_type: ContentType,
        target_age: Optional[int] = None,
        metadata: Dict[str, Any] = None
    ) -> ValidationResult:
        """Validate content comprehensively"""
        content_id = self._generate_content_id(content)
        
        # Check cache
        if content_id in self.cache:
            self.logger.info("returning_cached_result", content_id=content_id)
            return self.cache[content_id]
        
        self.logger.info(
            "validating_content",
            content_id=content_id,
            content_type=content_type.value,
            target_age=target_age
        )
        
        # Fact-checking
        fact_check = None
        if self.fact_checker:
            fact_check = await self.fact_checker.check_facts(content)
        
        # Safety check
        safety_check = await self.safety_checker.check_safety(content, target_age)
        
        # Plagiarism check
        plagiarism_check = await self.plagiarism_detector.check_plagiarism(content)
        
        # Bias check
        bias_check = await self.bias_detector.detect_bias(content)
        
        # Quality score
        quality_score = self.quality_scorer.calculate_score(
            fact_check,
            safety_check,
            plagiarism_check,
            bias_check
        )
        
        # Overall pass/fail
        passed = all([
            quality_score.passed,
            safety_check.passed,
            plagiarism_check.passed,
            bias_check.passed
        ])
        
        if fact_check:
            passed = passed and fact_check.passed
        
        # Check if human review needed
        requires_review = False
        review_reason = None
        
        if not passed:
            requires_review = True
            if not safety_check.passed:
                review_reason = ReviewPriority.SAFETY_FAIL.value
            elif quality_score.overall_score < self.config["human_review"]["trigger_threshold"]:
                review_reason = ReviewPriority.LOW_QUALITY.value
            elif not bias_check.passed:
                review_reason = ReviewPriority.BIAS_DETECTED.value
            elif not plagiarism_check.passed:
                review_reason = ReviewPriority.PLAGIARISM.value
        
        # Create result
        result = ValidationResult(
            content_id=content_id,
            fact_check=fact_check,
            safety_check=safety_check,
            plagiarism_check=plagiarism_check,
            bias_check=bias_check,
            quality_score=quality_score,
            passed=passed,
            requires_human_review=requires_review,
            review_reason=review_reason,
            timestamp=time.time()
        )
        
        # Add to human review queue if needed
        if requires_review:
            priority = ReviewPriority(review_reason)
            self.queue_for_human_review(content, result, priority)
        
        # Cache result
        self.cache[content_id] = result
        
        self.logger.info(
            "validation_complete",
            content_id=content_id,
            passed=passed,
            requires_review=requires_review
        )
        
        return result
    
    async def fact_check(self, content: str, claims: Optional[List[str]] = None) -> FactCheckResult:
        """Fact-check content"""
        if not self.fact_checker:
            raise HTTPException(status_code=503, detail="Fact-checking not enabled")
        
        return await self.fact_checker.check_facts(content, claims)
    
    async def check_safety(
        self,
        content: str,
        age_group: Optional[str] = None,
        target_age: Optional[int] = None
    ) -> SafetyCheckResult:
        """Check content safety"""
        return await self.safety_checker.check_safety(content, target_age)
    
    async def detect_plagiarism(self, content: str) -> PlagiarismResult:
        """Detect plagiarism"""
        if not self.plagiarism_detector:
            raise HTTPException(status_code=503, detail="Plagiarism detection not enabled")
        
        return await self.plagiarism_detector.check_plagiarism(content)
    
    async def detect_bias(self, content: str) -> BiasResult:
        """Detect bias"""
        if not self.bias_detector:
            raise HTTPException(status_code=503, detail="Bias detection not enabled")
        
        return await self.bias_detector.detect_bias(content)
    
    def check_age_appropriateness(self, content: str, target_age: int) -> bool:
        """Check age appropriateness"""
        return self.safety_checker.check_age_appropriateness(content, target_age)
    
    def calculate_quality_score(self, checks: Dict[str, Any]) -> QualityScore:
        """Calculate quality score from checks"""
        fact_check = checks.get("fact_check")
        safety_check = checks.get("safety_check")
        plagiarism_check = checks.get("plagiarism_check")
        bias_check = checks.get("bias_check")
        
        return self.quality_scorer.calculate_score(
            fact_check,
            safety_check,
            plagiarism_check,
            bias_check
        )
    
    def queue_for_human_review(
        self,
        content: str,
        validation_result: ValidationResult,
        priority: ReviewPriority
    ) -> str:
        """Queue content for human review"""
        return self.review_queue.add_to_queue(
            validation_result.content_id,
            content,
            validation_result,
            priority
        )
    
    def _generate_content_id(self, content: str) -> str:
        """Generate unique content ID"""
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    async def shutdown(self) -> None:
        """Shutdown agent"""
        self.logger.info("shutting_down_agent")
        
        if self.fact_checker:
            await self.fact_checker.close()
        
        self.logger.info("agent_shutdown_complete")


# ============================================================================
# FastAPI Application
# ============================================================================

app = FastAPI(title="Content Quality Agent")
agent: Optional[ContentQualityAgent] = None


@app.on_event("startup")
async def startup_event():
    """Initialize agent on startup"""
    global agent
    agent = ContentQualityAgent()
    await agent.initialize()


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown agent"""
    global agent
    if agent:
        await agent.shutdown()


@app.post("/validate")
async def validate_content(request: ValidateRequest):
    """Validate content"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    result = await agent.validate_content(
        request.content,
        request.content_type,
        request.target_age,
        request.metadata
    )
    
    return {
        "content_id": result.content_id,
        "passed": result.passed,
        "requires_human_review": result.requires_human_review,
        "quality_score": result.quality_score.overall_score,
        "fact_check": asdict(result.fact_check) if result.fact_check else None,
        "safety_check": asdict(result.safety_check),
        "plagiarism_check": asdict(result.plagiarism_check),
        "bias_check": asdict(result.bias_check),
        "timestamp": result.timestamp
    }


@app.post("/fact-check")
async def fact_check(request: FactCheckRequest):
    """Fact-check content"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    result = await agent.fact_check(request.content, request.claims)
    
    return asdict(result)


@app.post("/safety-check")
async def safety_check(request: SafetyCheckRequest):
    """Safety check"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    result = await agent.check_safety(
        request.content,
        request.age_group,
        request.target_age
    )
    
    return asdict(result)


@app.post("/plagiarism-check")
async def plagiarism_check(request: PlagiarismCheckRequest):
    """Plagiarism check"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    result = await agent.detect_plagiarism(request.content)
    
    return asdict(result)


@app.post("/bias-check")
async def bias_check(request: BiasCheckRequest):
    """Bias check"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    result = await agent.detect_bias(request.content)
    
    return asdict(result)


@app.post("/quality-score")
async def quality_score(checks: Dict[str, Any]):
    """Calculate quality score"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    result = agent.calculate_quality_score(checks)
    
    return asdict(result)


@app.get("/review-queue")
async def get_review_queue():
    """Get human review queue status"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    status = agent.review_queue.get_queue_status()
    
    return status


@app.post("/approve/{content_id}")
async def approve_content(content_id: str, request: ApproveRequest):
    """Approve content after human review"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    success = agent.review_queue.approve_content(
        content_id,
        request.reviewer_id,
        request.notes
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Content not found in review queue")
    
    return {
        "success": True,
        "content_id": content_id,
        "reviewer_id": request.reviewer_id
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "agent": "content_quality_agent",
        "timestamp": time.time()
    }


if __name__ == "__main__":
    import uvicorn
    
    # Load config
    try:
        with open("config.yaml", 'r') as f:
            config = yaml.safe_load(f)
    except FileNotFoundError:
        config = {
            "agent": {
                "host": "0.0.0.0",
                "port": 8013
            }
        }
    
    # Run server
    uvicorn.run(
        app,
        host=config["agent"]["host"],
        port=config["agent"]["port"],
        log_level="info"
    )
