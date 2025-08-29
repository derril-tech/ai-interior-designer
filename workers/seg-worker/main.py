#!/usr/bin/env python3
"""
Segmentation Worker - Detects doors, windows, outlets, and materials in room scans
"""

import asyncio
import json
import logging
import os
from typing import Dict, Any, Optional, List

import nats
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import cv2
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Segmentation Worker",
    description="Detects doors, windows, outlets, and materials in room scans",
    version="1.0.0"
)

# Global connections
nats_client: Optional[nats.NATS] = None
redis_client: Optional[redis.Redis] = None

class SegmentationJob(BaseModel):
    id: str
    room_id: str
    mesh_data: Dict[str, Any]
    frames: List[str]  # Frame URLs or base64 data
    floor_plan: Dict[str, Any]

class SegmentationResult(BaseModel):
    job_id: str
    status: str
    detections: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    progress: float = 0.0

async def connect_services():
    """Connect to NATS and Redis"""
    global nats_client, redis_client
    
    nats_url = os.getenv("NATS_URL", "nats://localhost:4222")
    nats_client = await nats.connect(nats_url)
    logger.info(f"Connected to NATS at {nats_url}")
    
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    redis_client = redis.from_url(redis_url)
    logger.info(f"Connected to Redis at {redis_url}")

async def process_segmentation_job(job_data: Dict[str, Any]) -> SegmentationResult:
    """Process segmentation job to detect architectural elements"""
    job_id = job_data.get("id")
    room_id = job_data.get("room_id")
    frames = job_data.get("frames", [])
    floor_plan = job_data.get("floor_plan", {})
    
    try:
        await update_job_progress(job_id, 0.1, "Starting segmentation analysis")
        
        # Step 1: Load and preprocess frames
        if not frames:
            raise ValueError("No frames provided for segmentation")
        
        await update_job_progress(job_id, 0.2, "Loading and preprocessing frames")
        processed_frames = await preprocess_frames(frames)
        
        # Step 2: Detect doors
        await update_job_progress(job_id, 0.4, "Detecting doors")
        door_detections = await detect_doors(processed_frames, floor_plan)
        
        # Step 3: Detect windows
        await update_job_progress(job_id, 0.6, "Detecting windows")
        window_detections = await detect_windows(processed_frames, floor_plan)
        
        # Step 4: Detect outlets and switches
        await update_job_progress(job_id, 0.75, "Detecting electrical outlets")
        outlet_detections = await detect_outlets(processed_frames)
        
        # Step 5: Analyze materials and finishes
        await update_job_progress(job_id, 0.9, "Analyzing materials and finishes")
        material_analysis = await analyze_materials(processed_frames)
        
        await update_job_progress(job_id, 1.0, "Segmentation analysis complete")
        
        # Combine all detections
        detections = {
            "doors": door_detections,
            "windows": window_detections,
            "outlets": outlet_detections,
            "materials": material_analysis,
            "room_metrics": {
                "ceiling_height_cm": estimate_ceiling_height(floor_plan),
                "floor_area_sqm": floor_plan.get("area_sqm", 0),
                "wall_count": len(floor_plan.get("walls", [])),
                "natural_light_score": calculate_natural_light_score(window_detections)
            }
        }
        
        return SegmentationResult(
            job_id=job_id,
            status="completed",
            detections=detections,
            progress=1.0
        )
        
    except Exception as e:
        logger.error(f"Error processing segmentation job {job_id}: {e}")
        return SegmentationResult(
            job_id=job_id,
            status="failed",
            error=str(e),
            progress=0.0
        )

async def preprocess_frames(frames: List[str]) -> List[np.ndarray]:
    """Load and preprocess frames for analysis"""
    await asyncio.sleep(0.2)  # Simulate processing time
    
    processed_frames = []
    
    # In real implementation, decode base64 or load from URLs
    # For now, create mock frame data
    for i in range(min(len(frames), 20)):  # Process up to 20 frames
        # Mock frame as numpy array (480x640x3)
        frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        processed_frames.append(frame)
    
    return processed_frames

