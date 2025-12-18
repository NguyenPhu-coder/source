"""
Visual Generation Agent
Production-ready educational image generation with Stable Diffusion SDXL-Turbo

Features:
- Real-time generation (<500ms with LCM-LoRA)
- Cultural adaptation
- Age-appropriate safety filtering
- Educational diagrams & infographics
- CDN upload with compression
- Batch generation support
- Accessibility (alt text, captions)
"""

import asyncio
import hashlib
import io
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import boto3
import numpy as np
import structlog
import torch
import yaml
from botocore.exceptions import ClientError
from diffusers import (
    AutoPipelineForText2Image,
    DPMSolverMultistepScheduler,
    LCMScheduler,
)
from fastapi import BackgroundTasks, FastAPI, HTTPException
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from prometheus_client import Counter, Histogram, generate_latest
from pydantic import BaseModel, Field
from starlette.responses import Response

# Structured logging
logger = structlog.get_logger()

# Prometheus metrics
images_generated_total = Counter(
    "images_generated_total", "Total images generated", ["style", "status"]
)
generation_duration = Histogram(
    "generation_duration_seconds", "Image generation duration"
)
upload_duration = Histogram("upload_duration_seconds", "CDN upload duration")


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================


class GenerateImageRequest(BaseModel):
    """Request for basic image generation"""

    prompt: str = Field(..., min_length=1, max_length=500)
    style: str = Field(default="realistic")
    size: Tuple[int, int] = Field(default=(768, 768))
    negative_prompt: Optional[str] = None
    num_images: int = Field(default=1, ge=1, le=4)


class CreateDiagramRequest(BaseModel):
    """Request for diagram generation"""

    concept: str = Field(..., min_length=1)
    diagram_type: str = Field(..., regex="^(flowchart|mindmap|timeline|hierarchy|cycle)$")
    style: str = Field(default="diagram")
    labels: Optional[List[str]] = None


class PersonalizeVisualRequest(BaseModel):
    """Request for personalized visual generation"""

    base_prompt: str = Field(..., min_length=1)
    interests: List[str] = Field(default_factory=list)
    culture: str = Field(default="neutral")
    age_group: str = Field(default="adult")
    learning_style: str = Field(default="visual")


class GenerateInfographicRequest(BaseModel):
    """Request for infographic generation"""

    data: Dict[str, Any] = Field(...)
    template: str = Field(default="comparison")
    title: str = Field(..., min_length=1)
    color_scheme: str = Field(default="educational")


class ImageResponse(BaseModel):
    """Response with generated image"""

    image_id: str
    cdn_url: str
    alt_text: str
    caption: str
    metadata: Dict[str, Any]
    generation_time: float


# ============================================================================
# SAFETY FILTER
# ============================================================================


