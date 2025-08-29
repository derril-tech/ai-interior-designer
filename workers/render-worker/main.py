#!/usr/bin/env python3
"""
Render Worker - Generates AR assets (USDZ/glTF) and PBR thumbnails
"""

import asyncio
import json
import logging
import os
from typing import Dict, Any, Optional, List
import tempfile
import base64
from pathlib import Path

import nats
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import numpy as np
from PIL import Image

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Render Worker",
    description="Generates AR assets (USDZ/glTF) and PBR thumbnails",
    version="1.0.0"
)

# Global connections
nats_client: Optional[nats.NATS] = None
redis_client: Optional[redis.Redis] = None

class RenderJob(BaseModel):
    id: str
    layout_id: str
    room_id: str
    layout_data: Dict[str, Any]
    room_mesh: Optional[str] = None
    output_formats: List[str] = ["usdz", "gltf"]
    quality: str = "medium"  # low, medium, high
    include_thumbnails: bool = True

class RenderResult(BaseModel):
    job_id: str
    layout_id: str
    status: str
    assets: Optional[Dict[str, str]] = None
    thumbnails: Optional[Dict[str, str]] = None
    file_sizes: Optional[Dict[str, int]] = None
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

async def process_render_job(job_data: Dict[str, Any]) -> RenderResult:
    """Process render job to generate AR assets"""
    job_id = job_data.get("id")
    layout_id = job_data.get("layout_id")
    layout_data = job_data.get("layout_data", {})
    room_mesh = job_data.get("room_mesh")
    output_formats = job_data.get("output_formats", ["usdz", "gltf"])
    quality = job_data.get("quality", "medium")
    
    try:
        await update_job_progress(job_id, 0.1, "Starting render process")
        
        # Step 1: Load and process furniture models
        furniture_models = await load_furniture_models(layout_data.get("placements", []))
        
        await update_job_progress(job_id, 0.3, "Processing room geometry")
        
        # Step 2: Process room mesh if available
        room_geometry = await process_room_mesh(room_mesh) if room_mesh else None
        
        await update_job_progress(job_id, 0.5, "Generating 3D scene")
        
        # Step 3: Create combined 3D scene
        scene_data = await create_ar_scene(furniture_models, room_geometry, layout_data)
        
        await update_job_progress(job_id, 0.7, "Optimizing for AR")
        
        # Step 4: Generate AR assets in requested formats
        assets = {}
        file_sizes = {}
        
        for format_type in output_formats:
            if format_type == "usdz":
                asset_path = await generate_usdz_asset(scene_data, layout_id, quality)
            elif format_type == "gltf":
                asset_path = await generate_gltf_asset(scene_data, layout_id, quality)
            else:
                continue
            
            # Upload to storage and get URL
            asset_url = await upload_asset_to_storage(asset_path, layout_id, format_type)
            assets[format_type] = asset_url
            
            # Get file size
            if os.path.exists(asset_path):
                file_sizes[format_type] = os.path.getsize(asset_path)
        
        await update_job_progress(job_id, 0.9, "Generating thumbnails")
        
        # Step 5: Generate thumbnails
        thumbnails = {}
        if job_data.get("include_thumbnails", True):
            thumbnails = await generate_thumbnails(scene_data, layout_id)
        
        await update_job_progress(job_id, 1.0, "Render complete")
        
        return RenderResult(
            job_id=job_id,
            layout_id=layout_id,
            status="completed",
            assets=assets,
            thumbnails=thumbnails,
            file_sizes=file_sizes,
            progress=1.0
        )
        
    except Exception as e:
        logger.error(f"Error processing render job {job_id}: {e}")
        return RenderResult(
            job_id=job_id,
            layout_id=layout_id,
            status="failed",
            error=str(e),
            progress=0.0
        )

async def load_furniture_models(placements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Load 3D models for furniture items"""
    await asyncio.sleep(0.5)  # Simulate model loading
    
    furniture_models = []
    
    for placement in placements:
        furniture_id = placement.get("furniture_id", "")
        
        # Mock furniture model data
        model_data = {
            "id": furniture_id,
            "name": placement.get("furniture_name", "Unknown"),
            "position": {
                "x": placement.get("x", 0),
                "y": placement.get("y", 0),
                "z": 0  # Floor level
            },
            "rotation": {
                "x": 0,
                "y": placement.get("rotation", 0),
                "z": 0
            },
            "scale": {
                "x": 1.0,
                "y": 1.0,
                "z": 1.0
            },
            "dimensions": placement.get("dimensions", {"width": 1.0, "depth": 1.0, "height": 0.8}),
            "geometry": await generate_furniture_geometry(furniture_id, placement.get("dimensions", {})),
            "materials": await get_furniture_materials(furniture_id),
            "bounding_box": calculate_bounding_box(placement.get("dimensions", {}))
        }
        
        furniture_models.append(model_data)
    
    return furniture_models

async def generate_furniture_geometry(furniture_id: str, dimensions: Dict[str, float]) -> Dict[str, Any]:
    """Generate or load furniture geometry"""
    await asyncio.sleep(0.1)
    
    width = dimensions.get("width", 100) / 100.0  # Convert cm to meters
    depth = dimensions.get("depth", 50) / 100.0
    height = dimensions.get("height", 80) / 100.0
    
    # Generate simple box geometry for mock
    vertices = [
        # Bottom face
        [-width/2, -depth/2, 0], [width/2, -depth/2, 0], [width/2, depth/2, 0], [-width/2, depth/2, 0],
        # Top face
        [-width/2, -depth/2, height], [width/2, -depth/2, height], [width/2, depth/2, height], [-width/2, depth/2, height]
    ]
    
    faces = [
        # Bottom
        [0, 1, 2], [0, 2, 3],
        # Top
        [4, 6, 5], [4, 7, 6],
        # Sides
        [0, 4, 5], [0, 5, 1],
        [1, 5, 6], [1, 6, 2],
        [2, 6, 7], [2, 7, 3],
        [3, 7, 4], [3, 4, 0]
    ]
    
    # Generate UV coordinates
    uvs = [[0, 0], [1, 0], [1, 1], [0, 1]] * 2  # Simple UV mapping
    
    return {
        "vertices": vertices,
        "faces": faces,
        "uvs": uvs,
        "normals": calculate_normals(vertices, faces)
    }

async def get_furniture_materials(furniture_id: str) -> Dict[str, Any]:
    """Get material properties for furniture"""
    
    # Mock material based on furniture type
    if "sofa" in furniture_id.lower():
        return {
            "base_color": [0.8, 0.7, 0.6, 1.0],  # Beige fabric
            "metallic": 0.0,
            "roughness": 0.8,
            "texture_urls": {
                "diffuse": f"/textures/fabric_beige_diffuse.jpg",
                "normal": f"/textures/fabric_normal.jpg",
                "roughness": f"/textures/fabric_roughness.jpg"
            }
        }
    elif "table" in furniture_id.lower():
        return {
            "base_color": [0.6, 0.4, 0.2, 1.0],  # Wood brown
            "metallic": 0.0,
            "roughness": 0.4,
            "texture_urls": {
                "diffuse": f"/textures/wood_oak_diffuse.jpg",
                "normal": f"/textures/wood_normal.jpg",
                "roughness": f"/textures/wood_roughness.jpg"
            }
        }
    else:
        return {
            "base_color": [0.7, 0.7, 0.7, 1.0],  # Gray default
            "metallic": 0.1,
            "roughness": 0.5,
            "texture_urls": {}
        }

def calculate_normals(vertices: List[List[float]], faces: List[List[int]]) -> List[List[float]]:
    """Calculate vertex normals"""
    normals = [[0.0, 0.0, 0.0] for _ in vertices]
    
    for face in faces:
        # Calculate face normal
        v1 = np.array(vertices[face[1]]) - np.array(vertices[face[0]])
        v2 = np.array(vertices[face[2]]) - np.array(vertices[face[0]])
        normal = np.cross(v1, v2)
        normal = normal / np.linalg.norm(normal)
        
        # Add to vertex normals
        for vertex_idx in face:
            for i in range(3):
                normals[vertex_idx][i] += normal[i]
    
    # Normalize vertex normals
    for i, normal in enumerate(normals):
        norm = np.linalg.norm(normal)
        if norm > 0:
            normals[i] = [n / norm for n in normal]
    
    return normals

def calculate_bounding_box(dimensions: Dict[str, float]) -> Dict[str, List[float]]:
    """Calculate bounding box for furniture"""
    width = dimensions.get("width", 100) / 100.0
    depth = dimensions.get("depth", 50) / 100.0
    height = dimensions.get("height", 80) / 100.0
    
    return {
        "min": [-width/2, -depth/2, 0],
        "max": [width/2, depth/2, height]
    }

async def process_room_mesh(room_mesh_url: str) -> Optional[Dict[str, Any]]:
    """Process room mesh data"""
    await asyncio.sleep(0.3)
    
    # Mock room processing - in real implementation, load and process glTF/mesh data
    return {
        "vertices": [],
        "faces": [],
        "materials": {
            "floor": {
                "base_color": [0.9, 0.9, 0.85, 1.0],
                "metallic": 0.0,
                "roughness": 0.7
            },
            "walls": {
                "base_color": [0.95, 0.95, 0.95, 1.0],
                "metallic": 0.0,
                "roughness": 0.8
            }
        }
    }

async def create_ar_scene(furniture_models: List[Dict], room_geometry: Optional[Dict], layout_data: Dict) -> Dict[str, Any]:
    """Create combined AR scene with furniture and room"""
    await asyncio.sleep(0.4)
    
    scene = {
        "metadata": {
            "version": "1.0",
            "generator": "AI Interior Designer",
            "layout_id": layout_data.get("id", ""),
            "layout_name": layout_data.get("name", ""),
            "created_at": asyncio.get_event_loop().time()
        },
        "scene": {
            "nodes": [],
            "meshes": [],
            "materials": [],
            "textures": []
        },
        "furniture": furniture_models,
        "room": room_geometry,
        "lighting": {
            "ambient": [0.2, 0.2, 0.2],
            "directional": {
                "direction": [0.5, -1.0, 0.3],
                "color": [1.0, 1.0, 0.9],
                "intensity": 0.8
            }
        },
        "camera": {
            "position": [0, 1.6, 3.0],  # Eye level, 3m back
            "target": [0, 0, 0],
            "up": [0, 1, 0]
        }
    }
    
    return scene

async def generate_usdz_asset(scene_data: Dict[str, Any], layout_id: str, quality: str) -> str:
    """Generate USDZ asset for iOS AR"""
    await asyncio.sleep(1.0)  # Simulate USDZ generation
    
    # Mock USDZ generation - in real implementation, use USD Python API
    output_path = f"/tmp/{layout_id}.usdz"
    
    # Create mock USDZ file
    with open(output_path, "wb") as f:
        f.write(b"Mock USDZ content for layout " + layout_id.encode())
    
    logger.info(f"Generated USDZ asset: {output_path}")
    return output_path

async def generate_gltf_asset(scene_data: Dict[str, Any], layout_id: str, quality: str) -> str:
    """Generate glTF asset for Android/WebXR"""
    await asyncio.sleep(0.8)  # Simulate glTF generation
    
    # Mock glTF generation - in real implementation, use pygltflib
    output_path = f"/tmp/{layout_id}.gltf"
    
    # Create basic glTF structure
    gltf_data = {
        "asset": {
            "version": "2.0",
            "generator": "AI Interior Designer Render Worker"
        },
        "scene": 0,
        "scenes": [{"nodes": []}],
        "nodes": [],
        "meshes": [],
        "materials": [],
        "accessors": [],
        "bufferViews": [],
        "buffers": []
    }
    
    # Add furniture nodes
    for i, furniture in enumerate(scene_data.get("furniture", [])):
        node = {
            "name": furniture["name"],
            "translation": [
                furniture["position"]["x"],
                furniture["position"]["y"], 
                furniture["position"]["z"]
            ],
            "rotation": [0, furniture["rotation"]["y"], 0, 1],
            "mesh": i
        }
        gltf_data["nodes"].append(node)
        gltf_data["scenes"][0]["nodes"].append(i)
        
        # Add mesh data (simplified)
        mesh = {
            "name": f"{furniture['name']}_mesh",
            "primitives": [{
                "attributes": {"POSITION": 0},
                "material": i
            }]
        }
        gltf_data["meshes"].append(mesh)
        
        # Add material
        material = {
            "name": f"{furniture['name']}_material",
            "pbrMetallicRoughness": {
                "baseColorFactor": furniture["materials"]["base_color"],
                "metallicFactor": furniture["materials"]["metallic"],
                "roughnessFactor": furniture["materials"]["roughness"]
            }
        }
        gltf_data["materials"].append(material)
    
    # Write glTF file
    with open(output_path, "w") as f:
        json.dump(gltf_data, f, indent=2)
    
    logger.info(f"Generated glTF asset: {output_path}")
    return output_path

async def upload_asset_to_storage(asset_path: str, layout_id: str, format_type: str) -> str:
    """Upload asset to S3/storage and return URL"""
    await asyncio.sleep(0.2)
    
    # Mock upload - in real implementation, use boto3 to upload to S3
    filename = f"{layout_id}.{format_type}"
    storage_url = f"https://storage.ai-interior-designer.com/ar-assets/{filename}"
    
    logger.info(f"Uploaded {format_type} asset to: {storage_url}")
    return storage_url

async def generate_thumbnails(scene_data: Dict[str, Any], layout_id: str) -> Dict[str, str]:
    """Generate thumbnail images of the layout"""
    await asyncio.sleep(0.5)
    
    thumbnails = {}
    
    # Generate different thumbnail views
    views = ["perspective", "top", "front", "side"]
    
    for view in views:
        # Mock thumbnail generation - in real implementation, use rendering engine
        thumbnail_path = f"/tmp/{layout_id}_{view}_thumb.jpg"
        
        # Create simple colored image as mock
        img = Image.new("RGB", (400, 300), color=(200, 200, 200))
        img.save(thumbnail_path, "JPEG", quality=85)
        
        # Upload and get URL
        thumbnail_url = await upload_thumbnail_to_storage(thumbnail_path, layout_id, view)
        thumbnails[view] = thumbnail_url
    
    return thumbnails

async def upload_thumbnail_to_storage(thumbnail_path: str, layout_id: str, view: str) -> str:
    """Upload thumbnail to storage"""
    await asyncio.sleep(0.1)
    
    # Mock upload
    filename = f"{layout_id}_{view}_thumb.jpg"
    storage_url = f"https://storage.ai-interior-designer.com/thumbnails/{filename}"
    
    return storage_url

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

async def render_job_handler(msg):
    """Handle incoming render jobs from NATS"""
    try:
        job_data = json.loads(msg.data.decode())
        logger.info(f"Received render job: {job_data.get('id')}")
        
        result = await process_render_job(job_data)
        
        if nats_client:
            await nats_client.publish(
                "render.results",
                json.dumps(result.dict()).encode()
            )
            
    except Exception as e:
        logger.error(f"Error handling render job: {e}")

@app.on_event("startup")
async def startup_event():
    await connect_services()
    if nats_client:
        await nats_client.subscribe("render.jobs", cb=render_job_handler)
        logger.info("Subscribed to render.jobs")

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

@app.post("/render/{layout_id}")
async def render_layout(layout_id: str, render_request: RenderJob):
    """Manually trigger layout rendering"""
    if nats_client:
        await nats_client.publish(
            "render.jobs",
            json.dumps(render_request.dict()).encode()
        )
    
    return {"job_id": render_request.id, "message": f"Render job submitted for layout {layout_id}"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8007)),
        reload=True
    )
