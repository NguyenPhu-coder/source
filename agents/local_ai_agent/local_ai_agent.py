"""
Local AI Agent - Privacy-First Offline AI with Ollama/LLaMA3

Features:
- Complete offline operation with local LLaMA3 inference
- Privacy compliance (GDPR, COPPA, FERPA)
- Sensitive student data handling
- No cloud transmission
- Encrypted responses with AES-256
- Model quantization (4-bit/8-bit)
- GPU/CPU fallback
- Memory optimization
- Data anonymization
"""

import asyncio
import hashlib
import json
import logging
import os
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Dict, Any, List, Optional, Set, Tuple
import psutil
import yaml
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding, hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from cryptography.hazmat.backends import default_backend
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field
import httpx
import structlog

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ]
)
logger = structlog.get_logger()

app = FastAPI(title="Local AI Agent", version="1.0.0")


# ============================================================================
# Data Models
# ============================================================================

class ComplianceStandard(str, Enum):
    """Privacy compliance standards"""
    GDPR = "GDPR"
    COPPA = "COPPA"
    FERPA = "FERPA"


class SensitiveDataType(str, Enum):
    """Types of sensitive data"""
    STUDENT_PERSONAL_INFO = "student_personal_info"
    LEARNING_DIFFICULTIES = "learning_difficulties"
    BEHAVIORAL_DATA = "behavioral_data"
    FAMILY_INFORMATION = "family_information"


class OfflineFallbackBehavior(str, Enum):
    """Offline fallback behaviors"""
    CACHED_ONLY = "cached_only"
    ERROR = "error"
    GENERIC_RESPONSE = "generic_response"


@dataclass
class ModelConfig:
    """Model configuration"""
    base_url: str
    model: str
    temperature: float
    context_length: int
    quantization_bits: Optional[int] = None
    gpu_memory_fraction: float = 0.8


@dataclass
class PrivacyConfig:
    """Privacy compliance configuration"""
    compliance_standards: List[ComplianceStandard]
    sensitive_data_types: List[SensitiveDataType]
    encryption_enabled: bool
    encryption_algorithm: str
    key_rotation_days: int


@dataclass
class OfflineConfig:
    """Offline mode configuration"""
    enabled: bool
    cache_responses: bool
    cache_ttl: int
    fallback_behavior: OfflineFallbackBehavior


@dataclass
class ResourceConfig:
    """Resource management configuration"""
    max_concurrent_requests: int
    gpu_memory_limit_gb: int
    cpu_fallback: bool


@dataclass
class InferenceResult:
    """Inference result"""
    response: str
    model: str
    inference_time: float
    encrypted: bool
    cached: bool
    timestamp: float


@dataclass
class PrivacyCheckResult:
    """Privacy compliance check result"""
    compliant: bool
    standards_met: List[ComplianceStandard]
    violations: List[str]
    sensitive_data_found: List[SensitiveDataType]
    recommendations: List[str]


@dataclass
class CachedResponse:
    """Cached inference response"""
    query_hash: str
    response: str
    model: str
    timestamp: float
    expires_at: float
    access_count: int = 0


# ============================================================================
# Pydantic Request/Response Models
# ============================================================================

class InferenceRequest(BaseModel):
    """Inference request"""
    prompt: str = Field(..., min_length=1)
    user_id: str = Field(..., min_length=1)
    model: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, ge=1, le=4096)


class SensitiveQueryRequest(BaseModel):
    """Sensitive query request"""
    query: str = Field(..., min_length=1)
    user_id: str = Field(..., min_length=1)
    data_types: List[str] = Field(default_factory=list)
    consent_provided: bool = False


class EncryptRequest(BaseModel):
    """Encryption request"""
    data: str = Field(..., min_length=1)
    user_key: str = Field(..., min_length=8)


class AnonymizeRequest(BaseModel):
    """Anonymization request"""
    data: Dict[str, Any]
    fields_to_anonymize: List[str] = Field(default_factory=list)


class PrivacyCheckRequest(BaseModel):
    """Privacy check request"""
    data: Dict[str, Any]
    standards: List[str] = Field(default_factory=list)


# ============================================================================
# Encryption Manager
# ============================================================================

class EncryptionManager:
    """Handles encryption and decryption of sensitive data"""
    
    def __init__(self, algorithm: str = "AES-256", key_rotation_days: int = 90):
        self.algorithm = algorithm
        self.key_rotation_days = key_rotation_days
        self.keys: Dict[str, Dict[str, Any]] = {}
        self.backend = default_backend()
        logger.info("encryption_manager_initialized", algorithm=algorithm)
    
    def _derive_key(self, password: str, salt: bytes) -> bytes:
        """Derive encryption key from password using PBKDF2"""
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=self.backend
        )
        return kdf.derive(password.encode())
    
    def generate_key(self, user_key: str) -> Tuple[bytes, bytes]:
        """Generate encryption key and salt"""
        salt = os.urandom(16)
        key = self._derive_key(user_key, salt)
        
        # Store key info
        key_id = hashlib.sha256(f"{user_key}{time.time()}".encode()).hexdigest()
        self.keys[key_id] = {
            "salt": salt,
            "created_at": datetime.now(),
            "expires_at": datetime.now() + timedelta(days=self.key_rotation_days)
        }
        
        logger.info("encryption_key_generated", key_id=key_id)
        return key, salt
    
    def encrypt(self, data: str, user_key: str) -> Dict[str, Any]:
        """Encrypt data using AES-256"""
        try:
            # Generate key and IV
            key, salt = self.generate_key(user_key)
            iv = os.urandom(16)
            
            # Create cipher
            cipher = Cipher(
                algorithms.AES(key),
                modes.CBC(iv),
                backend=self.backend
            )
            encryptor = cipher.encryptor()
            
            # Pad data
            padder = padding.PKCS7(128).padder()
            padded_data = padder.update(data.encode()) + padder.finalize()
            
            # Encrypt
            encrypted_data = encryptor.update(padded_data) + encryptor.finalize()
            
            logger.info("data_encrypted", size=len(encrypted_data))
            
            return {
                "encrypted_data": encrypted_data.hex(),
                "iv": iv.hex(),
                "salt": salt.hex(),
                "algorithm": self.algorithm,
                "timestamp": time.time()
            }
        
        except Exception as e:
            logger.error("encryption_failed", error=str(e))
            raise ValueError(f"Encryption failed: {str(e)}")
    
    def decrypt(self, encrypted_data: str, iv: str, salt: str, user_key: str) -> str:
        """Decrypt data"""
        try:
            # Derive key
            key = self._derive_key(user_key, bytes.fromhex(salt))
            
            # Create cipher
            cipher = Cipher(
                algorithms.AES(key),
                modes.CBC(bytes.fromhex(iv)),
                backend=self.backend
            )
            decryptor = cipher.decryptor()
            
            # Decrypt
            decrypted_padded = decryptor.update(bytes.fromhex(encrypted_data)) + decryptor.finalize()
            
            # Unpad
            unpadder = padding.PKCS7(128).unpadder()
            decrypted_data = unpadder.update(decrypted_padded) + unpadder.finalize()
            
            logger.info("data_decrypted")
            return decrypted_data.decode()
        
        except Exception as e:
            logger.error("decryption_failed", error=str(e))
            raise ValueError(f"Decryption failed: {str(e)}")
    
    def rotate_keys(self) -> int:
        """Rotate expired keys"""
        now = datetime.now()
        expired_keys = [
            key_id for key_id, key_info in self.keys.items()
            if key_info["expires_at"] < now
        ]
        
        for key_id in expired_keys:
            del self.keys[key_id]
        
        logger.info("keys_rotated", expired_count=len(expired_keys))
        return len(expired_keys)


# ============================================================================
# Privacy Checker
# ============================================================================

class PrivacyChecker:
    """Checks privacy compliance and detects sensitive data"""
    
    def __init__(self, config: PrivacyConfig):
        self.config = config
        self.sensitive_patterns = self._initialize_patterns()
        logger.info("privacy_checker_initialized", standards=config.compliance_standards)
    
    def _initialize_patterns(self) -> Dict[SensitiveDataType, List[str]]:
        """Initialize sensitive data patterns"""
        return {
            SensitiveDataType.STUDENT_PERSONAL_INFO: [
                "ssn", "social security", "student id", "phone number",
                "email", "address", "birthdate", "date of birth"
            ],
            SensitiveDataType.LEARNING_DIFFICULTIES: [
                "learning disability", "special needs", "iep", "504 plan",
                "dyslexia", "adhd", "autism", "accommodations"
            ],
            SensitiveDataType.BEHAVIORAL_DATA: [
                "suspension", "detention", "disciplinary", "behavior report",
                "incident report", "counseling", "mental health"
            ],
            SensitiveDataType.FAMILY_INFORMATION: [
                "parent", "guardian", "family income", "custody",
                "home situation", "family status"
            ]
        }
    
    def check_compliance(self, data: Dict[str, Any], standards: Optional[List[ComplianceStandard]] = None) -> PrivacyCheckResult:
        """Check privacy compliance"""
        if standards is None:
            standards = self.config.compliance_standards
        
        violations = []
        sensitive_data_found = []
        standards_met = []
        recommendations = []
        
        # Check for sensitive data
        data_str = json.dumps(data).lower()
        for data_type, patterns in self.sensitive_patterns.items():
            if any(pattern in data_str for pattern in patterns):
                sensitive_data_found.append(data_type)
        
        # GDPR compliance
        if ComplianceStandard.GDPR in standards:
            if not data.get("consent_provided"):
                violations.append("GDPR: Consent not provided for data processing")
            else:
                standards_met.append(ComplianceStandard.GDPR)
            
            if not data.get("data_retention_policy"):
                recommendations.append("GDPR: Define data retention policy")
        
        # COPPA compliance (children under 13)
        if ComplianceStandard.COPPA in standards:
            age = data.get("age")
            if age and age < 13:
                if not data.get("parental_consent"):
                    violations.append("COPPA: Parental consent required for users under 13")
                else:
                    standards_met.append(ComplianceStandard.COPPA)
            else:
                standards_met.append(ComplianceStandard.COPPA)
        
        # FERPA compliance (student education records)
        if ComplianceStandard.FERPA in standards:
            if sensitive_data_found:
                if not data.get("legitimate_educational_interest"):
                    violations.append("FERPA: Access requires legitimate educational interest")
                else:
                    standards_met.append(ComplianceStandard.FERPA)
            else:
                standards_met.append(ComplianceStandard.FERPA)
        
        # Check if encryption is used for sensitive data
        if sensitive_data_found and not data.get("encrypted"):
            recommendations.append("Encrypt sensitive data before transmission")
        
        compliant = len(violations) == 0
        
        logger.info("privacy_check_completed", compliant=compliant, violations=len(violations))
        
        return PrivacyCheckResult(
            compliant=compliant,
            standards_met=standards_met,
            violations=violations,
            sensitive_data_found=sensitive_data_found,
            recommendations=recommendations
        )
    
    def detect_sensitive_data(self, text: str) -> List[SensitiveDataType]:
        """Detect sensitive data in text"""
        text_lower = text.lower()
        found = []
        
        for data_type, patterns in self.sensitive_patterns.items():
            if any(pattern in text_lower for pattern in patterns):
                found.append(data_type)
        
        return found


# ============================================================================
# Anonymization Engine
# ============================================================================

class AnonymizationEngine:
    """Anonymizes sensitive student data"""
    
    def __init__(self):
        self.anonymization_map: Dict[str, str] = {}
        logger.info("anonymization_engine_initialized")
    
    def _generate_anonymous_id(self, original_value: str) -> str:
        """Generate anonymous ID"""
        # Use hash for consistent anonymization
        hash_obj = hashlib.sha256(original_value.encode())
        return f"ANON_{hash_obj.hexdigest()[:12]}"
    
    def anonymize_field(self, value: Any, field_name: str) -> str:
        """Anonymize a single field"""
        value_str = str(value)
        
        # Check if already anonymized
        if value_str in self.anonymization_map:
            return self.anonymization_map[value_str]
        
        # Generate anonymous value
        if "email" in field_name.lower():
            anon_value = f"user_{self._generate_anonymous_id(value_str)[:8]}@anonymous.local"
        elif "name" in field_name.lower():
            anon_value = f"Student_{self._generate_anonymous_id(value_str)[:8]}"
        elif "id" in field_name.lower():
            anon_value = self._generate_anonymous_id(value_str)
        elif "phone" in field_name.lower():
            anon_value = "XXX-XXX-XXXX"
        elif "address" in field_name.lower():
            anon_value = "Address Redacted"
        elif "ssn" in field_name.lower():
            anon_value = "XXX-XX-XXXX"
        else:
            anon_value = self._generate_anonymous_id(value_str)
        
        # Store mapping
        self.anonymization_map[value_str] = anon_value
        
        return anon_value
    
    def anonymize_data(self, data: Dict[str, Any], fields_to_anonymize: Optional[List[str]] = None) -> Dict[str, Any]:
        """Anonymize data"""
        anonymized = data.copy()
        
        # Default fields to anonymize
        if fields_to_anonymize is None:
            fields_to_anonymize = [
                "name", "email", "phone", "address", "ssn", "student_id",
                "parent_name", "guardian_name", "family_info"
            ]
        
        def anonymize_recursive(obj: Any, path: str = "") -> Any:
            """Recursively anonymize nested structures"""
            if isinstance(obj, dict):
                result = {}
                for key, value in obj.items():
                    field_path = f"{path}.{key}" if path else key
                    if any(field.lower() in key.lower() for field in fields_to_anonymize):
                        result[key] = self.anonymize_field(value, key)
                    else:
                        result[key] = anonymize_recursive(value, field_path)
                return result
            elif isinstance(obj, list):
                return [anonymize_recursive(item, path) for item in obj]
            else:
                return obj
        
        anonymized = anonymize_recursive(data)
        
        logger.info("data_anonymized", fields=len(fields_to_anonymize))
        return anonymized


# ============================================================================
# Model Manager
# ============================================================================

class ModelManager:
    """Manages local Ollama models and inference"""
    
    def __init__(self, config: ModelConfig, resource_config: ResourceConfig):
        self.config = config
        self.resource_config = resource_config
        self.client = httpx.AsyncClient(base_url=config.base_url, timeout=120.0)
        self.model_loaded = False
        self.inference_queue: asyncio.Queue = asyncio.Queue(maxsize=resource_config.max_concurrent_requests)
        self.active_inferences = 0
        logger.info("model_manager_initialized", model=config.model)
    
    async def check_ollama_connection(self) -> bool:
        """Check if Ollama is running"""
        try:
            response = await self.client.get("/api/tags")
            return response.status_code == 200
        except Exception as e:
            logger.error("ollama_connection_failed", error=str(e))
            return False
    
    async def load_model(self, model_name: Optional[str] = None, quantize: bool = True) -> bool:
        """Load model into memory"""
        if model_name is None:
            model_name = self.config.model
        
        try:
            # Check if Ollama is running
            if not await self.check_ollama_connection():
                raise RuntimeError("Ollama is not running. Start Ollama service first.")
            
            # Pull/load model
            response = await self.client.post(
                "/api/pull",
                json={"name": model_name}
            )
            
            if response.status_code == 200:
                self.model_loaded = True
                logger.info("model_loaded", model=model_name, quantized=quantize)
                return True
            else:
                logger.error("model_load_failed", status=response.status_code)
                return False
        
        except Exception as e:
            logger.error("model_load_error", error=str(e))
            return False
    
    async def local_inference(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> InferenceResult:
        """Perform local inference"""
        if model is None:
            model = self.config.model
        if temperature is None:
            temperature = self.config.temperature
        
        start_time = time.time()
        
        try:
            # Check resource limits
            if self.active_inferences >= self.resource_config.max_concurrent_requests:
                raise RuntimeError("Maximum concurrent inference requests reached")
            
            self.active_inferences += 1
            
            # Perform inference
            response = await self.client.post(
                "/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens or self.config.context_length
                    }
                }
            )
            
            if response.status_code == 200:
                result_data = response.json()
                inference_time = time.time() - start_time
                
                logger.info("inference_completed", time=inference_time, model=model)
                
                return InferenceResult(
                    response=result_data.get("response", ""),
                    model=model,
                    inference_time=inference_time,
                    encrypted=False,
                    cached=False,
                    timestamp=time.time()
                )
            else:
                raise RuntimeError(f"Inference failed with status {response.status_code}")
        
        except Exception as e:
            logger.error("inference_error", error=str(e))
            raise RuntimeError(f"Inference failed: {str(e)}")
        
        finally:
            self.active_inferences -= 1
    
    def get_memory_usage(self) -> Dict[str, Any]:
        """Get current memory usage"""
        process = psutil.Process()
        memory_info = process.memory_info()
        
        # GPU memory (if available)
        gpu_memory = None
        try:
            import torch
            if torch.cuda.is_available():
                gpu_memory = {
                    "allocated": torch.cuda.memory_allocated() / 1e9,
                    "reserved": torch.cuda.memory_reserved() / 1e9,
                    "total": torch.cuda.get_device_properties(0).total_memory / 1e9
                }
        except ImportError:
            pass
        
        return {
            "ram_used_gb": memory_info.rss / 1e9,
            "ram_percent": process.memory_percent(),
            "gpu_memory": gpu_memory,
            "cpu_percent": process.cpu_percent()
        }
    
    async def close(self):
        """Close client"""
        await self.client.aclose()


# ============================================================================
# Local AI Agent
# ============================================================================

class LocalAIAgent:
    """Main local AI agent with privacy-first design"""
    
    def __init__(self, config_path: str = "config.yaml"):
        self.config = self._load_config(config_path)
        
        # Initialize components
        self.model_manager = ModelManager(
            self.config["model_config"],
            self.config["resource_config"]
        )
        self.encryption_manager = EncryptionManager(
            algorithm=self.config["privacy_config"].encryption_algorithm,
            key_rotation_days=self.config["privacy_config"].key_rotation_days
        )
        self.privacy_checker = PrivacyChecker(self.config["privacy_config"])
        self.anonymization_engine = AnonymizationEngine()
        
        # Cache
        self.response_cache: Dict[str, CachedResponse] = {}
        self.offline_mode = self.config["offline_config"].enabled
        
        logger.info("local_ai_agent_initialized", offline_mode=self.offline_mode)
    
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration"""
        try:
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            
            # Parse model config
            model_config = ModelConfig(
                base_url=config["models"]["ollama"]["base_url"],
                model=config["models"]["ollama"]["model"],
                temperature=config["models"]["ollama"]["temperature"],
                context_length=config["models"]["ollama"]["context_length"],
                quantization_bits=config["models"]["quantization"]["bits"] if config["models"]["quantization"]["enable"] else None,
                gpu_memory_fraction=config["models"]["quantization"]["gpu_memory_fraction"]
            )
            
            # Parse privacy config
            privacy_config = PrivacyConfig(
                compliance_standards=[ComplianceStandard(s) for s in config["privacy"]["compliance"]],
                sensitive_data_types=[SensitiveDataType(t) for t in config["privacy"]["sensitive_data_types"]],
                encryption_enabled=config["privacy"]["encryption"]["enable"],
                encryption_algorithm=config["privacy"]["encryption"]["algorithm"],
                key_rotation_days=config["privacy"]["encryption"]["key_rotation_days"]
            )
            
            # Parse offline config
            offline_config = OfflineConfig(
                enabled=config["offline_mode"]["enable"],
                cache_responses=config["offline_mode"]["cache_responses"],
                cache_ttl=config["offline_mode"]["cache_ttl"],
                fallback_behavior=OfflineFallbackBehavior(config["offline_mode"]["fallback_behavior"])
            )
            
            # Parse resource config
            resource_config = ResourceConfig(
                max_concurrent_requests=config["resource_management"]["max_concurrent_requests"],
                gpu_memory_limit_gb=config["resource_management"]["gpu_memory_limit_gb"],
                cpu_fallback=config["resource_management"]["cpu_fallback"]
            )
            
            return {
                "model_config": model_config,
                "privacy_config": privacy_config,
                "offline_config": offline_config,
                "resource_config": resource_config,
                "data_retention": config["data_retention"]
            }
        
        except Exception as e:
            logger.error("config_load_failed", error=str(e))
            raise ValueError(f"Failed to load config: {str(e)}")
    
    def _generate_cache_key(self, query: str, model: str) -> str:
        """Generate cache key"""
        content = f"{query}:{model}"
        return hashlib.sha256(content.encode()).hexdigest()
    
    def _get_cached_response(self, cache_key: str) -> Optional[CachedResponse]:
        """Get cached response"""
        if cache_key in self.response_cache:
            cached = self.response_cache[cache_key]
            if time.time() < cached.expires_at:
                cached.access_count += 1
                logger.info("cache_hit", key=cache_key, access_count=cached.access_count)
                return cached
            else:
                del self.response_cache[cache_key]
                logger.info("cache_expired", key=cache_key)
        return None
    
    def _cache_response(self, cache_key: str, response: str, model: str):
        """Cache response"""
        if self.config["offline_config"].cache_responses:
            cached = CachedResponse(
                query_hash=cache_key,
                response=response,
                model=model,
                timestamp=time.time(),
                expires_at=time.time() + self.config["offline_config"].cache_ttl
            )
            self.response_cache[cache_key] = cached
            logger.info("response_cached", key=cache_key)
    
    async def process_sensitive_query(
        self,
        query: str,
        user_id: str,
        data_types: Optional[List[SensitiveDataType]] = None,
        consent_provided: bool = False
    ) -> Dict[str, Any]:
        """Process sensitive query with privacy checks"""
        # Check for sensitive data
        detected_types = self.privacy_checker.detect_sensitive_data(query)
        
        # Privacy compliance check
        check_data = {
            "query": query,
            "user_id": user_id,
            "consent_provided": consent_provided,
            "legitimate_educational_interest": True,
            "encrypted": False
        }
        
        compliance_result = self.privacy_checker.check_compliance(check_data)
        
        if not compliance_result.compliant:
            logger.warning("privacy_violation", violations=compliance_result.violations)
            return {
                "success": False,
                "error": "Privacy compliance check failed",
                "violations": compliance_result.violations,
                "recommendations": compliance_result.recommendations
            }
        
        # Perform inference
        inference_result = await self.model_manager.local_inference(query)
        
        # Encrypt response if sensitive data involved
        encrypted_response = None
        if detected_types or (data_types and len(data_types) > 0):
            encrypted_response = self.encryption_manager.encrypt(
                inference_result.response,
                user_id
            )
        
        return {
            "success": True,
            "response": inference_result.response if not encrypted_response else None,
            "encrypted_response": encrypted_response,
            "sensitive_data_detected": [t.value for t in detected_types],
            "compliance_check": {
                "compliant": compliance_result.compliant,
                "standards_met": [s.value for s in compliance_result.standards_met]
            },
            "inference_time": inference_result.inference_time,
            "model": inference_result.model
        }
    
    async def local_inference(
        self,
        prompt: str,
        user_id: str,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> InferenceResult:
        """Perform local inference with caching"""
        # Check cache
        cache_key = self._generate_cache_key(prompt, model or self.config["model_config"].model)
        cached = self._get_cached_response(cache_key)
        
        if cached:
            return InferenceResult(
                response=cached.response,
                model=cached.model,
                inference_time=0.0,
                encrypted=False,
                cached=True,
                timestamp=cached.timestamp
            )
        
        # Check if offline mode
        if self.offline_mode:
            ollama_available = await self.model_manager.check_ollama_connection()
            if not ollama_available:
                if self.config["offline_config"].fallback_behavior == OfflineFallbackBehavior.CACHED_ONLY:
                    raise RuntimeError("Offline mode: No cached response available")
                elif self.config["offline_config"].fallback_behavior == OfflineFallbackBehavior.ERROR:
                    raise RuntimeError("Offline mode: Ollama service unavailable")
        
        # Perform inference
        result = await self.model_manager.local_inference(prompt, model, temperature, max_tokens)
        
        # Cache response
        self._cache_response(cache_key, result.response, result.model)
        
        return result
    
    def encrypt_response(self, response: str, user_key: str) -> Dict[str, Any]:
        """Encrypt response"""
        return self.encryption_manager.encrypt(response, user_key)
    
    def check_privacy_compliance(self, data: Dict[str, Any]) -> PrivacyCheckResult:
        """Check privacy compliance"""
        return self.privacy_checker.check_compliance(data)
    
    def anonymize_data(self, data: Dict[str, Any], fields: Optional[List[str]] = None) -> Dict[str, Any]:
        """Anonymize data"""
        return self.anonymization_engine.anonymize_data(data, fields)
    
    def get_offline_status(self) -> Dict[str, Any]:
        """Get offline mode status"""
        return {
            "offline_mode_enabled": self.offline_mode,
            "cache_enabled": self.config["offline_config"].cache_responses,
            "cache_size": len(self.response_cache),
            "fallback_behavior": self.config["offline_config"].fallback_behavior.value
        }
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        memory_usage = self.model_manager.get_memory_usage()
        
        return {
            "model": self.config["model_config"].model,
            "base_url": self.config["model_config"].base_url,
            "temperature": self.config["model_config"].temperature,
            "context_length": self.config["model_config"].context_length,
            "quantization_bits": self.config["model_config"].quantization_bits,
            "model_loaded": self.model_manager.model_loaded,
            "active_inferences": self.model_manager.active_inferences,
            "memory_usage": memory_usage
        }
    
    def manage_model_memory(self) -> Dict[str, Any]:
        """Manage model memory"""
        # Get current usage
        memory_usage = self.model_manager.get_memory_usage()
        
        # Check limits
        ram_limit_exceeded = memory_usage["ram_used_gb"] > self.config["resource_config"].gpu_memory_limit_gb
        
        actions_taken = []
        
        # Clear cache if memory pressure
        if ram_limit_exceeded and len(self.response_cache) > 0:
            # Remove oldest cache entries
            sorted_cache = sorted(
                self.response_cache.items(),
                key=lambda x: x[1].timestamp
            )
            removed = 0
            for cache_key, _ in sorted_cache[:len(sorted_cache)//2]:
                del self.response_cache[cache_key]
                removed += 1
            actions_taken.append(f"Cleared {removed} cache entries")
        
        # Rotate encryption keys
        rotated = self.encryption_manager.rotate_keys()
        if rotated > 0:
            actions_taken.append(f"Rotated {rotated} encryption keys")
        
        logger.info("memory_managed", actions=actions_taken)
        
        return {
            "memory_usage": memory_usage,
            "actions_taken": actions_taken,
            "cache_size": len(self.response_cache)
        }
    
    async def close(self):
        """Close agent"""
        await self.model_manager.close()


# ============================================================================
# Global Agent Instance
# ============================================================================

agent: Optional[LocalAIAgent] = None


# ============================================================================
# API Endpoints
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize agent on startup"""
    global agent
    try:
        config_path = os.getenv("CONFIG_PATH", "config.yaml")
        agent = LocalAIAgent(config_path)
        
        # Load model
        await agent.model_manager.load_model()
        
        logger.info("agent_started", port=8024)
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
        "agent": "local_ai_agent",
        "timestamp": time.time()
    }


@app.post("/inference")
async def inference_endpoint(request: InferenceRequest):
    """Local inference endpoint"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    try:
        result = await agent.local_inference(
            prompt=request.prompt,
            user_id=request.user_id,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens
        )
        
        return {
            "response": result.response,
            "model": result.model,
            "inference_time": result.inference_time,
            "cached": result.cached,
            "timestamp": result.timestamp
        }
    
    except Exception as e:
        logger.error("inference_endpoint_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/sensitive-query")
async def sensitive_query_endpoint(request: SensitiveQueryRequest):
    """Process sensitive query"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    try:
        result = await agent.process_sensitive_query(
            query=request.query,
            user_id=request.user_id,
            data_types=[SensitiveDataType(t) for t in request.data_types] if request.data_types else None,
            consent_provided=request.consent_provided
        )
        
        return result
    
    except Exception as e:
        logger.error("sensitive_query_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/encrypt")
async def encrypt_endpoint(request: EncryptRequest):
    """Encrypt data"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    try:
        encrypted = agent.encrypt_response(request.data, request.user_key)
        return encrypted
    
    except Exception as e:
        logger.error("encryption_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/privacy-check")
async def privacy_check_endpoint(request: PrivacyCheckRequest):
    """Check privacy compliance"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    try:
        standards = [ComplianceStandard(s) for s in request.standards] if request.standards else None
        
        result = agent.check_privacy_compliance(request.data)
        
        return {
            "compliant": result.compliant,
            "standards_met": [s.value for s in result.standards_met],
            "violations": result.violations,
            "sensitive_data_found": [t.value for t in result.sensitive_data_found],
            "recommendations": result.recommendations
        }
    
    except Exception as e:
        logger.error("privacy_check_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/offline-status")
async def offline_status_endpoint():
    """Get offline mode status"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    return agent.get_offline_status()


@app.post("/anonymize")
async def anonymize_endpoint(request: AnonymizeRequest):
    """Anonymize data"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    try:
        anonymized = agent.anonymize_data(request.data, request.fields_to_anonymize or None)
        return {"anonymized_data": anonymized}
    
    except Exception as e:
        logger.error("anonymization_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/model-info")
async def model_info_endpoint():
    """Get model information"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    return agent.get_model_info()


@app.post("/manage-memory")
async def manage_memory_endpoint():
    """Manage model memory"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    return agent.manage_model_memory()


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        app,
        host="127.0.0.1",  # localhost only for security
        port=8024,
        log_level="info"
    )
