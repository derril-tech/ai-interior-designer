#!/usr/bin/env python3
"""
Validate Worker - Validates layouts for collisions, clearances, and accessibility
"""

import asyncio
import json
import logging
import os
from typing import Dict, Any, Optional, List, Tuple

import nats
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import numpy as np
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Validate Worker",
    description="Validates layouts for collisions, clearances, and accessibility",
    version="1.0.0"
)

# Global connections
nats_client: Optional[nats.NATS] = None
redis_client: Optional[redis.Redis] = None

class ValidationJob(BaseModel):
    id: str
    layout_id: str
    room_id: str
    floor_plan: Dict[str, Any]
    layout: Dict[str, Any]
    constraints: Dict[str, Any] = {}

class ValidationResult(BaseModel):
    job_id: str
    layout_id: str
    status: str
    validation_report: Optional[Dict[str, Any]] = None
    heatmap_data: Optional[Dict[str, Any]] = None
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

async def validate_layout(job_data: Dict[str, Any]) -> ValidationResult:
    """Validate layout for collisions, clearances, and accessibility"""
    job_id = job_data.get("id")
    layout_id = job_data.get("layout_id")
    floor_plan = job_data.get("floor_plan", {})
    layout = job_data.get("layout", {})
    constraints = job_data.get("constraints", {})
    
    try:
        await update_job_progress(job_id, 0.1, "Starting layout validation")
        
        # Step 1: Parse room geometry
        room_geometry = parse_room_geometry(floor_plan)
        
        await update_job_progress(job_id, 0.2, "Analyzing furniture placements")
        
        # Step 2: Create furniture geometries
        furniture_geometries = create_furniture_geometries(layout.get("placements", []))
        
        await update_job_progress(job_id, 0.4, "Checking collisions")
        
        # Step 3: Collision detection
        collision_results = check_collisions(furniture_geometries, room_geometry)
        
        await update_job_progress(job_id, 0.6, "Validating clearances")
        
        # Step 4: Clearance validation
        clearance_results = validate_clearances(furniture_geometries, room_geometry, constraints)
        
        await update_job_progress(job_id, 0.8, "Analyzing accessibility")
        
        # Step 5: Accessibility analysis
        accessibility_results = analyze_accessibility(furniture_geometries, room_geometry, floor_plan)
        
        await update_job_progress(job_id, 0.9, "Generating heatmaps")
        
        # Step 6: Generate navigation heatmap
        heatmap_data = generate_navigation_heatmap(furniture_geometries, room_geometry)
        
        await update_job_progress(job_id, 1.0, "Validation complete")
        
        # Compile validation report
        validation_report = {
            "overall_score": calculate_overall_score(collision_results, clearance_results, accessibility_results),
            "collisions": collision_results,
            "clearances": clearance_results,
            "accessibility": accessibility_results,
            "recommendations": generate_recommendations(collision_results, clearance_results, accessibility_results),
            "metrics": {
                "total_violations": len(collision_results["violations"]) + len(clearance_results["violations"]),
                "accessibility_score": accessibility_results["score"],
                "flow_efficiency": accessibility_results["flow_efficiency"],
                "space_utilization": calculate_space_utilization(furniture_geometries, room_geometry)
            }
        }
        
        return ValidationResult(
            job_id=job_id,
            layout_id=layout_id,
            status="completed",
            validation_report=validation_report,
            heatmap_data=heatmap_data,
            progress=1.0
        )
        
    except Exception as e:
        logger.error(f"Error validating layout {layout_id}: {e}")
        return ValidationResult(
            job_id=job_id,
            layout_id=layout_id,
            status="failed",
            error=str(e),
            progress=0.0
        )

