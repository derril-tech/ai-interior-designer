#!/usr/bin/env python3
"""
Scan Worker - Processes room scan data into 3D meshes and floor plans
"""

import asyncio
import json
import logging
import os
from typing import Dict, Any, Optional

import nats
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Scan Worker",
    description="Processes room scan data into 3D meshes and floor plans",
    version="1.0.0"
)

# Global connections
nats_client: Optional[nats.NATS] = None
redis_client: Optional[redis.Redis] = None

class ScanJob(BaseModel):
    id: str
    room_id: str
    frames: list
    poses: list
    device_info: Dict[str, Any]

class JobResult(BaseModel):
    job_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    progress: float = 0.0

async def connect_services():
    """Connect to NATS and Redis"""
    global nats_client, redis_client
    
    # Connect to NATS
    nats_url = os.getenv("NATS_URL", "nats://localhost:4222")
    nats_client = await nats.connect(nats_url)
    logger.info(f"Connected to NATS at {nats_url}")
    
    # Connect to Redis
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    redis_client = redis.from_url(redis_url)
    logger.info(f"Connected to Redis at {redis_url}")

async def process_scan_job(job_data: Dict[str, Any]) -> JobResult:
    """Process a scan job with SLAM/photogrammetry"""
    job_id = job_data.get("id")
    room_id = job_data.get("room_id")
    frames = job_data.get("frames", [])
    poses = job_data.get("poses", [])
    
    try:
        # Update progress
        await update_job_progress(job_id, 0.1, "Starting scan processing")
        
        # Step 1: Validate input data
        if not frames or len(frames) < 10:
            raise ValueError("Insufficient frames for processing (minimum 10 required)")
        
        await update_job_progress(job_id, 0.2, "Validating scan data")
        
        # Step 2: Feature extraction and matching
        await update_job_progress(job_id, 0.3, "Extracting visual features")
        feature_points = await extract_features(frames)
        
        # Step 3: SLAM processing
        await update_job_progress(job_id, 0.5, "Running SLAM algorithm")
        camera_trajectory, sparse_points = await run_slam(frames, poses, feature_points)
        
        # Step 4: Dense reconstruction
        await update_job_progress(job_id, 0.7, "Dense 3D reconstruction")
        dense_mesh = await dense_reconstruction(frames, camera_trajectory, sparse_points)
        
        # Step 5: Floor plan extraction
        await update_job_progress(job_id, 0.85, "Extracting floor plan")
        floor_plan = await extract_floor_plan(dense_mesh)
        
        # Step 6: Mesh optimization and export
        await update_job_progress(job_id, 0.95, "Optimizing mesh")
        mesh_url = await export_mesh(dense_mesh, job_id, room_id)
        
        await update_job_progress(job_id, 1.0, "Scan processing complete")
        
        # Calculate quality metrics
        quality_score = calculate_quality_score(
            len(frames), 
            len(feature_points), 
            floor_plan.get("area_sqm", 0)
        )
        
        result = {
            "mesh_url": mesh_url,
            "floor_plan": floor_plan,
            "quality_score": quality_score,
            "camera_trajectory": camera_trajectory,
            "processing_stats": {
                "frames_processed": len(frames),
                "feature_points": len(feature_points),
                "processing_time": asyncio.get_event_loop().time()
            }
        }
        
        return JobResult(
            job_id=job_id,
            status="completed",
            result=result,
            progress=1.0
        )
        
    except Exception as e:
        logger.error(f"Error processing scan job {job_id}: {e}")
        return JobResult(
            job_id=job_id,
            status="failed",
            error=str(e),
            progress=0.0
        )

async def extract_features(frames: list) -> list:
    """Extract SIFT/ORB features from frames"""
    # Simulate feature extraction
    await asyncio.sleep(0.5)
    
    # Mock feature points - in real implementation, use OpenCV SIFT/ORB
    feature_points = []
    for i, frame in enumerate(frames[:50]):  # Process up to 50 frames
        # Simulate feature detection
        num_features = min(1000, len(frames) * 20)  # Mock feature count
        feature_points.extend([
            {"frame_id": i, "x": j % 640, "y": j % 480, "descriptor": f"feat_{i}_{j}"}
            for j in range(num_features // len(frames))
        ])
    
    return feature_points

async def run_slam(frames: list, poses: list, features: list) -> tuple:
    """Run SLAM algorithm to estimate camera poses and sparse 3D points"""
    # Simulate SLAM processing
    await asyncio.sleep(1.0)
    
    # Mock camera trajectory
    camera_trajectory = []
    for i in range(len(frames)):
        # Simulate camera pose estimation
        camera_trajectory.append({
            "frame_id": i,
            "position": {"x": i * 0.1, "y": 0, "z": i * 0.05},
            "rotation": {"x": 0, "y": i * 0.02, "z": 0, "w": 1},
            "confidence": 0.85 + (i % 10) * 0.01
        })
    
    # Mock sparse 3D points
    sparse_points = [
        {
            "id": i,
            "position": {"x": (i % 100) * 0.05, "y": (i % 50) * 0.05, "z": (i % 30) * 0.05},
            "color": {"r": 128, "g": 128, "b": 128},
            "confidence": 0.8
        }
        for i in range(min(5000, len(features) // 2))
    ]
    
    return camera_trajectory, sparse_points

async def dense_reconstruction(frames: list, trajectory: list, sparse_points: list) -> dict:
    """Generate dense 3D mesh from sparse reconstruction"""
    # Simulate dense reconstruction
    await asyncio.sleep(1.5)
    
    # Mock dense mesh data
    mesh = {
        "vertices": [
            {"x": (i % 100) * 0.1, "y": (i % 50) * 0.1, "z": (i % 30) * 0.1}
            for i in range(10000)
        ],
        "faces": [
            {"v1": i, "v2": i+1, "v3": i+2}
            for i in range(0, 9997, 3)
        ],
        "normals": [
            {"x": 0, "y": 1, "z": 0}
            for _ in range(10000)
        ],
        "texture_coords": [
            {"u": (i % 100) / 100.0, "v": (i % 50) / 50.0}
            for i in range(10000)
        ]
    }
    
    return mesh

async def extract_floor_plan(mesh: dict) -> dict:
    """Extract 2D floor plan from 3D mesh"""
    # Simulate floor plan extraction
    await asyncio.sleep(0.5)
    
    # Mock floor plan - in real implementation, analyze mesh geometry
    floor_plan = {
        "walls": [
            {
                "id": "wall_1",
                "start": {"x": 0, "y": 0},
                "end": {"x": 5.0, "y": 0},
                "height": 2.7,
                "thickness": 0.15
            },
            {
                "id": "wall_2", 
                "start": {"x": 5.0, "y": 0},
                "end": {"x": 5.0, "y": 4.0},
                "height": 2.7,
                "thickness": 0.15
            },
            {
                "id": "wall_3",
                "start": {"x": 5.0, "y": 4.0},
                "end": {"x": 0, "y": 4.0},
                "height": 2.7,
                "thickness": 0.15
            },
            {
                "id": "wall_4",
                "start": {"x": 0, "y": 4.0},
                "end": {"x": 0, "y": 0},
                "height": 2.7,
                "thickness": 0.15
            }
        ],
        "doors": [
            {
                "id": "door_1",
                "wall_id": "wall_1",
                "position": {"x": 2.5, "y": 0},
                "width": 0.8,
                "height": 2.0,
                "swing_direction": "inward"
            }
        ],
        "windows": [
            {
                "id": "window_1",
                "wall_id": "wall_2",
                "position": {"x": 5.0, "y": 2.0},
                "width": 1.2,
                "height": 1.0,
                "sill_height": 1.0
            }
        ],
        "area_sqm": 20.0,
        "height_cm": 270,
        "bounds": {
            "min_x": 0, "max_x": 5.0,
            "min_y": 0, "max_y": 4.0
        }
    }
    
    return floor_plan

async def export_mesh(mesh: dict, job_id: str, room_id: str) -> str:
    """Export mesh to glTF format and upload to storage"""
    # Simulate mesh export
    await asyncio.sleep(0.3)
    
    # In real implementation, convert mesh to glTF format
    # and upload to S3/storage service
    mesh_url = f"s3://ai-interior-designer/meshes/{room_id}/{job_id}.gltf"
    
    return mesh_url

def calculate_quality_score(num_frames: int, num_features: int, area_sqm: float) -> float:
    """Calculate overall scan quality score"""
    # Quality factors
    frame_score = min(1.0, num_frames / 100.0)  # Optimal around 100 frames
    feature_score = min(1.0, num_features / 10000.0)  # Good feature density
    area_score = min(1.0, area_sqm / 50.0) if area_sqm > 0 else 0.5  # Reasonable room size
    
    # Weighted average
    quality = (frame_score * 0.3 + feature_score * 0.4 + area_score * 0.3)
    
    return round(quality, 3)

async def update_job_progress(job_id: str, progress: float, message: str):
    """Update job progress in Redis"""
    if redis_client:
        progress_data = {
            "job_id": job_id,
            "progress": progress,
            "message": message,
            "timestamp": asyncio.get_event_loop().time()
        }
        await redis_client.xadd(
            f"job_progress:{job_id}",
            progress_data
        )

async def scan_job_handler(msg):
    """Handle incoming scan jobs from NATS"""
    try:
        job_data = json.loads(msg.data.decode())
        logger.info(f"Received scan job: {job_data.get('id')}")
        
        result = await process_scan_job(job_data)
        
        # Publish result back to NATS
        if nats_client:
            await nats_client.publish(
                "scan.results",
                json.dumps(result.dict()).encode()
            )
            
    except Exception as e:
        logger.error(f"Error handling scan job: {e}")

@app.on_event("startup")
async def startup_event():
    """Initialize connections and subscribe to job queue"""
    await connect_services()
    
    # Subscribe to scan jobs
    if nats_client:
        await nats_client.subscribe("scan.jobs", cb=scan_job_handler)
        logger.info("Subscribed to scan.jobs")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up connections"""
    if nats_client:
        await nats_client.close()
    if redis_client:
        await redis_client.close()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "nats_connected": nats_client is not None and nats_client.is_connected,
        "redis_connected": redis_client is not None
    }

@app.post("/jobs/scan")
async def submit_scan_job(job: ScanJob):
    """Submit a scan job directly (for testing)"""
    if not nats_client:
        raise HTTPException(status_code=503, detail="NATS not connected")
    
    # Publish job to NATS
    await nats_client.publish(
        "scan.jobs",
        json.dumps(job.dict()).encode()
    )
    
    return {"message": "Job submitted", "job_id": job.id}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8001)),
        reload=True
    )