async def detect_doors(frames: List[np.ndarray], floor_plan: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Detect doors in frames using computer vision"""
    await asyncio.sleep(0.5)  # Simulate processing
    
    # Mock door detection - in real implementation, use YOLO or similar
    doors = []
    existing_doors = floor_plan.get("doors", [])
    
    # Enhance existing door data with visual analysis
    for i, door in enumerate(existing_doors):
        enhanced_door = door.copy()
        enhanced_door.update({
            "confidence": 0.85 + (i % 10) * 0.01,
            "visual_features": {
                "door_type": "hinged",  # hinged, sliding, double
                "material": "wood",     # wood, metal, glass
                "color": {"r": 139, "g": 69, "b": 19},  # Brown
                "handle_side": "right",
                "frame_visible": True
            },
            "detection_method": "visual_analysis"
        })
        doors.append(enhanced_door)
    
    # Add any additional doors detected visually
    if len(frames) > 10:  # If we have enough frames
        doors.append({
            "id": f"door_detected_{len(doors) + 1}",
            "wall_id": "wall_3",
            "position": {"x": 1.5, "y": 4.0},
            "width": 0.8,
            "height": 2.0,
            "swing_direction": "outward",
            "confidence": 0.72,
            "visual_features": {
                "door_type": "hinged",
                "material": "wood",
                "color": {"r": 160, "g": 82, "b": 45},
                "handle_side": "left",
                "frame_visible": True
            },
            "detection_method": "computer_vision"
        })
    
    return doors

async def detect_windows(frames: List[np.ndarray], floor_plan: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Detect windows in frames"""
    await asyncio.sleep(0.4)  # Simulate processing
    
    windows = []
    existing_windows = floor_plan.get("windows", [])
    
    # Enhance existing window data
    for i, window in enumerate(existing_windows):
        enhanced_window = window.copy()
        enhanced_window.update({
            "confidence": 0.88 + (i % 5) * 0.02,
            "visual_features": {
                "window_type": "casement",  # casement, double_hung, sliding, fixed
                "frame_material": "vinyl",   # vinyl, wood, aluminum
                "glass_type": "clear",       # clear, frosted, tinted
                "has_blinds": True,
                "natural_light_intensity": 0.75,
                "view_quality": "good"       # poor, fair, good, excellent
            },
            "detection_method": "visual_analysis"
        })
        windows.append(enhanced_window)
    
    # Detect additional windows
    if len(frames) > 15:
        windows.append({
            "id": f"window_detected_{len(windows) + 1}",
            "wall_id": "wall_3",
            "position": {"x": 2.5, "y": 4.0},
            "width": 1.0,
            "height": 1.2,
            "sill_height": 0.9,
            "confidence": 0.79,
            "visual_features": {
                "window_type": "sliding",
                "frame_material": "aluminum",
                "glass_type": "clear",
                "has_blinds": False,
                "natural_light_intensity": 0.65,
                "view_quality": "fair"
            },
            "detection_method": "computer_vision"
        })
    
    return windows

async def detect_outlets(frames: List[np.ndarray]) -> List[Dict[str, Any]]:
    """Detect electrical outlets and switches"""
    await asyncio.sleep(0.3)  # Simulate processing
    
    # Mock outlet detection
    outlets = [
        {
            "id": "outlet_1",
            "type": "electrical_outlet",
            "wall_id": "wall_1",
            "position": {"x": 1.0, "y": 0},
            "height_cm": 30,
            "confidence": 0.82,
            "features": {
                "outlet_type": "duplex",     # duplex, gfci, usb
                "cover_color": "white",
                "in_use": False
            }
        },
        {
            "id": "switch_1",
            "type": "light_switch",
            "wall_id": "wall_1",
            "position": {"x": 0.2, "y": 0},
            "height_cm": 120,
            "confidence": 0.76,
            "features": {
                "switch_type": "toggle",     # toggle, rocker, dimmer
                "cover_color": "white",
                "gang_count": 1
            }
        },
        {
            "id": "outlet_2",
            "type": "electrical_outlet",
            "wall_id": "wall_2",
            "position": {"x": 5.0, "y": 1.5},
            "height_cm": 30,
            "confidence": 0.79,
            "features": {
                "outlet_type": "gfci",
                "cover_color": "white",
                "in_use": True
            }
        }
    ]
    
    return outlets

async def analyze_materials(frames: List[np.ndarray]) -> Dict[str, Any]:
    """Analyze materials and finishes in the room"""
    await asyncio.sleep(0.4)  # Simulate processing
    
    # Mock material analysis
    materials = {
        "flooring": {
            "primary_material": "hardwood",  # hardwood, carpet, tile, laminate, vinyl
            "color": {"r": 139, "g": 90, "b": 43},  # Saddle brown
            "finish": "satin",               # matte, satin, gloss
            "condition": "good",             # poor, fair, good, excellent
            "confidence": 0.87
        },
        "walls": {
            "primary_material": "drywall",   # drywall, brick, wood, concrete
            "finish": "paint",               # paint, wallpaper, wood, tile
            "color": {"r": 245, "g": 245, "b": 220},  # Beige
            "texture": "smooth",             # smooth, textured, rough
            "condition": "excellent",
            "confidence": 0.91
        },
        "ceiling": {
            "material": "drywall",
            "finish": "paint",
            "color": {"r": 255, "g": 255, "b": 255},  # White
            "texture": "smooth",
            "height_cm": 270,
            "condition": "good",
            "confidence": 0.85
        },
        "trim": {
            "material": "wood",
            "finish": "paint",
            "color": {"r": 255, "g": 255, "b": 255},  # White
            "style": "colonial",             # colonial, modern, craftsman
            "condition": "good",
            "confidence": 0.78
        }
    }
    
    return materials

def estimate_ceiling_height(floor_plan: Dict[str, Any]) -> int:
    """Estimate ceiling height from floor plan data"""
    # Use existing height if available, otherwise estimate
    return floor_plan.get("height_cm", 270)  # Default 2.7m

def calculate_natural_light_score(windows: List[Dict[str, Any]]) -> float:
    """Calculate natural light score based on window analysis"""
    if not windows:
        return 0.0
    
    total_score = 0.0
    for window in windows:
        features = window.get("visual_features", {})
        intensity = features.get("natural_light_intensity", 0.5)
        area = window.get("width", 1.0) * window.get("height", 1.0)
        total_score += intensity * area
    
    # Normalize to 0-1 scale
    return min(1.0, total_score / 10.0)

async def update_job_progress(job_id: str, progress: float, message: str):
    """Update job progress in Redis"""
    if redis_client:
        progress_data = {
            "job_id": job_id,
            "progress": progress,
            "message": message,
            "timestamp": asyncio.get_event_loop().time()
        }
        await redis_client.xadd(f"job_progress:{job_id}", progress_data)

async def segmentation_job_handler(msg):
    """Handle incoming segmentation jobs from NATS"""
    try:
        job_data = json.loads(msg.data.decode())
        logger.info(f"Received segmentation job: {job_data.get('id')}")
        
        result = await process_segmentation_job(job_data)
        
        if nats_client:
            await nats_client.publish(
                "segmentation.results",
                json.dumps(result.dict()).encode()
            )
            
    except Exception as e:
        logger.error(f"Error handling segmentation job: {e}")

@app.on_event("startup")
async def startup_event():
    await connect_services()
    if nats_client:
        await nats_client.subscribe("segmentation.jobs", cb=segmentation_job_handler)
        logger.info("Subscribed to segmentation.jobs")

@app.on_event("shutdown")
async def shutdown_event():
    if nats_client:
        await nats_client.close()
    if redis_client:
        await redis_client.close()

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "nats_connected": nats_client is not None and nats_client.is_connected,
        "redis_connected": redis_client is not None
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8004)),
        reload=True
    )