def parse_room_geometry(floor_plan: Dict[str, Any]) -> Dict[str, Any]:
    """Parse room geometry into Shapely objects"""
    walls = floor_plan.get("walls", [])
    doors = floor_plan.get("doors", [])
    windows = floor_plan.get("windows", [])
    bounds = floor_plan.get("bounds", {})
    
    # Create room boundary polygon
    if bounds:
        room_polygon = Polygon([
            (bounds["min_x"], bounds["min_y"]),
            (bounds["max_x"], bounds["min_y"]),
            (bounds["max_x"], bounds["max_y"]),
            (bounds["min_x"], bounds["max_y"])
        ])
    else:
        # Fallback: create polygon from walls
        wall_points = []
        for wall in walls:
            wall_points.extend([(wall["start"]["x"], wall["start"]["y"]), 
                              (wall["end"]["x"], wall["end"]["y"])])
        if wall_points:
            room_polygon = Polygon(wall_points).convex_hull
        else:
            room_polygon = Polygon([(0, 0), (5, 0), (5, 4), (0, 4)])
    
    # Create wall geometries
    wall_geometries = []
    for wall in walls:
        wall_line = LineString([
            (wall["start"]["x"], wall["start"]["y"]),
            (wall["end"]["x"], wall["end"]["y"])
        ])
        # Buffer by wall thickness
        thickness = wall.get("thickness", 0.15)
        wall_geom = wall_line.buffer(thickness / 2)
        wall_geometries.append({
            "id": wall["id"],
            "geometry": wall_geom,
            "type": "wall"
        })
    
    # Create door openings
    door_geometries = []
    for door in doors:
        door_center = Point(door["position"]["x"], door["position"]["y"])
        door_width = door.get("width", 0.8)
        # Create door swing arc
        door_geom = door_center.buffer(door_width)
        door_geometries.append({
            "id": door["id"],
            "geometry": door_geom,
            "type": "door",
            "swing_direction": door.get("swing_direction", "inward")
        })
    
    return {
        "room_polygon": room_polygon,
        "walls": wall_geometries,
        "doors": door_geometries,
        "bounds": bounds
    }

def create_furniture_geometries(placements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Create Shapely geometries for furniture placements"""
    furniture_geometries = []
    
    for placement in placements:
        x = placement.get("x", 0)
        y = placement.get("y", 0)
        rotation = placement.get("rotation", 0)
        dimensions = placement.get("dimensions", {"width": 1.0, "depth": 1.0, "height": 0.8})
        
        width = dimensions.get("width", 1.0)
        depth = dimensions.get("depth", 1.0)
        
        # Create rectangle centered at (x, y)
        half_width = width / 2
        half_depth = depth / 2
        
        # Create rectangle points
        points = [
            (-half_width, -half_depth),
            (half_width, -half_depth),
            (half_width, half_depth),
            (-half_width, half_depth)
        ]
        
        # Apply rotation
        if rotation != 0:
            angle_rad = np.radians(rotation)
            cos_a = np.cos(angle_rad)
            sin_a = np.sin(angle_rad)
            rotated_points = []
            for px, py in points:
                new_x = px * cos_a - py * sin_a
                new_y = px * sin_a + py * cos_a
                rotated_points.append((new_x, new_y))
            points = rotated_points
        
        # Translate to position
        translated_points = [(px + x, py + y) for px, py in points]
        
        furniture_geom = Polygon(translated_points)
        
        furniture_geometries.append({
            "id": placement.get("furniture_id", "unknown"),
            "name": placement.get("furniture_name", "Unknown"),
            "geometry": furniture_geom,
            "placement": placement,
            "clearances": placement.get("clearances", {"all": 0.4})
        })
    
    return furniture_geometries

def check_collisions(furniture_geometries: List[Dict], room_geometry: Dict) -> Dict[str, Any]:
    """Check for furniture collisions and room boundary violations"""
    violations = []
    collision_pairs = []
    
    # Check furniture-to-furniture collisions
    for i, furn1 in enumerate(furniture_geometries):
        for j, furn2 in enumerate(furniture_geometries[i+1:], i+1):
            if furn1["geometry"].intersects(furn2["geometry"]):
                overlap_area = furn1["geometry"].intersection(furn2["geometry"]).area
                collision_pairs.append({
                    "furniture_1": furn1["id"],
                    "furniture_2": furn2["id"],
                    "overlap_area": overlap_area,
                    "severity": "high" if overlap_area > 0.1 else "medium"
                })
                violations.append(f"Collision between {furn1['name']} and {furn2['name']}")
    
    # Check room boundary violations
    room_polygon = room_geometry["room_polygon"]
    for furniture in furniture_geometries:
        if not room_polygon.contains(furniture["geometry"]):
            # Check how much is outside
            if furniture["geometry"].intersects(room_polygon):
                outside_area = furniture["geometry"].difference(room_polygon).area
                violations.append(f"{furniture['name']} extends outside room boundary")
            else:
                violations.append(f"{furniture['name']} is completely outside room")
    
    # Check wall intersections
    for furniture in furniture_geometries:
        for wall in room_geometry["walls"]:
            if furniture["geometry"].intersects(wall["geometry"]):
                violations.append(f"{furniture['name']} intersects with wall")
    
    return {
        "violations": violations,
        "collision_pairs": collision_pairs,
        "total_collisions": len(collision_pairs),
        "boundary_violations": sum(1 for v in violations if "boundary" in v or "wall" in v)
    }

def validate_clearances(furniture_geometries: List[Dict], room_geometry: Dict, constraints: Dict) -> Dict[str, Any]:
    """Validate minimum clearances around furniture"""
    violations = []
    clearance_issues = []
    
    min_walkway = constraints.get("min_walkway_width", 0.8)
    min_door_clearance = constraints.get("min_door_clearance", 0.8)
    
    # Check clearances between furniture
    for i, furn1 in enumerate(furniture_geometries):
        for j, furn2 in enumerate(furniture_geometries[i+1:], i+1):
            distance = furn1["geometry"].distance(furn2["geometry"])
            required_clearance = max(
                furn1["clearances"].get("all", 0.4),
                furn2["clearances"].get("all", 0.4)
            )
            
            if distance < required_clearance:
                clearance_issues.append({
                    "furniture_1": furn1["id"],
                    "furniture_2": furn2["id"],
                    "actual_distance": round(distance, 2),
                    "required_distance": required_clearance,
                    "deficit": round(required_clearance - distance, 2)
                })
                violations.append(f"Insufficient clearance between {furn1['name']} and {furn2['name']}")
    
    # Check door clearances
    for door in room_geometry["doors"]:
        door_center = door["geometry"].centroid
        for furniture in furniture_geometries:
            distance = door_center.distance(furniture["geometry"])
            if distance < min_door_clearance:
                violations.append(f"{furniture['name']} too close to door (min {min_door_clearance}m)")
    
    # Check walkway widths (simplified)
    room_polygon = room_geometry["room_polygon"]
    furniture_union = unary_union([f["geometry"] for f in furniture_geometries])
    walkable_area = room_polygon.difference(furniture_union)
    
    # Estimate minimum walkway width (simplified calculation)
    if walkable_area.area < room_polygon.area * 0.3:  # Less than 30% walkable
        violations.append("Insufficient walkable area in room")
    
    return {
        "violations": violations,
        "clearance_issues": clearance_issues,
        "total_issues": len(clearance_issues),
        "walkable_area_ratio": walkable_area.area / room_polygon.area if room_polygon.area > 0 else 0
    }

def analyze_accessibility(furniture_geometries: List[Dict], room_geometry: Dict, floor_plan: Dict) -> Dict[str, Any]:
    """Analyze room accessibility and navigation flow"""
    
    doors = floor_plan.get("doors", [])
    windows = floor_plan.get("windows", [])
    
    # Calculate accessibility metrics
    door_access_scores = []
    for door in doors:
        door_point = Point(door["position"]["x"], door["position"]["y"])
        # Check if door is accessible (no furniture blocking)
        blocked = False
        for furniture in furniture_geometries:
            if door_point.distance(furniture["geometry"]) < 0.8:  # 80cm clearance
                blocked = True
                break
        door_access_scores.append(0.0 if blocked else 1.0)
    
    window_access_scores = []
    for window in windows:
        window_point = Point(window["position"]["x"], window["position"]["y"])
        # Check window accessibility
        blocked = False
        for furniture in furniture_geometries:
            if window_point.distance(furniture["geometry"]) < 0.6:  # 60cm clearance
                blocked = True
                break
        window_access_scores.append(0.0 if blocked else 1.0)
    
    # Calculate flow efficiency (simplified)
    room_polygon = room_geometry["room_polygon"]
    furniture_union = unary_union([f["geometry"] for f in furniture_geometries])
    walkable_area = room_polygon.difference(furniture_union)
    
    # Flow efficiency based on walkable area and connectivity
    flow_efficiency = min(1.0, walkable_area.area / (room_polygon.area * 0.4))  # Target 40% walkable
    
    # Overall accessibility score
    door_score = np.mean(door_access_scores) if door_access_scores else 1.0
    window_score = np.mean(window_access_scores) if window_access_scores else 1.0
    overall_score = (door_score * 0.5 + window_score * 0.3 + flow_efficiency * 0.2)
    
    return {
        "score": round(overall_score, 3),
        "door_accessibility": door_score,
        "window_accessibility": window_score,
        "flow_efficiency": round(flow_efficiency, 3),
        "blocked_doors": sum(1 for score in door_access_scores if score == 0),
        "blocked_windows": sum(1 for score in window_access_scores if score == 0)
    }

def generate_navigation_heatmap(furniture_geometries: List[Dict], room_geometry: Dict) -> Dict[str, Any]:
    """Generate navigation flow heatmap"""
    
    room_polygon = room_geometry["room_polygon"]
    bounds = room_polygon.bounds  # (minx, miny, maxx, maxy)
    
    # Create grid for heatmap
    grid_resolution = 0.2  # 20cm resolution
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    
    grid_width = int(width / grid_resolution) + 1
    grid_height = int(height / grid_resolution) + 1
    
    # Initialize heatmap grid
    heatmap = np.zeros((grid_height, grid_width))
    
    # Calculate navigation scores for each grid cell
    for i in range(grid_height):
        for j in range(grid_width):
            x = bounds[0] + j * grid_resolution
            y = bounds[1] + i * grid_resolution
            point = Point(x, y)
            
            # Check if point is in room
            if not room_polygon.contains(point):
                heatmap[i, j] = -1  # Outside room
                continue
            
            # Check distance to furniture
            min_distance = float('inf')
            for furniture in furniture_geometries:
                distance = point.distance(furniture["geometry"])
                min_distance = min(min_distance, distance)
            
            # Convert distance to navigation score (0-1)
            if min_distance < 0.3:  # Too close to furniture
                heatmap[i, j] = 0.0
            elif min_distance > 1.5:  # Good clearance
                heatmap[i, j] = 1.0
            else:
                # Linear interpolation between 0.3 and 1.5 meters
                heatmap[i, j] = (min_distance - 0.3) / 1.2
    
    return {
        "grid": heatmap.tolist(),
        "bounds": bounds,
        "resolution": grid_resolution,
        "width": grid_width,
        "height": grid_height
    }

def calculate_overall_score(collision_results: Dict, clearance_results: Dict, accessibility_results: Dict) -> float:
    """Calculate overall layout validation score"""
    
    # Penalty for violations
    collision_penalty = min(1.0, collision_results["total_collisions"] * 0.2)
    clearance_penalty = min(1.0, clearance_results["total_issues"] * 0.1)
    
    # Base score from accessibility
    base_score = accessibility_results["score"]
    
    # Apply penalties
    final_score = base_score * (1.0 - collision_penalty) * (1.0 - clearance_penalty)
    
    return round(max(0.0, final_score), 3)

def calculate_space_utilization(furniture_geometries: List[Dict], room_geometry: Dict) -> float:
    """Calculate how efficiently the space is utilized"""
    room_area = room_geometry["room_polygon"].area
    furniture_area = sum(f["geometry"].area for f in furniture_geometries)
    
    # Optimal utilization is around 25-35% for living spaces
    utilization_ratio = furniture_area / room_area if room_area > 0 else 0
    
    # Score based on how close to optimal range
    if 0.25 <= utilization_ratio <= 0.35:
        return 1.0
    elif utilization_ratio < 0.25:
        return utilization_ratio / 0.25  # Under-utilized
    else:
        return max(0.0, 1.0 - (utilization_ratio - 0.35) / 0.3)  # Over-utilized

def generate_recommendations(collision_results: Dict, clearance_results: Dict, accessibility_results: Dict) -> List[str]:
    """Generate actionable recommendations for layout improvements"""
    recommendations = []
    
    # Collision recommendations
    if collision_results["total_collisions"] > 0:
        recommendations.append("Move overlapping furniture to eliminate collisions")
    
    if collision_results["boundary_violations"] > 0:
        recommendations.append("Ensure all furniture fits within room boundaries")
    
    # Clearance recommendations
    if clearance_results["total_issues"] > 0:
        recommendations.append("Increase spacing between furniture for better flow")
    
    if clearance_results["walkable_area_ratio"] < 0.3:
        recommendations.append("Reduce furniture density to improve walkability")
    
    # Accessibility recommendations
    if accessibility_results["blocked_doors"] > 0:
        recommendations.append("Clear pathways to doors for emergency access")
    
    if accessibility_results["blocked_windows"] > 0:
        recommendations.append("Improve access to windows for natural light and ventilation")
    
    if accessibility_results["flow_efficiency"] < 0.7:
        recommendations.append("Reorganize furniture to create better navigation paths")
    
    return recommendations

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

async def validation_job_handler(msg):
    """Handle incoming validation jobs from NATS"""
    try:
        job_data = json.loads(msg.data.decode())
        logger.info(f"Received validation job: {job_data.get('id')}")
        
        result = await validate_layout(job_data)
        
        if nats_client:
            await nats_client.publish(
                "validation.results",
                json.dumps(result.dict()).encode()
            )
            
    except Exception as e:
        logger.error(f"Error handling validation job: {e}")

@app.on_event("startup")
async def startup_event():
    await connect_services()
    if nats_client:
        await nats_client.subscribe("validation.jobs", cb=validation_job_handler)
        logger.info("Subscribed to validation.jobs")

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
        port=int(os.getenv("PORT", 8005)),
        reload=True
    )