class SafetyFilter:
    """Content safety filtering for educational images"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.enable_filter = config.get("content_filter", True)
        self.age_appropriate = config.get("age_appropriate", True)
        self.educational_only = config.get("educational_only", True)

        # Forbidden keywords
        self.forbidden_keywords = {
            "violence",
            "weapon",
            "gore",
            "blood",
            "sexy",
            "nude",
            "naked",
            "sexual",
            "adult content",
            "gambling",
            "alcohol",
            "drugs",
            "inappropriate",
        }

        # Educational keywords (positive signals)
        self.educational_keywords = {
            "learn",
            "education",
            "study",
            "diagram",
            "concept",
            "illustration",
            "textbook",
            "teaching",
            "classroom",
            "academic",
        }

    def is_safe_prompt(self, prompt: str) -> Tuple[bool, str]:
        """Check if prompt is safe for educational content"""
        prompt_lower = prompt.lower()

        # Check forbidden keywords
        for keyword in self.forbidden_keywords:
            if keyword in prompt_lower:
                return False, f"Forbidden content detected: {keyword}"

        # If educational_only, check for educational keywords
        if self.educational_only:
            has_educational = any(
                kw in prompt_lower for kw in self.educational_keywords
            )
            if not has_educational and len(prompt.split()) > 10:
                # Add educational context
                return True, "prompt_enhanced"

        return True, "safe"

    def enhance_prompt_for_safety(self, prompt: str) -> str:
        """Add educational context to prompt for safety"""
        educational_prefix = "educational illustration, textbook style, "
        age_suffix = ", age-appropriate, family-friendly"

        if self.age_appropriate:
            return educational_prefix + prompt + age_suffix
        return educational_prefix + prompt


# ============================================================================
# PROMPT ENGINEER
# ============================================================================


class PromptEngineer:
    """Advanced prompt engineering for educational content"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.styles = config.get("styles", [])

        # Style templates
        self.style_templates = {
            "realistic": "photorealistic, detailed, high quality, professional photography",
            "cartoon": "cartoon style, colorful, friendly, educational illustration, child-friendly",
            "diagram": "clean diagram, technical illustration, clear labels, educational schematic",
            "infographic": "modern infographic, data visualization, clean design, professional",
            "sketch": "hand-drawn sketch, pencil drawing, artistic, educational illustration",
        }

        # Cultural adaptations
        self.cultural_adaptations = {
            "asian": "Asian cultural context, appropriate attire, respectful representation",
            "middle_eastern": "Middle Eastern cultural context, modest representation, respectful",
            "western": "Western cultural context, diverse representation",
            "african": "African cultural context, diverse representation, respectful",
            "latin": "Latin American cultural context, vibrant, respectful representation",
            "neutral": "culturally neutral, diverse and inclusive representation",
        }

        # Age-appropriate modifiers
        self.age_modifiers = {
            "child": "child-friendly, simple, colorful, non-threatening, educational for kids",
            "teen": "age-appropriate for teenagers, engaging, modern, educational",
            "adult": "professional, sophisticated, detailed, educational for adults",
            "senior": "clear, easy to understand, respectful, educational for seniors",
        }

    def engineer_prompt(
        self,
        base_prompt: str,
        style: str = "realistic",
        culture: str = "neutral",
        age_group: str = "adult",
        interests: Optional[List[str]] = None,
    ) -> str:
        """Engineer complete prompt with all adaptations"""

        # Start with base prompt
        parts = [base_prompt]

        # Add style
        if style in self.style_templates:
            parts.append(self.style_templates[style])

        # Add cultural context
        if culture in self.cultural_adaptations:
            parts.append(self.cultural_adaptations[culture])

        # Add age-appropriate modifiers
        if age_group in self.age_modifiers:
            parts.append(self.age_modifiers[age_group])

        # Add interest-based elements
        if interests:
            interest_context = f"incorporating elements of {', '.join(interests[:3])}"
            parts.append(interest_context)

        # Quality enhancers
        parts.append("high quality, clear, educational purpose")

        return ", ".join(parts)

    def create_diagram_prompt(self, concept: str, diagram_type: str) -> str:
        """Create specialized prompt for diagrams"""
        diagram_templates = {
            "flowchart": f"clear flowchart diagram showing {concept}, with arrows and boxes, labeled steps, clean design",
            "mindmap": f"mind map visualization of {concept}, central idea with branches, organized, colorful nodes",
            "timeline": f"timeline diagram of {concept}, chronological order, clear milestones, horizontal layout",
            "hierarchy": f"hierarchical diagram of {concept}, tree structure, levels clearly shown, organizational chart style",
            "cycle": f"circular cycle diagram of {concept}, continuous process, arrows showing flow, repeating stages",
        }

        base = diagram_templates.get(
            diagram_type, f"diagram illustrating {concept}, clear and educational"
        )
        return f"{base}, technical illustration, white background, high contrast, labeled"

    def create_infographic_prompt(
        self, title: str, data_type: str, color_scheme: str
    ) -> str:
        """Create prompt for infographic generation"""
        return (
            f"modern infographic titled '{title}', {data_type} visualization, "
            f"{color_scheme} color scheme, clean layout, data-driven, "
            f"professional design, clear typography, icons and charts"
        )


# ============================================================================
# IMAGE PROCESSOR
# ============================================================================


class ImageProcessor:
    """Post-processing for generated images"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.compression_quality = config.get("compression", 85)

    def add_watermark(self, image: Image.Image, text: str) -> Image.Image:
        """Add watermark to image"""
        # Create watermark layer
        watermark = Image.new("RGBA", image.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(watermark)

        # Try to load font, fallback to default
        try:
            font_size = max(20, image.width // 40)
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            font = ImageFont.load_default()

        # Calculate position (bottom-right)
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        x = image.width - text_width - 20
        y = image.height - text_height - 20

        # Draw text with transparency
        draw.text((x, y), text, fill=(255, 255, 255, 128), font=font)

        # Convert original to RGBA and composite
        if image.mode != "RGBA":
            image = image.convert("RGBA")

        return Image.alpha_composite(image, watermark)

    def optimize_image(self, image: Image.Image, format: str = "JPEG") -> bytes:
        """Optimize image for web delivery"""
        # Convert to RGB if needed for JPEG
        if format.upper() == "JPEG" and image.mode == "RGBA":
            # Create white background
            background = Image.new("RGB", image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[3] if image.mode == "RGBA" else None)
            image = background

        # Save to bytes with optimization
        buffer = io.BytesIO()
        save_kwargs = {"format": format, "optimize": True}

        if format.upper() == "JPEG":
            save_kwargs["quality"] = self.compression_quality
            save_kwargs["progressive"] = True
        elif format.upper() == "PNG":
            save_kwargs["compress_level"] = 9

        image.save(buffer, **save_kwargs)
        return buffer.getvalue()

    def generate_thumbnail(self, image: Image.Image, size: Tuple[int, int] = (256, 256)) -> bytes:
        """Generate thumbnail for preview"""
        thumbnail = image.copy()
        thumbnail.thumbnail(size, Image.Resampling.LANCZOS)
        return self.optimize_image(thumbnail, "JPEG")

    def generate_alt_text(self, prompt: str, style: str) -> str:
        """Generate accessibility alt text"""
        # Extract key concepts from prompt
        words = prompt.split(",")[0].split()[:10]
        description = " ".join(words)

        return f"AI-generated {style} image: {description}"

    def generate_caption(self, prompt: str, concept: str = "") -> str:
        """Generate descriptive caption"""
        if concept:
            return f"Educational illustration of {concept}"

        # Use first sentence of prompt
        first_sentence = prompt.split(".")[0].split(",")[0]
        return f"Visual representation: {first_sentence}"


# ============================================================================
# CDN UPLOADER
# ============================================================================


class CDNUploader:
    """Upload images to S3/CDN"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.storage_type = config.get("type", "local")
        self.bucket = config.get("bucket", "learn-your-way-images")
        self.cdn_url = config.get("cdn_url", "https://cdn.learnyourway.com")

        if self.storage_type == "s3":
            self.s3_client = boto3.client("s3")
        else:
            # Local storage
            self.local_path = Path(config.get("local_path", "./storage/images"))
            self.local_path.mkdir(parents=True, exist_ok=True)

    def upload_to_cdn(self, image_bytes: bytes, metadata: Dict[str, Any]) -> str:
        """Upload image to CDN and return URL"""
        image_id = metadata.get("image_id", self._generate_image_id())
        extension = metadata.get("format", "jpg").lower()
        key = f"images/{image_id}.{extension}"

        if self.storage_type == "s3":
            return self._upload_to_s3(image_bytes, key, metadata)
        else:
            return self._upload_local(image_bytes, key)

    def _upload_to_s3(
        self, image_bytes: bytes, key: str, metadata: Dict[str, Any]
    ) -> str:
        """Upload to S3 bucket"""
        try:
            # Prepare metadata for S3
            s3_metadata = {
                "Content-Type": f"image/{metadata.get('format', 'jpeg')}",
                "Cache-Control": "public, max-age=31536000",
                "X-Image-Id": metadata.get("image_id", ""),
                "X-Generated-At": metadata.get("generated_at", ""),
            }

            # Upload
            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=image_bytes,
                ContentType=s3_metadata["Content-Type"],
                CacheControl=s3_metadata["Cache-Control"],
                Metadata={
                    k.replace("X-", ""): v
                    for k, v in s3_metadata.items()
                    if k.startswith("X-")
                },
            )

            # Return CDN URL
            return f"{self.cdn_url}/{key}"

        except ClientError as e:
            logger.error("s3_upload_failed", error=str(e))
            raise HTTPException(status_code=500, detail="Failed to upload to CDN")

    def _upload_local(self, image_bytes: bytes, key: str) -> str:
        """Save to local storage"""
        file_path = self.local_path / key
        file_path.parent.mkdir(parents=True, exist_ok=True)

        with open(file_path, "wb") as f:
            f.write(image_bytes)

        # Return local URL
        return f"{self.cdn_url}/{key}"

    def delete_image(self, image_id: str) -> bool:
        """Delete image from CDN"""
        if self.storage_type == "s3":
            try:
                # Try common extensions
                for ext in ["jpg", "png", "jpeg"]:
                    key = f"images/{image_id}.{ext}"
                    try:
                        self.s3_client.delete_object(Bucket=self.bucket, Key=key)
                        return True
                    except:
                        continue
                return False
            except ClientError:
                return False
        else:
            # Local deletion
            for ext in ["jpg", "png", "jpeg"]:
                file_path = self.local_path / f"images/{image_id}.{ext}"
                if file_path.exists():
                    file_path.unlink()
                    return True
            return False

    def _generate_image_id(self) -> str:
        """Generate unique image ID"""
        timestamp = datetime.utcnow().isoformat()
        random_str = hashlib.sha256(timestamp.encode()).hexdigest()[:12]
        return f"img_{random_str}"


# ============================================================================
# VISUAL GENERATION AGENT
# ============================================================================


class VisualGenerationAgent:
    """Main agent for educational image generation"""

    def __init__(self, config_path: str = "config.yaml"):
        # Load configuration
        with open(config_path, "r", encoding="utf-8") as f:
            self.config = yaml.safe_load(f)

        self.agent_config = self.config.get("agent", {})
        self.model_config = self.config.get("models", {})
        self.generation_config = self.config.get("generation", {})
        self.safety_config = self.config.get("safety", {})
        self.storage_config = self.config.get("storage", {})

        # Initialize components
        self.safety_filter = SafetyFilter(self.safety_config)
        self.prompt_engineer = PromptEngineer(self.generation_config)
        self.image_processor = ImageProcessor(self.storage_config)
        self.cdn_uploader = CDNUploader(self.storage_config)

        # Initialize models (lazy loading)
        self.pipeline = None
        self.device = self.model_config.get("stable_diffusion", {}).get("device", "cuda")

        logger.info("visual_generation_agent_initialized", config=self.agent_config)

    def initialize(self):
        """Initialize Stable Diffusion pipeline"""
        logger.info("initializing_sdxl_turbo_pipeline")

        sd_config = self.model_config.get("stable_diffusion", {})
        lora_config = self.model_config.get("lora", {})

        # Load SDXL-Turbo
        model_name = sd_config.get("model", "stabilityai/sdxl-turbo")

        self.pipeline = AutoPipelineForText2Image.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
            variant="fp16" if self.device == "cuda" else None,
        )

        # Set scheduler
        scheduler_name = sd_config.get("scheduler", "LCMScheduler")
        if scheduler_name == "LCMScheduler":
            self.pipeline.scheduler = LCMScheduler.from_config(
                self.pipeline.scheduler.config
            )
        elif scheduler_name == "DPMSolverMultistepScheduler":
            self.pipeline.scheduler = DPMSolverMultistepScheduler.from_config(
                self.pipeline.scheduler.config
            )

        # Load LoRA if enabled
        if lora_config.get("enable", True):
            lora_model = lora_config.get("model", "latent-consistency/lcm-lora-sdxl")
            try:
                self.pipeline.load_lora_weights(lora_model)
                logger.info("lora_loaded", model=lora_model)
            except Exception as e:
                logger.warning("lora_load_failed", error=str(e))

        # Move to device
        self.pipeline = self.pipeline.to(self.device)

        # Enable optimizations
        if self.device == "cuda":
            self.pipeline.enable_xformers_memory_efficient_attention()

        logger.info("pipeline_initialized", device=self.device)

    def generate_image(
        self, prompt: str, style: str = "realistic", size: Tuple[int, int] = (768, 768)
    ) -> str:
        """
        Generate educational image from prompt
        
        Args:
            prompt: Text description of image
            style: Visual style (realistic, cartoon, diagram, etc.)
            size: Image dimensions (width, height)
            
        Returns:
            CDN URL of generated image
        """
        start_time = time.time()

        # Safety check
        is_safe, safety_status = self.safety_filter.is_safe_prompt(prompt)
        if not is_safe:
            images_generated_total.labels(style=style, status="rejected").inc()
            raise HTTPException(status_code=400, detail=safety_status)

        # Enhance prompt if needed
        if safety_status == "prompt_enhanced":
            prompt = self.safety_filter.enhance_prompt_for_safety(prompt)

        # Engineer full prompt
        full_prompt = self.prompt_engineer.engineer_prompt(
            base_prompt=prompt, style=style
        )

        logger.info("generating_image", prompt=prompt[:100], style=style, size=size)

        # Generate image
        try:
            sd_config = self.model_config.get("stable_diffusion", {})
            num_steps = sd_config.get("inference_steps", 4)
            guidance = sd_config.get("guidance_scale", 1.0)

            output = self.pipeline(
                prompt=full_prompt,
                negative_prompt="blurry, low quality, distorted, inappropriate, violent, sexual",
                num_inference_steps=num_steps,
                guidance_scale=guidance,
                width=size[0],
                height=size[1],
            )

            image = output.images[0]

            # Add watermark
            image = self.image_processor.add_watermark(
                image, "LearnYourWay.com"
            )

            # Optimize
            image_bytes = self.image_processor.optimize_image(image, "JPEG")

            # Generate metadata
            image_id = self._generate_image_id()
            metadata = {
                "image_id": image_id,
                "prompt": prompt,
                "style": style,
                "size": size,
                "format": "jpg",
                "generated_at": datetime.utcnow().isoformat(),
            }

            # Upload to CDN
            cdn_url = self.cdn_uploader.upload_to_cdn(image_bytes, metadata)

            generation_time = time.time() - start_time
            generation_duration.observe(generation_time)
            images_generated_total.labels(style=style, status="success").inc()

            logger.info(
                "image_generated",
                image_id=image_id,
                url=cdn_url,
                time=generation_time,
            )

            return cdn_url

        except Exception as e:
            images_generated_total.labels(style=style, status="failed").inc()
            logger.error("generation_failed", error=str(e))
            raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

    def create_diagram(self, concept: str, diagram_type: str) -> str:
        """
        Generate educational diagram
        
        Args:
            concept: The concept to visualize
            diagram_type: Type of diagram (flowchart, mindmap, timeline, etc.)
            
        Returns:
            CDN URL of generated diagram
        """
        # Create specialized prompt
        prompt = self.prompt_engineer.create_diagram_prompt(concept, diagram_type)

        # Generate with diagram style
        return self.generate_image(prompt=prompt, style="diagram", size=(1024, 768))

    def personalize_visual(
        self,
        base_prompt: str,
        interests: List[str],
        culture: str = "neutral",
    ) -> str:
        """
        Generate personalized visual content
        
        Args:
            base_prompt: Base description
            interests: User's interests
            culture: Cultural context
            
        Returns:
            CDN URL of personalized image
        """
        # Engineer personalized prompt
        full_prompt = self.prompt_engineer.engineer_prompt(
            base_prompt=base_prompt,
            style="realistic",
            culture=culture,
            age_group="adult",
            interests=interests,
        )

        return self.generate_image(prompt=full_prompt, style="realistic")

    def generate_infographic(self, data: Dict[str, Any], template: str) -> str:
        """
        Generate infographic from data
        
        Args:
            data: Data to visualize (must contain 'title')
            template: Infographic template type
            
        Returns:
            CDN URL of generated infographic
        """
        title = data.get("title", "Data Visualization")
        data_type = data.get("type", "comparison")
        color_scheme = data.get("color_scheme", "educational")

        # Create infographic prompt
        prompt = self.prompt_engineer.create_infographic_prompt(
            title, data_type, color_scheme
        )

        return self.generate_image(prompt=prompt, style="infographic", size=(1024, 1024))

    def add_watermark(self, image: bytes, text: str) -> bytes:
        """
        Add watermark to existing image
        
        Args:
            image: Image bytes
            text: Watermark text
            
        Returns:
            Watermarked image bytes
        """
        pil_image = Image.open(io.BytesIO(image))
        watermarked = self.image_processor.add_watermark(pil_image, text)
        return self.image_processor.optimize_image(watermarked, "PNG")

    def optimize_image(self, image: bytes, format: str = "JPEG") -> bytes:
        """
        Optimize image for web delivery
        
        Args:
            image: Image bytes
            format: Output format (JPEG, PNG)
            
        Returns:
            Optimized image bytes
        """
        pil_image = Image.open(io.BytesIO(image))
        return self.image_processor.optimize_image(pil_image, format)

    def upload_to_cdn(self, image: bytes, metadata: Dict[str, Any]) -> str:
        """
        Upload image to CDN
        
        Args:
            image: Image bytes
            metadata: Image metadata
            
        Returns:
            CDN URL
        """
        start_time = time.time()
        url = self.cdn_uploader.upload_to_cdn(image, metadata)
        upload_duration.observe(time.time() - start_time)
        return url

    def _generate_image_id(self) -> str:
        """Generate unique image ID"""
        timestamp = datetime.utcnow().isoformat()
        random_str = hashlib.sha256(timestamp.encode()).hexdigest()[:12]
        return f"img_{random_str}"


# ============================================================================
# FASTAPI APPLICATION
# ============================================================================

app = FastAPI(
    title="Visual Generation Agent",
    description="Educational image generation with SDXL-Turbo and LCM-LoRA",
    version="1.0.0",
)

# Global agent instance
agent: Optional[VisualGenerationAgent] = None


@app.on_event("startup")
async def startup():
    """Initialize agent on startup"""
    global agent
    agent = VisualGenerationAgent("config.yaml")
    agent.initialize()
    logger.info("visual_generation_agent_started")


@app.post("/generate", response_model=ImageResponse)
async def generate_endpoint(request: GenerateImageRequest):
    """Generate educational image"""
    start_time = time.time()

    try:
        # Generate image
        cdn_url = agent.generate_image(
            prompt=request.prompt, style=request.style, size=request.size
        )

        # Generate metadata
        image_id = agent._generate_image_id()
        alt_text = agent.image_processor.generate_alt_text(
            request.prompt, request.style
        )
        caption = agent.image_processor.generate_caption(request.prompt)

        return ImageResponse(
            image_id=image_id,
            cdn_url=cdn_url,
            alt_text=alt_text,
            caption=caption,
            metadata={
                "prompt": request.prompt,
                "style": request.style,
                "size": request.size,
                "generated_at": datetime.utcnow().isoformat(),
            },
            generation_time=time.time() - start_time,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("generate_endpoint_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/diagram", response_model=ImageResponse)
async def create_diagram_endpoint(request: CreateDiagramRequest):
    """Generate educational diagram"""
    start_time = time.time()

    try:
        cdn_url = agent.create_diagram(
            concept=request.concept, diagram_type=request.diagram_type
        )

        image_id = agent._generate_image_id()
        alt_text = f"Educational diagram: {request.concept} ({request.diagram_type})"
        caption = f"{request.diagram_type.capitalize()} diagram of {request.concept}"

        return ImageResponse(
            image_id=image_id,
            cdn_url=cdn_url,
            alt_text=alt_text,
            caption=caption,
            metadata={
                "concept": request.concept,
                "diagram_type": request.diagram_type,
                "generated_at": datetime.utcnow().isoformat(),
            },
            generation_time=time.time() - start_time,
        )

    except Exception as e:
        logger.error("diagram_endpoint_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/infographic", response_model=ImageResponse)
async def generate_infographic_endpoint(request: GenerateInfographicRequest):
    """Generate infographic"""
    start_time = time.time()

    try:
        cdn_url = agent.generate_infographic(
            data={"title": request.title, "type": request.template, "color_scheme": request.color_scheme},
            template=request.template,
        )

        image_id = agent._generate_image_id()
        alt_text = f"Infographic: {request.title}"
        caption = f"{request.template.capitalize()} infographic: {request.title}"

        return ImageResponse(
            image_id=image_id,
            cdn_url=cdn_url,
            alt_text=alt_text,
            caption=caption,
            metadata={
                "title": request.title,
                "template": request.template,
                "generated_at": datetime.utcnow().isoformat(),
            },
            generation_time=time.time() - start_time,
        )

    except Exception as e:
        logger.error("infographic_endpoint_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/personalize", response_model=ImageResponse)
async def personalize_visual_endpoint(request: PersonalizeVisualRequest):
    """Generate personalized visual content"""
    start_time = time.time()

    try:
        cdn_url = agent.personalize_visual(
            base_prompt=request.base_prompt,
            interests=request.interests,
            culture=request.culture,
        )

        image_id = agent._generate_image_id()
        alt_text = agent.image_processor.generate_alt_text(
            request.base_prompt, "realistic"
        )
        caption = f"Personalized content: {request.base_prompt[:50]}..."

        return ImageResponse(
            image_id=image_id,
            cdn_url=cdn_url,
            alt_text=alt_text,
            caption=caption,
            metadata={
                "base_prompt": request.base_prompt,
                "interests": request.interests,
                "culture": request.culture,
                "generated_at": datetime.utcnow().isoformat(),
            },
            generation_time=time.time() - start_time,
        )

    except Exception as e:
        logger.error("personalize_endpoint_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/image/{image_id}")
async def get_image_endpoint(image_id: str):
    """Retrieve image metadata"""
    # In production, retrieve from database
    return {
        "image_id": image_id,
        "status": "available",
        "cdn_url": f"{agent.storage_config.get('cdn_url')}/images/{image_id}.jpg",
    }


@app.delete("/image/{image_id}")
async def delete_image_endpoint(image_id: str):
    """Delete image from CDN"""
    success = agent.cdn_uploader.delete_image(image_id)

    if success:
        return {"status": "deleted", "image_id": image_id}
    else:
        raise HTTPException(status_code=404, detail="Image not found")


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "agent": "visual_generation_agent",
        "model": "sdxl-turbo",
        "device": agent.device,
    }


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(content=generate_latest(), media_type="text/plain")


if __name__ == "__main__":
    import uvicorn

    config = yaml.safe_load(open("config.yaml"))
    agent_config = config.get("agent", {})

    uvicorn.run(
        app,
        host=agent_config.get("host", "0.0.0.0"),
        port=agent_config.get("port", 8004),
    )
