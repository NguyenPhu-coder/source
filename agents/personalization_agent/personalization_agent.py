"""
PERSONALIZATION AGENT - Learn Your Way Platform
Generates adaptive, culturally-aware, interest-based personalized learning content using Qwen2.5-3B

Architecture:
    User Profile → Behavioral Analysis → Qwen2.5-3B → Adaptive Content → Cache
    
Features:
    - Real-time content adaptation
    - Cultural sensitivity filters
    - Interest-based analogy generation
    - Grade-appropriate vocabulary
    - Learning style matching
    - Dynamic difficulty adjustment
    - Mnemonic generation
    - "Glows & Grows" feedback

Author: Learn Your Way Team
Date: November 3, 2025
"""

import asyncio
import hashlib
import json
import logging
import re
import time
import uuid
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx
import structlog
import torch
import yaml
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Histogram, Gauge, make_asgi_app
from pydantic import BaseModel, Field, validator
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

# ==================== LOGGING ====================
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ]
)
logger = structlog.get_logger()

# ==================== PYDANTIC MODELS ====================

class PersonalizationRequest(BaseModel):
    user_id: str = Field(..., description="User identifier")
    concept_id: str = Field(..., description="Concept identifier from knowledge graph")
    format: str = Field(..., description="Content format: examples, mnemonics, summary, practice")
    context: Optional[str] = Field(None, description="Additional context")
    
    @validator('format')
    def validate_format(cls, v):
        allowed = ['examples', 'analogies', 'mnemonics', 'summaries', 'practice_problems']
        if v not in allowed:
            raise ValueError(f"Format must be one of {allowed}")
        return v

class ExampleRequest(BaseModel):
    user_id: str
    concept: str
    base_content: str
    num_examples: int = Field(default=3, ge=1, le=10)

class MnemonicRequest(BaseModel):
    user_id: str
    concept: str
    key_points: List[str]

class FeedbackRequest(BaseModel):
    user_id: str
    question: str
    user_answer: str
    correct_answer: str
    is_correct: bool

class DifficultyAdaptRequest(BaseModel):
    user_id: str
    content: str
    target_level: str = Field(..., description="beginner, intermediate, advanced")
    
    @validator('target_level')
    def validate_level(cls, v):
        if v not in ['beginner', 'intermediate', 'advanced']:
            raise ValueError("target_level must be beginner, intermediate, or advanced")
        return v

class PersonalizationResponse(BaseModel):
    job_id: str
    content: str
    metadata: Dict[str, Any]
    cached: bool = False

class ProfileResponse(BaseModel):
    user_id: str
    profile: Dict[str, Any]
    learning_velocity: Dict[str, Any]
    recommendations: List[str]

# ==================== QWEN MODEL MANAGER ====================

class QwenModelManager:
    """Manages Qwen2.5-3B model loading and inference with prompt engineering"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config['models']['qwen']
        self.model = None
        self.tokenizer = None
        self.device = torch.device('cpu')  # Force CPU since no GPU available
        self.max_length = self.config.get('max_length', 2048)
        self.temperature = self.config.get('temperature', 0.7)
        self.top_p = self.config.get('top_p', 0.9)
        self.prompt_templates = self._load_prompt_templates()
        
        logger.info("qwen_manager_initialized", device=str(self.device))
    
    def _load_prompt_templates(self) -> Dict[str, str]:
        """Load prompt templates for different content types"""
        return {
            'examples': """You are an expert educator creating personalized examples.

Student Profile:
- Grade Level: {grade_level}
- Interests: {interests}
- Learning Style: {learning_style}
- Culture: {culture}
- Language: {language}

Concept: {concept}
Base Content: {base_content}

Task: Generate {num_examples} engaging, relevant examples that connect to the student's interests and culture. Use grade-appropriate vocabulary.

Examples:""",
            
            'mnemonics': """You are a memory expert creating personalized mnemonics.

Student Profile:
- Interests: {interests}
- Culture: {culture}
- Language: {language}

Concept: {concept}
Key Points: {key_points}

Task: Create a memorable mnemonic device that incorporates the student's interests. Make it fun, visual, and easy to recall.

Mnemonic:""",
            
            'analogies': """You are an expert at creating relatable analogies.

Student Profile:
- Grade Level: {grade_level}
- Interests: {interests}
- Culture: {culture}

Concept: {concept}
Context: {context}

Task: Create culturally-relevant analogies that connect the concept to the student's interests. Use familiar references from their background.

Analogies:""",
            
            'summaries': """You are an expert at creating clear summaries.

Student Profile:
- Grade Level: {grade_level}
- Difficulty Preference: {difficulty}
- Learning Style: {learning_style}

Concept: {concept}
Full Content: {content}

Task: Create a {difficulty}-level summary that matches the student's learning style. Use appropriate vocabulary and structure.

Summary:""",
            
            'practice_problems': """You are an expert at creating engaging practice problems.

Student Profile:
- Grade Level: {grade_level}
- Interests: {interests}
- Mastery Level: {mastery_level}

Concept: {concept}
Context: {context}

Task: Create {num_problems} practice problems at {difficulty} level that incorporate the student's interests. Include step-by-step solutions.

Problems:""",
            
            'feedback': """You are a supportive educator providing "Glows & Grows" feedback.

Student Profile:
- Grade Level: {grade_level}
- Learning Style: {learning_style}

Question: {question}
Student's Answer: {user_answer}
Correct Answer: {correct_answer}
Result: {result}

Task: Provide encouraging feedback using "Glows & Grows" format:
- Glows: What the student did well (specific praise)
- Grows: How to improve (constructive, actionable guidance)

Use a warm, supportive tone appropriate for grade level.

Feedback:""",
            
            'difficulty_scaling': """You are an expert at adapting content difficulty.

Current Content: {content}
Target Level: {target_level}
Student Grade: {grade_level}

Task: Rewrite the content for {target_level} level. Adjust vocabulary, complexity, and depth appropriately.

Adapted Content:"""
        }
    
    def load_model(self):
        """Load GPT-2 model (smaller, faster) for CPU usage"""
        try:
            logger.info("loading_gpt2_model", device=str(self.device))
            
            # Use GPT-2 instead of Qwen2.5-3B to save 8GB+ memory
            model_name = "gpt2"  # 548MB vs 8.89GB for Qwen
            
            # Force CPU device to avoid CUDA issues
            self.device = torch.device("cpu")
            
            # Use HF token from environment if available
            import os
            hf_token = os.getenv("HF_TOKEN")
            
            self.tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                token=hf_token,
                trust_remote_code=True
            )
            self.tokenizer.pad_token = self.tokenizer.eos_token
            
            self.model = AutoModelForCausalLM.from_pretrained(
                model_name,
                torch_dtype=torch.float32,  # Use float32 for CPU
                token=hf_token,
                trust_remote_code=True
            )
            
            self.model = self.model.to(self.device)
            
            self.model.eval()
            
            logger.info("gpt2_model_loaded_successfully", device=str(self.device), model=model_name)
            
        except Exception as e:
            logger.error("qwen_model_load_failed", error=str(e))
            raise
    
    async def generate_content(
        self,
        template_type: str,
        profile: Dict[str, Any],
        params: Dict[str, Any]
    ) -> str:
        """Generate personalized content using Qwen model"""
        try:
            # Get prompt template
            template = self.prompt_templates.get(template_type)
            if not template:
                raise ValueError(f"Unknown template type: {template_type}")
            
            # Fill template with profile and params
            prompt_vars = {**profile, **params}
            prompt = template.format(**prompt_vars)
            
            # Tokenize
            inputs = self.tokenizer(
                prompt,
                return_tensors="pt",
                truncation=True,
                max_length=self.max_length
            ).to(self.device)
            
            # Generate
            start_time = time.time()
            
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=512,
                    temperature=self.temperature,
                    top_p=self.top_p,
                    do_sample=True,
                    pad_token_id=self.tokenizer.pad_token_id,
                    eos_token_id=self.tokenizer.eos_token_id
                )
            
            # Decode
            generated_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Extract only the generated part (after prompt)
            response = generated_text[len(prompt):].strip()
            
            duration = time.time() - start_time
            
            logger.info(
                "content_generated",
                template_type=template_type,
                duration=duration,
                length=len(response)
            )
            
            return response
            
        except Exception as e:
            logger.error("content_generation_failed", error=str(e), template_type=template_type)
            raise

# ==================== USER PROFILE ANALYZER ====================

class UserProfileAnalyzer:
    """Analyzes user data from Knowledge Graph Agent to build personalization profile"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config['knowledge_graph_api']
        self.client = httpx.AsyncClient(timeout=30.0)
        
    async def get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """Fetch comprehensive user profile from Knowledge Graph Agent"""
        try:
            base_url = self.config['base_url']
            endpoint = self.config['endpoints']['user_profile'].format(user_id=user_id)
            url = f"{base_url}{endpoint}"
            
            response = await self.client.get(url)
            response.raise_for_status()
            
            profile_data = response.json()
            
            # Build structured profile
            profile = {
                'user_id': user_id,
                'grade_level': profile_data.get('grade_level', '8'),
                'interests': profile_data.get('interests', ['science', 'technology']),
                'learning_style': profile_data.get('learning_style', 'visual'),
                'culture': profile_data.get('culture', 'general'),
                'language': profile_data.get('language', 'en'),
                'difficulty': profile_data.get('difficulty_preference', 'intermediate')
            }
            
            logger.info("user_profile_fetched", user_id=user_id)
            return profile
            
        except httpx.HTTPStatusError as e:
            logger.warning("user_profile_not_found", user_id=user_id, status=e.response.status_code)
            # Return default profile
            return self._get_default_profile(user_id)
        except Exception as e:
            logger.error("user_profile_fetch_failed", error=str(e))
            return self._get_default_profile(user_id)
    
    async def get_learning_history(self, user_id: str) -> List[Dict[str, Any]]:
        """Fetch user's learning history"""
        try:
            base_url = self.config['base_url']
            endpoint = self.config['endpoints']['learning_history'].format(user_id=user_id)
            url = f"{base_url}{endpoint}"
            
            response = await self.client.get(url)
            response.raise_for_status()
            
            history = response.json()
            return history.get('history', [])
            
        except Exception as e:
            logger.error("learning_history_fetch_failed", error=str(e))
            return []
    
    async def get_mastery_levels(self, user_id: str) -> Dict[str, float]:
        """Fetch user's concept mastery levels"""
        try:
            base_url = self.config['base_url']
            endpoint = self.config['endpoints']['mastery'].format(user_id=user_id)
            url = f"{base_url}{endpoint}"
            
            response = await self.client.get(url)
            response.raise_for_status()
            
            mastery = response.json()
            return mastery.get('mastery_levels', {})
            
        except Exception as e:
            logger.error("mastery_fetch_failed", error=str(e))
            return {}
    
    def _get_default_profile(self, user_id: str) -> Dict[str, Any]:
        """Return default profile for new users"""
        return {
            'user_id': user_id,
            'grade_level': '8',
            'interests': ['general'],
            'learning_style': 'visual',
            'culture': 'general',
            'language': 'en',
            'difficulty': 'intermediate'
        }
    
    async def analyze_learning_velocity(self, user_id: str) -> Dict[str, Any]:
        """Analyze how fast user is learning (for adaptive difficulty)"""
        try:
            history = await self.get_learning_history(user_id)
            mastery = await self.get_mastery_levels(user_id)
            
            if not history:
                return {
                    'velocity': 'normal',
                    'recommendation': 'intermediate',
                    'confidence': 0.5
                }
            
            # Calculate metrics
            total_concepts = len(mastery)
            mastered_concepts = sum(1 for v in mastery.values() if v >= 0.8)
            avg_mastery = sum(mastery.values()) / total_concepts if total_concepts > 0 else 0.0
            
            # Analyze recent performance
            recent_history = history[-10:] if len(history) >= 10 else history
            recent_correct = sum(1 for item in recent_history if item.get('correct', False))
            accuracy = recent_correct / len(recent_history) if recent_history else 0.0
            
            # Determine velocity
            if avg_mastery >= 0.8 and accuracy >= 0.85:
                velocity = 'fast'
                recommendation = 'advanced'
            elif avg_mastery >= 0.5 and accuracy >= 0.7:
                velocity = 'normal'
                recommendation = 'intermediate'
            else:
                velocity = 'slow'
                recommendation = 'beginner'
            
            return {
                'velocity': velocity,
                'recommendation': recommendation,
                'total_concepts': total_concepts,
                'mastered_concepts': mastered_concepts,
                'avg_mastery': round(avg_mastery, 2),
                'recent_accuracy': round(accuracy, 2),
                'confidence': 0.8
            }
            
        except Exception as e:
            logger.error("velocity_analysis_failed", error=str(e))
            return {
                'velocity': 'normal',
                'recommendation': 'intermediate',
                'confidence': 0.5
            }

# ==================== CACHING CLIENT ====================

class CachingClient:
    """Client for interacting with Caching Agent"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config['caching_api']
        self.client = httpx.AsyncClient(timeout=10.0)
        self.ttl = self.config.get('ttl', 3600)
    
    async def get_cached(self, key: str) -> Optional[str]:
        """Get cached content"""
        try:
            url = f"{self.config['base_url']}/get/{key}"
            response = await self.client.get(url)
            
            if response.status_code == 200:
                data = response.json()
                return data.get('value')
            return None
            
        except Exception as e:
            logger.warning("cache_get_failed", error=str(e))
            return None
    
    async def set_cached(self, key: str, value: str, ttl: Optional[int] = None):
        """Set cached content"""
        try:
            url = f"{self.config['base_url']}/set"
            payload = {
                'key': key,
                'value': value,
                'ttl': ttl or self.ttl
            }
            
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            
            logger.info("content_cached", key=key)
            
        except Exception as e:
            logger.warning("cache_set_failed", error=str(e))
    
    def generate_cache_key(self, user_id: str, concept_id: str, format: str) -> str:
        """Generate cache key"""
        raw = f"{user_id}:{concept_id}:{format}"
        return f"personalization:{hashlib.md5(raw.encode()).hexdigest()}"

# ==================== CONTENT ADAPTER ====================

class ContentAdapter:
    """Adapts content based on personalization factors"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config['personalization']
        self.cultural_filters = self._load_cultural_filters()
        self.vocabulary_levels = self._load_vocabulary_levels()
    
    def _load_cultural_filters(self) -> Dict[str, List[str]]:
        """Load cultural sensitivity filters"""
        return {
            'avoid_references': {
                'general': [],
                'asian': ['pork', 'beef'],
                'middle_eastern': ['pork', 'alcohol'],
                'western': []
            },
            'preferred_contexts': {
                'asian': ['family', 'community', 'respect', 'harmony'],
                'middle_eastern': ['tradition', 'faith', 'community'],
                'western': ['individual', 'innovation', 'freedom'],
                'general': ['learning', 'growth', 'achievement']
            }
        }
    
    def _load_vocabulary_levels(self) -> Dict[str, List[str]]:
        """Load vocabulary complexity levels"""
        return {
            'beginner': {
                'max_syllables': 2,
                'sentence_length': 10,
                'avoid_words': ['utilize', 'implement', 'synthesize', 'analyze']
            },
            'intermediate': {
                'max_syllables': 3,
                'sentence_length': 15,
                'avoid_words': []
            },
            'advanced': {
                'max_syllables': 5,
                'sentence_length': 25,
                'avoid_words': []
            }
        }
    
    def adapt_examples(self, base_content: str, profile: Dict[str, Any]) -> str:
        """Adapt examples to match user's interests and culture"""
        # Extract interests
        interests = profile.get('interests', [])
        culture = profile.get('culture', 'general')
        
        # Apply cultural filters
        adapted = self._apply_cultural_context(base_content, culture)
        
        # Add interest-based connections
        if interests:
            interest_text = f"\n\n💡 Connection to your interests ({', '.join(interests)}): "
            adapted += interest_text
        
        return adapted
    
    def _apply_cultural_context(self, content: str, culture: str) -> str:
        """Apply cultural context to content"""
        filters = self.cultural_filters['avoid_references'].get(culture, [])
        
        # Remove culturally sensitive references
        for word in filters:
            if word.lower() in content.lower():
                content = content.replace(word, "[culturally adapted]")
        
        return content
    
    def scale_difficulty(self, content: str, target_level: str, grade_level: str) -> str:
        """Scale content difficulty"""
        vocab_rules = self.vocabulary_levels.get(target_level, self.vocabulary_levels['intermediate'])
        
        # Split into sentences
        sentences = content.split('.')
        
        # Adjust sentence complexity
        adapted_sentences = []
        for sentence in sentences:
            if not sentence.strip():
                continue
            
            words = sentence.split()
            
            # Check sentence length
            if len(words) > vocab_rules['sentence_length']:
                # Split long sentences
                mid = len(words) // 2
                part1 = ' '.join(words[:mid]) + '.'
                part2 = ' '.join(words[mid:]) + '.'
                adapted_sentences.extend([part1, part2])
            else:
                adapted_sentences.append(sentence + '.')
        
        return ' '.join(adapted_sentences)
    
    def match_learning_style(self, content: str, learning_style: str) -> str:
        """Add learning style specific hints"""
        if learning_style == 'visual':
            return f"🎨 Visual Tip: Try drawing a diagram or chart to visualize this concept.\n\n{content}"
        elif learning_style == 'auditory':
            return f"🎵 Auditory Tip: Try explaining this concept out loud or recording yourself.\n\n{content}"
        elif learning_style == 'kinesthetic':
            return f"🏃 Kinesthetic Tip: Try acting this out or building a physical model.\n\n{content}"
        else:
            return content

# ==================== PERSONALIZATION AGENT ====================

class PersonalizationAgent:
    """Main agent orchestrating personalized content generation"""
    
    def __init__(self, config_path: str = "config.yaml"):
        # Load config
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = yaml.safe_load(f)
        
        # Initialize components
        self.model_manager = QwenModelManager(self.config)
        self.profile_analyzer = UserProfileAnalyzer(self.config)
        self.caching_client = CachingClient(self.config)
        self.content_adapter = ContentAdapter(self.config)
        
        # Job tracking
        self.jobs: Dict[str, Dict[str, Any]] = {}
        
        logger.info("personalization_agent_initialized")
    
    async def initialize(self):
        """Load models and initialize components"""
        logger.info("initializing_models")
        self.model_manager.load_model()
        logger.info("agent_ready")
    
    async def generate_personalized_content(
        self,
        user_id: str,
        concept_id: str,
        format: str,
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate personalized content for user
        
        Pipeline:
        1. Get user profile from Knowledge Graph
        2. Check cache
        3. Generate content with Qwen
        4. Adapt content based on profile
        5. Cache result
        6. Return personalized content
        """
        job_id = str(uuid.uuid4())
        start_time = time.time()
        
        try:
            # Check cache
            cache_key = self.caching_client.generate_cache_key(user_id, concept_id, format)
            cached_content = await self.caching_client.get_cached(cache_key)
            
            if cached_content:
                logger.info("content_from_cache", job_id=job_id)
                return {
                    'job_id': job_id,
                    'content': cached_content,
                    'metadata': {
                        'user_id': user_id,
                        'concept_id': concept_id,
                        'format': format,
                        'cached': True,
                        'duration': time.time() - start_time
                    },
                    'cached': True
                }
            
            # Get user profile
            profile = await self.profile_analyzer.get_user_profile(user_id)
            
            # Prepare parameters
            params = {
                'concept': concept_id,
                'context': context or '',
                'num_examples': 3,
                'num_problems': 3,
                'difficulty': profile['difficulty']
            }
            
            # Generate content with Qwen
            template_map = {
                'examples': 'examples',
                'analogies': 'analogies',
                'mnemonics': 'mnemonics',
                'summaries': 'summaries',
                'practice_problems': 'practice_problems'
            }
            
            template_type = template_map.get(format, 'examples')
            raw_content = await self.model_manager.generate_content(
                template_type,
                profile,
                params
            )
            
            # Adapt content
            adapted_content = self.content_adapter.adapt_examples(raw_content, profile)
            adapted_content = self.content_adapter.match_learning_style(
                adapted_content,
                profile['learning_style']
            )
            
            # Cache result
            await self.caching_client.set_cached(cache_key, adapted_content)
            
            duration = time.time() - start_time
            
            result = {
                'job_id': job_id,
                'content': adapted_content,
                'metadata': {
                    'user_id': user_id,
                    'concept_id': concept_id,
                    'format': format,
                    'profile': profile,
                    'cached': False,
                    'duration': duration
                },
                'cached': False
            }
            
            logger.info(
                "content_generated",
                job_id=job_id,
                duration=duration,
                format=format
            )
            
            return result
            
        except Exception as e:
            logger.error("content_generation_failed", error=str(e), job_id=job_id)
            raise
    
    async def adapt_examples(
        self,
        user_id: str,
        concept: str,
        base_content: str,
        num_examples: int = 3
    ) -> str:
        """Generate custom examples based on user interests"""
        try:
            profile = await self.profile_analyzer.get_user_profile(user_id)
            
            params = {
                'concept': concept,
                'base_content': base_content,
                'num_examples': num_examples
            }
            
            examples = await self.model_manager.generate_content(
                'examples',
                profile,
                params
            )
            
            adapted = self.content_adapter.adapt_examples(examples, profile)
            
            return adapted
            
        except Exception as e:
            logger.error("example_adaptation_failed", error=str(e))
            raise
    
    async def generate_mnemonics(
        self,
        user_id: str,
        concept: str,
        key_points: List[str]
    ) -> str:
        """Generate personalized mnemonics"""
        try:
            profile = await self.profile_analyzer.get_user_profile(user_id)
            
            params = {
                'concept': concept,
                'key_points': ', '.join(key_points)
            }
            
            mnemonic = await self.model_manager.generate_content(
                'mnemonics',
                profile,
                params
            )
            
            return mnemonic
            
        except Exception as e:
            logger.error("mnemonic_generation_failed", error=str(e))
            raise
    
    async def scale_difficulty(
        self,
        user_id: str,
        content: str,
        target_level: str
    ) -> str:
        """Scale content difficulty"""
        try:
            profile = await self.profile_analyzer.get_user_profile(user_id)
            
            params = {
                'content': content,
                'target_level': target_level
            }
            
            scaled = await self.model_manager.generate_content(
                'difficulty_scaling',
                profile,
                params
            )
            
            # Apply vocabulary adaptation
            final = self.content_adapter.scale_difficulty(
                scaled,
                target_level,
                profile['grade_level']
            )
            
            return final
            
        except Exception as e:
            logger.error("difficulty_scaling_failed", error=str(e))
            raise
    
    async def create_cultural_context(
        self,
        content: str,
        culture: str
    ) -> str:
        """Add cultural context to content"""
        try:
            adapted = self.content_adapter._apply_cultural_context(content, culture)
            return adapted
            
        except Exception as e:
            logger.error("cultural_context_failed", error=str(e))
            raise
    
    async def analyze_learning_velocity(
        self,
        user_id: str
    ) -> Dict[str, Any]:
        """Analyze user's learning velocity"""
        try:
            velocity = await self.profile_analyzer.analyze_learning_velocity(user_id)
            return velocity
            
        except Exception as e:
            logger.error("velocity_analysis_failed", error=str(e))
            raise
    
    async def generate_feedback(
        self,
        user_id: str,
        question: str,
        user_answer: str,
        correct_answer: str,
        is_correct: bool
    ) -> Dict[str, Any]:
        """Generate 'Glows & Grows' feedback"""
        try:
            profile = await self.profile_analyzer.get_user_profile(user_id)
            
            params = {
                'question': question,
                'user_answer': user_answer,
                'correct_answer': correct_answer,
                'result': 'correct' if is_correct else 'incorrect'
            }
            
            feedback_text = await self.model_manager.generate_content(
                'feedback',
                profile,
                params
            )
            
            # Parse into glows and grows
            glows = []
            grows = []
            
            lines = feedback_text.split('\n')
            current_section = None
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                if 'glow' in line.lower():
                    current_section = 'glows'
                elif 'grow' in line.lower():
                    current_section = 'grows'
                elif current_section == 'glows':
                    glows.append(line.lstrip('- •'))
                elif current_section == 'grows':
                    grows.append(line.lstrip('- •'))
            
            return {
                'glows': glows if glows else ["Great effort on this problem!"],
                'grows': grows if grows else ["Keep practicing to strengthen your understanding."],
                'full_feedback': feedback_text,
                'encouragement': self._get_encouragement(is_correct, profile)
            }
            
        except Exception as e:
            logger.error("feedback_generation_failed", error=str(e))
            raise
    
    def _get_encouragement(self, is_correct: bool, profile: Dict[str, Any]) -> str:
        """Get personalized encouragement message"""
        grade = profile.get('grade_level', '8')
        
        if is_correct:
            messages = [
                "Excellent work! You're really mastering this concept! 🌟",
                "Outstanding! Your understanding is growing stronger! 💪",
                "Fantastic! You're on the right track! 🎯"
            ]
        else:
            messages = [
                "Don't worry - mistakes help us learn! Let's try again together. 💡",
                "Every mistake is a step toward mastery. You've got this! 🚀",
                "Learning takes practice. Let's work through this together! 📚"
            ]
        
        import random
        return random.choice(messages)
    
    async def get_profile(self, user_id: str) -> Dict[str, Any]:
        """Get full personalization profile for user"""
        try:
            profile = await self.profile_analyzer.get_user_profile(user_id)
            velocity = await self.profile_analyzer.analyze_learning_velocity(user_id)
            
            # Generate recommendations
            recommendations = []
            
            if velocity['velocity'] == 'fast':
                recommendations.append("Try advanced practice problems to challenge yourself")
                recommendations.append("Explore related concepts to broaden your knowledge")
            elif velocity['velocity'] == 'slow':
                recommendations.append("Take your time with fundamentals")
                recommendations.append("Try using mnemonics to help remember key concepts")
            else:
                recommendations.append("Keep up the great work!")
                recommendations.append("Mix different types of practice for variety")
            
            return {
                'user_id': user_id,
                'profile': profile,
                'learning_velocity': velocity,
                'recommendations': recommendations
            }
            
        except Exception as e:
            logger.error("profile_fetch_failed", error=str(e))
            raise
    
    def get_health_status(self) -> Dict[str, Any]:
        """Get agent health status"""
        return {
            'status': 'healthy',
            'model_loaded': self.model_manager.model is not None,
            'device': str(self.model_manager.device),
            'active_jobs': len(self.jobs),
            'timestamp': datetime.utcnow().isoformat()
        }

# ==================== FASTAPI APP ====================

app = FastAPI(
    title="Personalization Agent",
    description="Adaptive, culturally-aware personalized learning content generation",
    version="1.0.0"
)

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

CONTENT_GENERATED = get_or_create_counter(
    'personalization_content_generated_total',
    'Total personalized content generated',
    ['format', 'cached']
)

GENERATION_DURATION = get_or_create_histogram(
    'personalization_generation_duration_seconds',
    'Time to generate personalized content',
    ['format']
)

CACHE_HITS = get_or_create_counter(
    'personalization_cache_hits_total',
    'Total cache hits',
    []
)

MODEL_INFERENCE = get_or_create_histogram(
    'personalization_model_inference_seconds',
    'Model inference time',
    []
)

ACTIVE_JOBS = get_or_create_gauge(
    'personalization_active_jobs',
    'Number of active personalization jobs'
)

# Mount Prometheus metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# Global agent instance
agent: Optional[PersonalizationAgent] = None

@app.on_event("startup")
async def startup_event():
    """Initialize agent on startup"""
    global agent
    agent = PersonalizationAgent()
    await agent.initialize()

@app.post("/personalize", response_model=PersonalizationResponse)
async def personalize_content(request: PersonalizationRequest):
    """Generate personalized content"""
    try:
        with GENERATION_DURATION.labels(format=request.format).time():
            result = await agent.generate_personalized_content(
                request.user_id,
                request.concept_id,
                request.format,
                request.context
            )
        
        CONTENT_GENERATED.labels(
            format=request.format,
            cached=str(result['cached'])
        ).inc()
        
        if result['cached']:
            CACHE_HITS.inc()
        
        return result
        
    except Exception as e:
        logger.error("personalize_endpoint_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/examples")
async def generate_examples(request: ExampleRequest):
    """Generate custom examples"""
    try:
        examples = await agent.adapt_examples(
            request.user_id,
            request.concept,
            request.base_content,
            request.num_examples
        )
        
        CONTENT_GENERATED.labels(format='examples', cached='false').inc()
        
        return {
            'examples': examples,
            'user_id': request.user_id,
            'concept': request.concept
        }
        
    except Exception as e:
        logger.error("examples_endpoint_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/mnemonics")
async def generate_mnemonics(request: MnemonicRequest):
    """Generate personalized mnemonics"""
    try:
        mnemonic = await agent.generate_mnemonics(
            request.user_id,
            request.concept,
            request.key_points
        )
        
        CONTENT_GENERATED.labels(format='mnemonics', cached='false').inc()
        
        return {
            'mnemonic': mnemonic,
            'user_id': request.user_id,
            'concept': request.concept
        }
        
    except Exception as e:
        logger.error("mnemonics_endpoint_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/feedback")
async def generate_feedback(request: FeedbackRequest):
    """Generate Glows & Grows feedback"""
    try:
        feedback = await agent.generate_feedback(
            request.user_id,
            request.question,
            request.user_answer,
            request.correct_answer,
            request.is_correct
        )
        
        CONTENT_GENERATED.labels(format='feedback', cached='false').inc()
        
        return feedback
        
    except Exception as e:
        logger.error("feedback_endpoint_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/adapt-difficulty")
async def adapt_difficulty(request: DifficultyAdaptRequest):
    """Scale content difficulty"""
    try:
        adapted = await agent.scale_difficulty(
            request.user_id,
            request.content,
            request.target_level
        )
        
        CONTENT_GENERATED.labels(format='difficulty_adapt', cached='false').inc()
        
        return {
            'adapted_content': adapted,
            'target_level': request.target_level,
            'user_id': request.user_id
        }
        
    except Exception as e:
        logger.error("difficulty_endpoint_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/profile/{user_id}", response_model=ProfileResponse)
async def get_profile(user_id: str):
    """Get user personalization profile"""
    try:
        profile_data = await agent.get_profile(user_id)
        return profile_data
        
    except Exception as e:
        logger.error("profile_endpoint_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return agent.get_health_status()

# ==================== MAIN ====================

if __name__ == "__main__":
    import uvicorn
    
    # Load config to get port
    with open("config.yaml", 'r') as f:
        config = yaml.safe_load(f)
    
    port = config['agent'].get('port', 8002)
    host = config['agent'].get('host', '0.0.0.0')
    
    uvicorn.run(
        "personalization_agent:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )
