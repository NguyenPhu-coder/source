"""
ASSESSMENT AGENT - Learn Your Way Platform
Generates adaptive assessments using T5, IRT, and Bloom's taxonomy alignment

Architecture:
    Concept → T5 Generation → Difficulty Calibration → Graph Validation → Quality Check
    
Features:
    - T5-based question generation
    - Bloom's taxonomy alignment
    - Item Response Theory (IRT) adaptive testing
    - Distractor quality analysis
    - Prerequisite validation
    - Instant feedback generation
    - Partial credit grading
    - Remediation suggestions

Author: Learn Your Way Team
Date: November 3, 2025
"""

import asyncio
import hashlib
import json
import logging
import math
import random
import re
import sqlite3
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
from scipy.stats import norm
from transformers import T5ForConditionalGeneration, T5Tokenizer

# ==================== LOGGING ====================
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ]
)
logger = structlog.get_logger()

# ==================== PYDANTIC MODELS ====================

class QuestionGenerationRequest(BaseModel):
    concept_id: str = Field(..., description="Concept identifier")
    num_questions: int = Field(default=5, ge=1, le=20)
    difficulty: int = Field(default=3, ge=1, le=5)
    question_types: Optional[List[str]] = Field(default=None)

class BloomsGenerationRequest(BaseModel):
    concept: str = Field(..., description="Concept name")
    level: str = Field(..., description="Bloom's taxonomy level")
    num_questions: int = Field(default=3, ge=1, le=10)
    
    @validator('level')
    def validate_blooms_level(cls, v):
        allowed = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']
        if v not in allowed:
            raise ValueError(f"level must be one of {allowed}")
        return v

class QuestionValidationRequest(BaseModel):
    question: Dict[str, Any] = Field(..., description="Question object to validate")

class GradeAnswerRequest(BaseModel):
    question_id: str
    user_answer: str
    partial_credit: bool = Field(default=True)

class AdaptiveQuestionRequest(BaseModel):
    user_id: str
    history: List[Dict[str, Any]] = Field(default=[])
    concept_id: Optional[str] = None

class QuizRequest(BaseModel):
    concept_ids: List[str]
    num_questions: int = Field(default=10, ge=1, le=50)
    difficulty_range: Tuple[int, int] = Field(default=(2, 4))
    blooms_distribution: Optional[Dict[str, int]] = None

class QuestionResponse(BaseModel):
    question_id: str
    question_text: str
    question_type: str
    difficulty: int
    blooms_level: str
    options: Optional[List[str]] = None
    metadata: Dict[str, Any]

class GradeResponse(BaseModel):
    question_id: str
    correct: bool
    score: float
    feedback: str
    correct_answer: Optional[str] = None
    remediation: Optional[str] = None

class MasteryResponse(BaseModel):
    user_id: str
    concept_id: str
    mastery_level: float
    confidence: float
    recommendations: List[str]

# ==================== T5 MODEL MANAGER ====================

class T5QuestionGenerator:
    """Manages T5 model for question generation"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config['models']['t5']
        self.model = None
        self.tokenizer = None
        self.device = torch.device(self.config.get('device', 'cuda') if torch.cuda.is_available() else 'cpu')
        self.max_length = self.config.get('max_length', 512)
        self.num_beams = self.config.get('num_beams', 4)
        self.question_templates = self._load_question_templates()
        
        logger.info("t5_generator_initialized", device=str(self.device))
    
    def _load_question_templates(self) -> Dict[str, Dict[str, Any]]:
        """Load question generation templates by Bloom's level"""
        return {
            'remember': {
                'prompt_prefix': 'generate question recall: ',
                'keywords': ['what', 'who', 'when', 'where', 'define', 'list', 'identify'],
                'example': 'What is the definition of {concept}?',
                'fallback_templates': [
                    'Định nghĩa của {concept} là gì?',
                    '{concept} là gì? Hãy trình bày khái niệm cơ bản.',
                    'Liệt kê các đặc điểm chính của {concept}.',
                    'Ai là người đầu tiên phát hiện/phát triển {concept}?',
                    'Khi nào {concept} được áp dụng lần đầu tiên?',
                    '{concept} bao gồm những thành phần nào?',
                    'Nêu các yếu tố cấu thành của {concept}.',
                    'Xác định các thuật ngữ liên quan đến {concept}.'
                ]
            },
            'understand': {
                'prompt_prefix': 'generate question comprehension: ',
                'keywords': ['explain', 'describe', 'summarize', 'interpret', 'compare'],
                'example': 'Explain how {concept} works.',
                'fallback_templates': [
                    'Giải thích cách hoạt động của {concept}.',
                    'Mô tả nguyên lý cơ bản của {concept}.',
                    'Tóm tắt ý nghĩa của {concept} trong thực tế.',
                    'So sánh {concept} với các khái niệm liên quan.',
                    'Tại sao {concept} lại quan trọng? Giải thích.',
                    'Diễn giải {concept} bằng ngôn ngữ đơn giản.',
                    'Phân biệt {concept} với các khái niệm tương tự.',
                    'Trình bày ý nghĩa và tầm quan trọng của {concept}.'
                ]
            },
            'apply': {
                'prompt_prefix': 'generate question application: ',
                'keywords': ['apply', 'use', 'demonstrate', 'solve', 'calculate'],
                'example': 'How would you apply {concept} to solve this problem?',
                'fallback_templates': [
                    'Áp dụng {concept} để giải quyết bài toán thực tế như thế nào?',
                    'Cho ví dụ cụ thể về việc sử dụng {concept}.',
                    'Tính toán kết quả khi áp dụng {concept} vào tình huống sau.',
                    'Minh họa cách {concept} được sử dụng trong thực tiễn.',
                    'Sử dụng {concept} để giải quyết vấn đề được cho.',
                    'Trình bày các bước áp dụng {concept} vào bài toán này.',
                    'Làm thế nào để ứng dụng {concept} trong đời sống?',
                    'Thực hiện phép tính sử dụng {concept} cho dữ liệu sau.'
                ]
            },
            'analyze': {
                'prompt_prefix': 'generate question analysis: ',
                'keywords': ['analyze', 'examine', 'compare', 'contrast', 'distinguish'],
                'example': 'Analyze the relationship between {concept} and related concepts.',
                'fallback_templates': [
                    'Phân tích mối quan hệ giữa {concept} và các yếu tố liên quan.',
                    'So sánh và đối chiếu {concept} trong các ngữ cảnh khác nhau.',
                    'Xác định các thành phần cấu tạo nên {concept}.',
                    'Phân tích ưu điểm và nhược điểm của {concept}.',
                    'Kiểm tra tính đúng đắn của {concept} trong trường hợp này.',
                    'Phân biệt các loại/dạng khác nhau của {concept}.',
                    'Tìm ra nguyên nhân và kết quả liên quan đến {concept}.',
                    'Phân tích cấu trúc và chức năng của {concept}.'
                ]
            },
            'evaluate': {
                'prompt_prefix': 'generate question evaluation: ',
                'keywords': ['evaluate', 'assess', 'judge', 'critique', 'justify'],
                'example': 'Evaluate the effectiveness of {concept} in this scenario.',
                'fallback_templates': [
                    'Đánh giá hiệu quả của {concept} trong tình huống này.',
                    'Nhận xét về tính hợp lý của việc áp dụng {concept}.',
                    'Phê bình các điểm mạnh và điểm yếu của {concept}.',
                    'Biện minh cho việc sử dụng {concept} trong trường hợp này.',
                    'Đưa ra ý kiến về giá trị của {concept}.',
                    'Đánh giá mức độ phù hợp của {concept} với bài toán.',
                    'Xem xét và đưa ra kết luận về {concept}.',
                    'Lập luận ủng hộ hoặc phản đối việc áp dụng {concept}.'
                ]
            },
            'create': {
                'prompt_prefix': 'generate question creation: ',
                'keywords': ['create', 'design', 'develop', 'construct', 'formulate'],
                'example': 'Design a solution using {concept}.',
                'fallback_templates': [
                    'Thiết kế một giải pháp sử dụng {concept}.',
                    'Xây dựng mô hình dựa trên {concept}.',
                    'Phát triển ý tưởng mới từ {concept}.',
                    'Đề xuất cách cải tiến {concept}.',
                    'Tạo ra một ứng dụng thực tế của {concept}.',
                    'Thiết lập quy trình mới dựa trên {concept}.',
                    'Xây dựng kế hoạch áp dụng {concept} vào thực tế.',
                    'Sáng tạo phương pháp mới kết hợp {concept}.'
                ]
            }
        }
    
    def _generate_fallback_question(self, concept: str, blooms_level: str, index: int = 0) -> str:
        """Generate fallback question when T5 model fails or returns invalid output"""
        template = self.question_templates.get(blooms_level, self.question_templates['understand'])
        fallback_templates = template.get('fallback_templates', [template['example']])
        
        # Use index to get different questions, cycle through templates
        template_index = index % len(fallback_templates)
        question = fallback_templates[template_index].format(concept=concept)
        
        return question
    
    def load_model(self):
        """Load T5 model and tokenizer"""
        try:
            logger.info("loading_t5_model", path=self.config['model_path'])
            
            self.tokenizer = T5Tokenizer.from_pretrained(self.config['model_path'])
            
            self.model = T5ForConditionalGeneration.from_pretrained(
                self.config['model_path'],
                torch_dtype=torch.float16 if self.device.type == 'cuda' else torch.float32
            )
            
            self.model = self.model.to(self.device)
            self.model.eval()
            
            logger.info("t5_model_loaded", device=str(self.device))
            
        except Exception as e:
            logger.error("t5_model_load_failed", error=str(e))
            raise
    
    async def generate_question(
        self,
        concept: str,
        blooms_level: str,
        difficulty: int,
        question_type: str = 'multiple_choice',
        question_index: int = 0
    ) -> str:
        """Generate question using T5 with fallback"""
        try:
            # Check if model is loaded
            if self.model is None or self.tokenizer is None:
                logger.warning("t5_model_not_loaded, using fallback")
                return self._generate_fallback_question(concept, blooms_level, question_index)
            
            # Get template for Bloom's level
            template = self.question_templates.get(blooms_level, self.question_templates['understand'])
            
            # Construct prompt
            prompt = f"{template['prompt_prefix']}{concept}"
            
            # Tokenize
            inputs = self.tokenizer(
                prompt,
                return_tensors="pt",
                max_length=self.max_length,
                truncation=True
            ).to(self.device)
            
            # Generate
            start_time = time.time()
            
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_length=150,
                    num_beams=self.num_beams,
                    early_stopping=True,
                    no_repeat_ngram_size=3,
                    do_sample=True,  # Enable sampling for variety
                    temperature=0.8,  # Add some randomness
                    top_p=0.9
                )
            
            # Decode
            question = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            duration = time.time() - start_time
            
            # Validate output - check if it's a valid question
            # If T5 returns the concept itself or very short text, use fallback
            if (not question or 
                len(question.strip()) < 15 or 
                question.strip().lower() == concept.lower() or
                concept.lower() in question.strip().lower() and len(question.strip()) < len(concept) + 10):
                logger.warning("t5_output_invalid, using fallback", output=question)
                return self._generate_fallback_question(concept, blooms_level, question_index)
            
            logger.info(
                "question_generated",
                blooms_level=blooms_level,
                difficulty=difficulty,
                duration=duration
            )
            
            return question
            
        except Exception as e:
            logger.error("question_generation_failed", error=str(e))
            # Use fallback on any error
            return self._generate_fallback_question(concept, blooms_level, question_index)
    
    def generate_multiple_choice_options(
        self,
        question: str,
        correct_answer: str,
        num_distractors: int = 3
    ) -> List[str]:
        """Generate multiple choice options with distractors"""
        options = [correct_answer]
        
        # Generate distractors using prompt
        prompt = f"generate distractors for: question: {question}, answer: {correct_answer}"
        
        try:
            inputs = self.tokenizer(
                prompt,
                return_tensors="pt",
                max_length=self.max_length,
                truncation=True
            ).to(self.device)
            
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_length=100,
                    num_beams=num_distractors * 2,
                    num_return_sequences=num_distractors,
                    early_stopping=True
                )
            
            for output in outputs:
                distractor = self.tokenizer.decode(output, skip_special_tokens=True)
                if distractor and distractor != correct_answer and distractor not in options:
                    options.append(distractor)
                    if len(options) >= num_distractors + 1:
                        break
            
            # Fallback distractors if generation fails
            while len(options) < num_distractors + 1:
                options.append(f"Option {len(options)}")
            
            # Shuffle options
            random.shuffle(options)
            
            return options[:num_distractors + 1]
            
        except Exception as e:
            logger.error("distractor_generation_failed", error=str(e))
            # Return fallback options
            return [correct_answer] + [f"Option {i}" for i in range(1, num_distractors + 1)]

# ==================== IRT (ITEM RESPONSE THEORY) ====================

class IRTModel:
    """Item Response Theory for adaptive testing"""
    
    def __init__(self):
        self.ability_estimates: Dict[str, float] = {}  # user_id -> theta
    
    def estimate_ability(self, responses: List[Dict[str, Any]]) -> Tuple[float, float]:
        """
        Estimate user ability using Maximum Likelihood Estimation
        
        Args:
            responses: List of {difficulty, correct, discrimination}
        
        Returns:
            (theta, standard_error)
        """
        if not responses:
            return 0.0, 1.0
        
        # Initial theta estimate
        theta = 0.0
        
        # Newton-Raphson iterations
        for _ in range(10):
            first_derivative = 0.0
            second_derivative = 0.0
            
            for response in responses:
                difficulty = response.get('difficulty', 0.0)
                correct = response.get('correct', False)
                discrimination = response.get('discrimination', 1.0)
                
                # Probability of correct response (3PL model simplified)
                p = self._probability_correct(theta, difficulty, discrimination)
                
                # First derivative
                first_derivative += discrimination * (correct - p)
                
                # Second derivative
                second_derivative -= discrimination ** 2 * p * (1 - p)
            
            # Newton-Raphson update
            if second_derivative != 0:
                theta = theta - first_derivative / second_derivative
            else:
                break
        
        # Standard error
        information = sum(
            response.get('discrimination', 1.0) ** 2 * 
            self._probability_correct(theta, response.get('difficulty', 0.0), response.get('discrimination', 1.0)) *
            (1 - self._probability_correct(theta, response.get('difficulty', 0.0), response.get('discrimination', 1.0)))
            for response in responses
        )
        
        standard_error = 1.0 / math.sqrt(information) if information > 0 else 1.0
        
        return theta, standard_error
    
    def _probability_correct(
        self,
        theta: float,
        difficulty: float,
        discrimination: float = 1.0,
        guessing: float = 0.0
    ) -> float:
        """
        Calculate probability of correct response using 3-parameter logistic model
        
        P(theta) = c + (1 - c) / (1 + exp(-a(theta - b)))
        """
        exponent = discrimination * (theta - difficulty)
        
        # Avoid overflow
        if exponent > 10:
            return 1.0 - guessing
        elif exponent < -10:
            return guessing
        
        return guessing + (1 - guessing) / (1 + math.exp(-exponent))
    
    def select_next_difficulty(
        self,
        theta: float,
        standard_error: float,
        available_difficulties: List[float]
    ) -> float:
        """Select next question difficulty to maximize information"""
        if not available_difficulties:
            return theta
        
        # Select difficulty closest to current ability estimate
        best_difficulty = min(
            available_difficulties,
            key=lambda d: abs(d - theta)
        )
        
        return best_difficulty

# ==================== QUESTION VALIDATOR ====================

class QuestionValidator:
    """Validates question quality and prerequisites"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config['validation']
        self.min_quality_score = self.config.get('min_quality_score', 0.7)
        self.check_prerequisites = self.config.get('check_prerequisites', True)
        self.kg_client = None  # Set externally
    
    async def validate_question(self, question: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate question quality
        
        Returns:
            {
                'valid': bool,
                'quality_score': float,
                'issues': List[str],
                'suggestions': List[str]
            }
        """
        issues = []
        suggestions = []
        scores = []
        
        # Check question text
        question_text = question.get('question_text', '')
        if not question_text or len(question_text) < 10:
            issues.append("Question text too short")
            scores.append(0.0)
        else:
            scores.append(1.0)
        
        # Check question type
        question_type = question.get('question_type', '')
        valid_types = ['multiple_choice', 'short_answer', 'true_false', 'fill_in_blank', 'open_ended']
        if question_type not in valid_types:
            issues.append(f"Invalid question type: {question_type}")
            scores.append(0.0)
        else:
            scores.append(1.0)
        
        # Check multiple choice options
        if question_type == 'multiple_choice':
            options = question.get('options', [])
            if len(options) < 2:
                issues.append("Multiple choice needs at least 2 options")
                scores.append(0.0)
            else:
                scores.append(1.0)
            
            # Check for duplicate options
            if len(options) != len(set(options)):
                issues.append("Duplicate options found")
                suggestions.append("Remove duplicate options")
                scores.append(0.5)
            else:
                scores.append(1.0)
        
        # Check answer key
        answer_key = question.get('answer_key')
        if not answer_key:
            issues.append("Missing answer key")
            scores.append(0.0)
        else:
            scores.append(1.0)
        
        # Check Bloom's level
        blooms_level = question.get('blooms_level', '')
        valid_blooms = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']
        if blooms_level not in valid_blooms:
            issues.append(f"Invalid Bloom's level: {blooms_level}")
            scores.append(0.5)
        else:
            scores.append(1.0)
        
        # Check difficulty
        difficulty = question.get('difficulty', 0)
        if not (1 <= difficulty <= 5):
            issues.append(f"Difficulty must be 1-5, got {difficulty}")
            scores.append(0.0)
        else:
            scores.append(1.0)
        
        # Check prerequisites (if enabled)
        if self.check_prerequisites and self.kg_client:
            concept_id = question.get('concept_id', '')
            if concept_id:
                prerequisites_valid = await self._validate_prerequisites(concept_id)
                if not prerequisites_valid:
                    suggestions.append("Consider checking prerequisite concepts")
                    scores.append(0.8)
                else:
                    scores.append(1.0)
        
        # Calculate overall quality score
        quality_score = sum(scores) / len(scores) if scores else 0.0
        
        valid = quality_score >= self.min_quality_score and len(issues) == 0
        
        if not valid and not issues:
            issues.append("Quality score below threshold")
        
        if quality_score < 0.9:
            suggestions.append("Review question clarity and completeness")
        
        return {
            'valid': valid,
            'quality_score': quality_score,
            'issues': issues,
            'suggestions': suggestions
        }
    
    async def _validate_prerequisites(self, concept_id: str) -> bool:
        """Check if prerequisites exist in knowledge graph"""
        if not self.kg_client:
            return True
        
        try:
            # Mock validation - in production, check actual graph
            return True
        except Exception as e:
            logger.error("prerequisite_validation_failed", error=str(e))
            return False

# ==================== GRADING ENGINE ====================

class GradingEngine:
    """Grades answers with partial credit and feedback"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
    
    def grade_answer(
        self,
        question: Dict[str, Any],
        user_answer: str,
        partial_credit: bool = True
    ) -> Dict[str, Any]:
        """
        Grade user answer
        
        Returns:
            {
                'correct': bool,
                'score': float,
                'feedback': str,
                'correct_answer': str,
                'remediation': str
            }
        """
        question_type = question.get('question_type', '')
        answer_key = question.get('answer_key', '')
        
        if question_type == 'multiple_choice':
            return self._grade_multiple_choice(user_answer, answer_key, question)
        elif question_type == 'true_false':
            return self._grade_true_false(user_answer, answer_key, question)
        elif question_type == 'short_answer':
            return self._grade_short_answer(user_answer, answer_key, question, partial_credit)
        elif question_type == 'fill_in_blank':
            return self._grade_fill_blank(user_answer, answer_key, question, partial_credit)
        elif question_type == 'open_ended':
            return self._grade_open_ended(user_answer, answer_key, question)
        else:
            return {
                'correct': False,
                'score': 0.0,
                'feedback': 'Unknown question type',
                'correct_answer': answer_key,
                'remediation': None
            }
    
    def _grade_multiple_choice(
        self,
        user_answer: str,
        answer_key: str,
        question: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Grade multiple choice question"""
        correct = user_answer.strip().lower() == answer_key.strip().lower()
        
        if correct:
            feedback = "Correct! Well done."
            score = 1.0
            remediation = None
        else:
            feedback = f"Incorrect. The correct answer is: {answer_key}"
            score = 0.0
            remediation = self._generate_remediation(question)
        
        return {
            'correct': correct,
            'score': score,
            'feedback': feedback,
            'correct_answer': answer_key,
            'remediation': remediation
        }
    
    def _grade_true_false(
        self,
        user_answer: str,
        answer_key: str,
        question: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Grade true/false question"""
        user_normalized = user_answer.strip().lower()
        answer_normalized = answer_key.strip().lower()
        
        correct = user_normalized in ['true', 't', '1'] and answer_normalized in ['true', 't', '1'] or \
                  user_normalized in ['false', 'f', '0'] and answer_normalized in ['false', 'f', '0']
        
        if correct:
            feedback = "Correct!"
            score = 1.0
            remediation = None
        else:
            feedback = f"Incorrect. The statement is {answer_key}."
            score = 0.0
            remediation = self._generate_remediation(question)
        
        return {
            'correct': correct,
            'score': score,
            'feedback': feedback,
            'correct_answer': answer_key,
            'remediation': remediation
        }
    
    def _grade_short_answer(
        self,
        user_answer: str,
        answer_key: str,
        question: Dict[str, Any],
        partial_credit: bool
    ) -> Dict[str, Any]:
        """Grade short answer with partial credit"""
        user_lower = user_answer.strip().lower()
        answer_lower = answer_key.strip().lower()
        
        # Exact match
        if user_lower == answer_lower:
            return {
                'correct': True,
                'score': 1.0,
                'feedback': 'Correct!',
                'correct_answer': answer_key,
                'remediation': None
            }
        
        # Partial credit based on keyword matching
        if partial_credit:
            answer_keywords = set(answer_lower.split())
            user_keywords = set(user_lower.split())
            
            overlap = len(answer_keywords & user_keywords)
            total = len(answer_keywords)
            
            if total > 0:
                score = overlap / total
            else:
                score = 0.0
            
            if score >= 0.7:
                feedback = f"Mostly correct! (Score: {score:.0%})"
                correct = True
                remediation = None
            elif score >= 0.4:
                feedback = f"Partially correct. (Score: {score:.0%}) Key points missing."
                correct = False
                remediation = self._generate_remediation(question)
            else:
                feedback = f"Incorrect. The correct answer is: {answer_key}"
                correct = False
                remediation = self._generate_remediation(question)
            
            return {
                'correct': correct,
                'score': score,
                'feedback': feedback,
                'correct_answer': answer_key,
                'remediation': remediation
            }
        else:
            return {
                'correct': False,
                'score': 0.0,
                'feedback': f'Incorrect. The correct answer is: {answer_key}',
                'correct_answer': answer_key,
                'remediation': self._generate_remediation(question)
            }
    
    def _grade_fill_blank(
        self,
        user_answer: str,
        answer_key: str,
        question: Dict[str, Any],
        partial_credit: bool
    ) -> Dict[str, Any]:
        """Grade fill in the blank"""
        return self._grade_short_answer(user_answer, answer_key, question, partial_credit)
    
    def _grade_open_ended(
        self,
        user_answer: str,
        answer_key: str,
        question: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Grade open-ended question (requires manual review)"""
        # Calculate basic metrics
        word_count = len(user_answer.split())
        has_content = word_count >= 20
        
        if has_content:
            feedback = "Answer submitted for review. Basic criteria met."
            score = 0.5  # Provisional score
        else:
            feedback = "Answer too short. Please provide more detail."
            score = 0.0
        
        return {
            'correct': None,  # Requires manual review
            'score': score,
            'feedback': feedback,
            'correct_answer': answer_key,
            'remediation': 'Provide more detailed explanation with examples.'
        }
    
    def _generate_remediation(self, question: Dict[str, Any]) -> str:
        """Generate remediation suggestion"""
        concept = question.get('concept_id', 'this concept')
        blooms_level = question.get('blooms_level', 'understand')
        
        remediation_templates = {
            'remember': f"Review the key facts and definitions about {concept}.",
            'understand': f"Study the explanation of {concept} and try to explain it in your own words.",
            'apply': f"Practice applying {concept} to different scenarios.",
            'analyze': f"Break down {concept} into its components and examine relationships.",
            'evaluate': f"Consider different perspectives on {concept} and form judgments.",
            'create': f"Try designing your own examples or solutions using {concept}."
        }
        
        return remediation_templates.get(blooms_level, f"Review {concept} and try again.")

# ==================== QUESTION BANK ====================

class QuestionBank:
    """Manages persistent question storage"""
    
    def __init__(self, db_path: str = "questions.db"):
        self.db_path = db_path
        self._initialize_db()
    
    def _initialize_db(self):
        """Initialize SQLite database"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS questions (
                    question_id TEXT PRIMARY KEY,
                    concept_id TEXT,
                    question_text TEXT,
                    question_type TEXT,
                    blooms_level TEXT,
                    difficulty INTEGER,
                    answer_key TEXT,
                    options TEXT,
                    metadata TEXT,
                    created_at TEXT,
                    quality_score REAL
                )
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_concept ON questions(concept_id)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_difficulty ON questions(difficulty)
            """)
    
    def save_question(self, question: Dict[str, Any]) -> str:
        """Save question to database"""
        question_id = question.get('question_id', str(uuid.uuid4()))
        
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT OR REPLACE INTO questions
                (question_id, concept_id, question_text, question_type, blooms_level, 
                 difficulty, answer_key, options, metadata, created_at, quality_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                question_id,
                question.get('concept_id', ''),
                question.get('question_text', ''),
                question.get('question_type', ''),
                question.get('blooms_level', ''),
                question.get('difficulty', 3),
                question.get('answer_key', ''),
                json.dumps(question.get('options', [])),
                json.dumps(question.get('metadata', {})),
                datetime.utcnow().isoformat(),
                question.get('quality_score', 0.0)
            ))
        
        return question_id
    
    def get_question(self, question_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve question by ID"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                "SELECT * FROM questions WHERE question_id = ?",
                (question_id,)
            )
            row = cursor.fetchone()
            
            if row:
                return {
                    'question_id': row['question_id'],
                    'concept_id': row['concept_id'],
                    'question_text': row['question_text'],
                    'question_type': row['question_type'],
                    'blooms_level': row['blooms_level'],
                    'difficulty': row['difficulty'],
                    'answer_key': row['answer_key'],
                    'options': json.loads(row['options']),
                    'metadata': json.loads(row['metadata']),
                    'created_at': row['created_at'],
                    'quality_score': row['quality_score']
                }
            
            return None
    
    def get_questions_by_concept(
        self,
        concept_id: str,
        difficulty: Optional[int] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get questions for a concept"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            
            if difficulty:
                cursor = conn.execute(
                    "SELECT * FROM questions WHERE concept_id = ? AND difficulty = ? LIMIT ?",
                    (concept_id, difficulty, limit)
                )
            else:
                cursor = conn.execute(
                    "SELECT * FROM questions WHERE concept_id = ? LIMIT ?",
                    (concept_id, limit)
                )
            
            questions = []
            for row in cursor:
                questions.append({
                    'question_id': row['question_id'],
                    'concept_id': row['concept_id'],
                    'question_text': row['question_text'],
                    'question_type': row['question_type'],
                    'blooms_level': row['blooms_level'],
                    'difficulty': row['difficulty'],
                    'answer_key': row['answer_key'],
                    'options': json.loads(row['options']),
                    'metadata': json.loads(row['metadata']),
                    'quality_score': row['quality_score']
                })
            
            return questions

# ==================== ASSESSMENT AGENT ====================

class AssessmentAgent:
    """Main agent orchestrating assessment generation and grading"""
    
    def __init__(self, config_path: str = "config.yaml"):
        # Load config
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = yaml.safe_load(f)
        
        # Initialize components
        self.t5_generator = T5QuestionGenerator(self.config)
        self.irt_model = IRTModel()
        self.validator = QuestionValidator(self.config)
        self.grading_engine = GradingEngine(self.config)
        self.question_bank = QuestionBank()
        
        # HTTP clients
        self.kg_client = httpx.AsyncClient(timeout=30.0)
        self.analytics_client = httpx.AsyncClient(timeout=30.0)
        
        self.validator.kg_client = self.kg_client
        
        logger.info("assessment_agent_initialized")
    
    async def initialize(self):
        """Load models and initialize components"""
        logger.info("initializing_models")
        self.t5_generator.load_model()
        logger.info("agent_ready")
    
    async def generate_questions(
        self,
        concept_id: str,
        num_questions: int = 5,
        difficulty: int = 3,
        question_types: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate questions for a concept
        
        Pipeline:
        1. Get concept info from knowledge graph
        2. Generate questions with T5
        3. Create distractors for MC questions
        4. Validate questions
        5. Save to question bank
        6. Return questions
        """
        try:
            # Get concept info
            concept_name = await self._get_concept_name(concept_id)
            
            if not question_types:
                question_types = self.config['question_generation']['types']
            
            questions = []
            blooms_levels = self.config['question_generation']['blooms_levels']
            
            for i in range(num_questions):
                # Select question type and Bloom's level
                question_type = random.choice(question_types)
                blooms_level = random.choice(blooms_levels)
                
                # Generate question text
                question_text = await self.t5_generator.generate_question(
                    concept_name,
                    blooms_level,
                    difficulty,
                    question_type,
                    question_index=i  # Pass index for varied fallback questions
                )
                
                # Create question object
                question = {
                    'question_id': str(uuid.uuid4()),
                    'concept_id': concept_id,
                    'question_text': question_text,
                    'question_type': question_type,
                    'blooms_level': blooms_level,
                    'difficulty': difficulty,
                    'answer_key': '',
                    'options': [],
                    'metadata': {
                        'generated_at': datetime.utcnow().isoformat(),
                        'model': 't5-base',
                        'discrimination': 1.0
                    }
                }
                
                # For multiple choice, generate options
                if question_type == 'multiple_choice':
                    # Extract or generate answer key
                    answer_key = self._extract_answer_from_question(question_text, concept_name)
                    options = self.t5_generator.generate_multiple_choice_options(
                        question_text,
                        answer_key,
                        self.config['question_generation']['num_distractors']
                    )
                    question['answer_key'] = answer_key
                    question['options'] = options
                else:
                    # Generate sample answer
                    question['answer_key'] = self._generate_sample_answer(
                        question_text,
                        concept_name,
                        blooms_level
                    )
                
                # Validate question
                validation = await self.validator.validate_question(question)
                question['quality_score'] = validation['quality_score']
                question['metadata']['validation'] = validation
                
                # Save to question bank
                self.question_bank.save_question(question)
                
                questions.append(question)
            
            logger.info(
                "questions_generated",
                concept_id=concept_id,
                num_questions=len(questions)
            )
            
            return questions
            
        except Exception as e:
            logger.error("question_generation_failed", error=str(e))
            raise
    
    async def generate_by_blooms(
        self,
        concept: str,
        level: str,
        num_questions: int = 3
    ) -> Dict[str, Any]:
        """Generate questions for specific Bloom's taxonomy level"""
        try:
            questions = []
            
            for i in range(num_questions):
                question_text = await self.t5_generator.generate_question(
                    concept,
                    level,
                    difficulty=3,
                    question_type='short_answer',
                    question_index=i  # Pass index for varied fallback questions
                )
                
                question = {
                    'question_id': str(uuid.uuid4()),
                    'concept_id': concept,
                    'question_text': question_text,
                    'question_type': 'short_answer',
                    'blooms_level': level,
                    'difficulty': 3,
                    'answer_key': self._generate_sample_answer(question_text, concept, level),
                    'options': [],
                    'metadata': {
                        'generated_at': datetime.utcnow().isoformat()
                    }
                }
                
                self.question_bank.save_question(question)
                questions.append(question)
            
            return {
                'concept': concept,
                'blooms_level': level,
                'questions': questions
            }
            
        except Exception as e:
            logger.error("blooms_generation_failed", error=str(e))
            raise
    
    def create_multiple_choice(
        self,
        question: str,
        answer: str
    ) -> Dict[str, Any]:
        """Create multiple choice question with distractors"""
        options = self.t5_generator.generate_multiple_choice_options(
            question,
            answer,
            self.config['question_generation']['num_distractors']
        )
        
        return {
            'question_id': str(uuid.uuid4()),
            'question_text': question,
            'question_type': 'multiple_choice',
            'answer_key': answer,
            'options': options,
            'difficulty': 3,
            'blooms_level': 'understand'
        }
    
    def generate_distractors(
        self,
        correct_answer: str,
        context: str
    ) -> List[str]:
        """Generate plausible distractors"""
        return self.t5_generator.generate_multiple_choice_options(
            context,
            correct_answer,
            self.config['question_generation']['num_distractors']
        )[1:]  # Exclude correct answer
    
    async def validate_question(
        self,
        question: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate question quality"""
        return await self.validator.validate_question(question)
    
    def grade_answer(
        self,
        question_id: str,
        user_answer: str,
        partial_credit: bool = True
    ) -> Dict[str, Any]:
        """Grade user answer"""
        # Get question from bank
        question = self.question_bank.get_question(question_id)
        
        if not question:
            raise ValueError(f"Question not found: {question_id}")
        
        # Grade answer
        result = self.grading_engine.grade_answer(question, user_answer, partial_credit)
        result['question_id'] = question_id
        
        return result
    
    async def adaptive_next_question(
        self,
        user_id: str,
        history: List[Dict[str, Any]],
        concept_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Select next question using IRT adaptive testing
        
        Pipeline:
        1. Estimate user ability from history
        2. Select optimal difficulty
        3. Get question from bank or generate new
        4. Return question
        """
        try:
            # Estimate current ability
            theta, standard_error = self.irt_model.estimate_ability(history)
            
            # Store ability estimate
            self.irt_model.ability_estimates[user_id] = theta
            
            # Map theta to difficulty (1-5 scale)
            # theta typically ranges from -3 to +3
            difficulty = int(max(1, min(5, (theta + 3) / 6 * 5)))
            
            # Get or generate question
            if concept_id:
                questions = self.question_bank.get_questions_by_concept(
                    concept_id,
                    difficulty,
                    limit=5
                )
                
                if questions:
                    question = random.choice(questions)
                else:
                    # Generate new question
                    new_questions = await self.generate_questions(
                        concept_id,
                        num_questions=1,
                        difficulty=difficulty
                    )
                    question = new_questions[0]
            else:
                # Need concept_id in production
                raise ValueError("concept_id required for adaptive testing")
            
            # Add adaptive metadata
            question['metadata']['adaptive'] = {
                'theta': theta,
                'standard_error': standard_error,
                'selected_difficulty': difficulty
            }
            
            logger.info(
                "adaptive_question_selected",
                user_id=user_id,
                theta=theta,
                difficulty=difficulty
            )
            
            return question
            
        except Exception as e:
            logger.error("adaptive_selection_failed", error=str(e))
            raise
    
    def calculate_mastery(
        self,
        quiz_results: List[Dict[str, Any]]
    ) -> float:
        """
        Calculate mastery level from quiz results
        
        Returns:
            Mastery score (0.0 to 1.0)
        """
        if not quiz_results:
            return 0.0
        
        # Calculate weighted score
        total_score = 0.0
        total_weight = 0.0
        
        for result in quiz_results:
            score = result.get('score', 0.0)
            difficulty = result.get('difficulty', 3)
            
            # Weight by difficulty
            weight = difficulty / 5.0
            
            total_score += score * weight
            total_weight += weight
        
        mastery = total_score / total_weight if total_weight > 0 else 0.0
        
        return min(1.0, mastery)
    
    async def generate_quiz(
        self,
        concept_ids: List[str],
        num_questions: int = 10,
        difficulty_range: Tuple[int, int] = (2, 4),
        blooms_distribution: Optional[Dict[str, int]] = None
    ) -> Dict[str, Any]:
        """Generate complete quiz"""
        try:
            quiz_id = str(uuid.uuid4())
            questions = []
            
            # Default Bloom's distribution
            if not blooms_distribution:
                blooms_distribution = {
                    'remember': 2,
                    'understand': 3,
                    'apply': 3,
                    'analyze': 2
                }
            
            # Generate questions per Bloom's level
            for blooms_level, count in blooms_distribution.items():
                for concept_id in concept_ids[:count]:
                    difficulty = random.randint(*difficulty_range)
                    
                    new_questions = await self.generate_questions(
                        concept_id,
                        num_questions=1,
                        difficulty=difficulty,
                        question_types=['multiple_choice', 'short_answer']
                    )
                    
                    if new_questions:
                        questions.extend(new_questions)
                    
                    if len(questions) >= num_questions:
                        break
                
                if len(questions) >= num_questions:
                    break
            
            # Shuffle questions
            random.shuffle(questions)
            questions = questions[:num_questions]
            
            return {
                'quiz_id': quiz_id,
                'concept_ids': concept_ids,
                'questions': questions,
                'num_questions': len(questions),
                'created_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error("quiz_generation_failed", error=str(e))
            raise
    
    async def _get_concept_name(self, concept_id: str) -> str:
        """Get concept name from knowledge graph"""
        try:
            base_url = self.config['knowledge_graph_api']['base_url']
            url = f"{base_url}/concepts/{concept_id}"
            
            response = await self.kg_client.get(url)
            response.raise_for_status()
            
            data = response.json()
            return data.get('name', concept_id)
            
        except Exception as e:
            logger.warning("concept_fetch_failed", error=str(e))
            return concept_id
    
    def _extract_answer_from_question(self, question: str, concept: str) -> str:
        """Extract answer from question text"""
        # Simple heuristic - in production, use more sophisticated extraction
        return concept
    
    def _generate_sample_answer(
        self,
        question: str,
        concept: str,
        blooms_level: str
    ) -> str:
        """Generate sample answer"""
        templates = {
            'remember': f"{concept} is...",
            'understand': f"{concept} works by...",
            'apply': f"To apply {concept}, you would...",
            'analyze': f"The components of {concept} are...",
            'evaluate': f"{concept} is effective because...",
            'create': f"A solution using {concept} would include..."
        }
        
        return templates.get(blooms_level, f"Answer related to {concept}")
    
    def get_health_status(self) -> Dict[str, Any]:
        """Get agent health status"""
        return {
            'status': 'healthy',
            'model_loaded': self.t5_generator.model is not None,
            'device': str(self.t5_generator.device),
            'question_bank_size': self._get_question_count(),
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def _get_question_count(self) -> int:
        """Get total questions in bank"""
        try:
            with sqlite3.connect(self.question_bank.db_path) as conn:
                cursor = conn.execute("SELECT COUNT(*) FROM questions")
                return cursor.fetchone()[0]
        except Exception:
            return 0

# ==================== FASTAPI APP ====================

app = FastAPI(
    title="Assessment Agent",
    description="Adaptive assessment generation with T5, IRT, and Bloom's taxonomy",
    version="1.0.0"
)

# Prometheus metrics - with duplicate handling
from prometheus_client import REGISTRY

def get_or_create_counter(name, documentation, labelnames):
    try:
        return Counter(name, documentation, labelnames)
    except ValueError:
        return REGISTRY._names_to_collectors[name]

def get_or_create_histogram(name, documentation, labelnames=None):
    try:
        return Histogram(name, documentation, labelnames or [])
    except ValueError:
        return REGISTRY._names_to_collectors[name]

QUESTIONS_GENERATED = get_or_create_counter(
    'assessment_questions_generated_total',
    'Total questions generated',
    ['type', 'blooms_level']
)

GENERATION_DURATION = get_or_create_histogram(
    'assessment_generation_duration_seconds',
    'Time to generate questions'
)

ANSWERS_GRADED = get_or_create_counter(
    'assessment_answers_graded_total',
    'Total answers graded',
    ['correct']
)

MODEL_INFERENCE = get_or_create_histogram(
    'assessment_model_inference_seconds',
    'Model inference time'
)

# Mount Prometheus metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# Global agent instance
agent: Optional[AssessmentAgent] = None

@app.on_event("startup")
async def startup_event():
    """Initialize agent on startup"""
    global agent
    agent = AssessmentAgent()
    await agent.initialize()

@app.post("/generate-questions")
async def generate_questions(request: QuestionGenerationRequest):
    """Generate questions for a concept"""
    try:
        with GENERATION_DURATION.time():
            questions = await agent.generate_questions(
                request.concept_id,
                request.num_questions,
                request.difficulty,
                request.question_types
            )
        
        for q in questions:
            QUESTIONS_GENERATED.labels(
                type=q['question_type'],
                blooms_level=q['blooms_level']
            ).inc()
        
        return {'questions': questions}
        
    except Exception as e:
        logger.error("generate_endpoint_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-by-blooms")
async def generate_by_blooms(request: BloomsGenerationRequest):
    """Generate questions by Bloom's taxonomy level"""
    try:
        result = await agent.generate_by_blooms(
            request.concept,
            request.level,
            request.num_questions
        )
        
        for q in result['questions']:
            QUESTIONS_GENERATED.labels(
                type=q['question_type'],
                blooms_level=q['blooms_level']
            ).inc()
        
        return result
        
    except Exception as e:
        logger.error("blooms_endpoint_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/validate-question")
async def validate_question(request: QuestionValidationRequest):
    """Validate question quality"""
    try:
        validation = await agent.validate_question(request.question)
        return validation
        
    except Exception as e:
        logger.error("validation_endpoint_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/grade-answer", response_model=GradeResponse)
async def grade_answer(request: GradeAnswerRequest):
    """Grade user answer"""
    try:
        result = agent.grade_answer(
            request.question_id,
            request.user_answer,
            request.partial_credit
        )
        
        ANSWERS_GRADED.labels(correct=str(result['correct'])).inc()
        
        return result
        
    except Exception as e:
        logger.error("grading_endpoint_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/adaptive-question")
async def adaptive_question(request: AdaptiveQuestionRequest):
    """Get next adaptive question using IRT"""
    try:
        question = await agent.adaptive_next_question(
            request.user_id,
            request.history,
            request.concept_id
        )
        
        return question
        
    except Exception as e:
        logger.error("adaptive_endpoint_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/question/{question_id}")
async def get_question(question_id: str):
    """Retrieve question by ID"""
    try:
        question = agent.question_bank.get_question(question_id)
        
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        
        return question
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_question_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/quiz")
async def create_quiz(request: QuizRequest):
    """Generate complete quiz"""
    try:
        quiz = await agent.generate_quiz(
            request.concept_ids,
            request.num_questions,
            request.difficulty_range,
            request.blooms_distribution
        )
        
        return quiz
        
    except Exception as e:
        logger.error("quiz_endpoint_failed", error=str(e))
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
    
    port = config['agent'].get('port', 8003)
    host = config['agent'].get('host', '0.0.0.0')
    
    uvicorn.run(
        "assessment_agent:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )
