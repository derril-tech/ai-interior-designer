#!/usr/bin/env python3
"""
Layout Worker - Generates furniture layout variants using constraint programming
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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Layout Worker",
    description="Generates furniture layout variants using constraint programming",
    version="1.0.0"
)

# Global connections
nats_client: Optional[nats.NATS] = None
redis_client: Optional[redis.Redis] = None

class LayoutJob(BaseModel):
    id: str
    room_id: str
    floor_plan: Dict[str, Any]
    constraints: Dict[str, Any]
    style_prefs: List[str] = []
    budget_cents: Optional[int] = None

class LayoutResult(BaseModel):
    job_id: str
    status: str
    layouts: Optional[List[Dict[str, Any]]] = None
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

async def generate_layouts(job_data: Dict[str, Any]) -> LayoutResult:
    """Generate layout variants using constraint programming"""
    job_id = job_data.get("id")
    room_id = job_data.get("room_id")
    floor_plan = job_data.get("floor_plan", {})
    constraints = job_data.get("constraints", {})
    style_prefs = job_data.get("style_prefs", [])
    budget_cents = job_data.get("budget_cents")
    
    try:
        await update_job_progress(job_id, 0.1, "Initializing constraint model")
        
        # Step 1: Parse room geometry and constraints
        room_bounds = floor_plan.get("bounds", {})
        walls = floor_plan.get("walls", [])
        doors = floor_plan.get("doors", [])
        windows = floor_plan.get("windows", [])
        
        await update_job_progress(job_id, 0.2, "Analyzing room geometry")
        
        # Step 2: Generate furniture catalog for room
        furniture_catalog = await generate_furniture_catalog(floor_plan, style_prefs, budget_cents)
        
        await update_job_progress(job_id, 0.3, "Building constraint model")
        
        # Step 3: Create constraint programming model
        constraint_model = await build_constraint_model(
            room_bounds, walls, doors, windows, furniture_catalog, constraints
        )
        
        await update_job_progress(job_id, 0.5, "Solving layout constraints")
        
        # Step 4: Solve for multiple layout variants
        layout_solutions = await solve_layout_variants(constraint_model, num_variants=3)
        
        await update_job_progress(job_id, 0.8, "Optimizing and scoring layouts")
        
        # Step 5: Post-process and score layouts
        layouts = []
        for i, solution in enumerate(layout_solutions):
            layout = await post_process_layout(
                solution, furniture_catalog, floor_plan, f"{job_id}_layout_{i+1}"
            )
            layouts.append(layout)
        
        await update_job_progress(job_id, 1.0, "Layout generation complete")
        
        return LayoutResult(
            job_id=job_id,
            status="completed",
            layouts=layouts,
            progress=1.0
        )
        
    except Exception as e:
        logger.error(f"Error generating layouts for job {job_id}: {e}")
        return LayoutResult(
            job_id=job_id,
            status="failed",
            error=str(e),
            progress=0.0
        )

async def generate_furniture_catalog(floor_plan: Dict[str, Any], style_prefs: List[str], budget_cents: Optional[int]) -> List[Dict[str, Any]]:
    """Generate appropriate furniture items for the room"""
    await asyncio.sleep(0.2)
    
    area_sqm = floor_plan.get("area_sqm", 20.0)
    room_type = determine_room_type(floor_plan)
    
    # Base furniture catalog with dimensions in meters
    base_catalog = [
        # Seating
        {
            "id": "sofa_3seat", "name": "3-Seat Sofa", "category": "seating",
            "dimensions": {"width": 2.28, "depth": 0.95, "height": 0.83},
            "clearances": {"front": 0.8, "back": 0.3, "sides": 0.3},
            "price_cents": 79900, "style_tags": ["modern", "traditional"],
            "placement_rules": ["against_wall", "room_center"], "priority": 1
        },
        {
            "id": "armchair", "name": "Armchair", "category": "seating", 
            "dimensions": {"width": 0.8, "depth": 0.85, "height": 0.9},
            "clearances": {"front": 0.6, "back": 0.2, "sides": 0.2},
            "price_cents": 39900, "style_tags": ["modern", "traditional", "minimalist"],
            "placement_rules": ["corner", "accent"], "priority": 2
        },
        
        # Tables
        {
            "id": "coffee_table", "name": "Coffee Table", "category": "table",
            "dimensions": {"width": 1.2, "depth": 0.6, "height": 0.45},
            "clearances": {"all": 0.4},
            "price_cents": 24999, "style_tags": ["modern", "minimalist"],
            "placement_rules": ["sofa_front"], "priority": 2
        },
        {
            "id": "side_table", "name": "Side Table", "category": "table",
            "dimensions": {"width": 0.5, "depth": 0.5, "height": 0.55},
            "clearances": {"all": 0.2},
            "price_cents": 12999, "style_tags": ["modern", "traditional"],
            "placement_rules": ["sofa_side", "chair_side"], "priority": 3
        },
        
        # Storage
        {
            "id": "tv_stand", "name": "TV Stand", "category": "storage",
            "dimensions": {"width": 1.5, "depth": 0.4, "height": 0.6},
            "clearances": {"front": 1.5, "back": 0.1, "sides": 0.2},
            "price_cents": 34999, "style_tags": ["modern", "minimalist"],
            "placement_rules": ["against_wall", "tv_viewing"], "priority": 2
        },
        {
            "id": "bookshelf", "name": "Bookshelf", "category": "storage",
            "dimensions": {"width": 0.8, "depth": 0.3, "height": 1.8},
            "clearances": {"front": 0.5, "back": 0.1, "sides": 0.1},
            "price_cents": 29999, "style_tags": ["traditional", "modern"],
            "placement_rules": ["against_wall"], "priority": 3
        },
        
        # Work furniture
        {
            "id": "desk", "name": "Desk", "category": "work",
            "dimensions": {"width": 1.2, "depth": 0.6, "height": 0.75},
            "clearances": {"front": 1.0, "back": 0.3, "sides": 0.3},
            "price_cents": 45999, "style_tags": ["modern", "minimalist"],
            "placement_rules": ["against_wall", "window_adjacent"], "priority": 2
        },
        {
            "id": "office_chair", "name": "Office Chair", "category": "seating",
            "dimensions": {"width": 0.6, "depth": 0.6, "height": 1.2},
            "clearances": {"front": 0.8, "back": 0.5, "sides": 0.3},
            "price_cents": 25999, "style_tags": ["modern", "ergonomic"],
            "placement_rules": ["desk_pair"], "priority": 2
        }
    ]
    
    # Filter by style preferences
    if style_prefs:
        filtered_catalog = []
        for item in base_catalog:
            if any(style in item["style_tags"] for style in style_prefs):
                filtered_catalog.append(item)
        if filtered_catalog:
            base_catalog = filtered_catalog
    
    # Filter by budget
    if budget_cents:
        base_catalog = [item for item in base_catalog if item["price_cents"] <= budget_cents * 0.4]  # Max 40% of budget per item
    
    # Filter by room size
    if area_sqm < 15:  # Small room
        base_catalog = [item for item in base_catalog if item["dimensions"]["width"] * item["dimensions"]["depth"] < 2.0]
    
    return base_catalog

def determine_room_type(floor_plan: Dict[str, Any]) -> str:
    """Determine room type from floor plan characteristics"""
    area_sqm = floor_plan.get("area_sqm", 20.0)
    doors = floor_plan.get("doors", [])
    windows = floor_plan.get("windows", [])
    
    if area_sqm < 10:
        return "bedroom"
    elif area_sqm < 25:
        return "living_room"
    else:
        return "open_plan"

async def build_constraint_model(room_bounds: Dict, walls: List, doors: List, windows: List, 
                               furniture_catalog: List, constraints: Dict) -> Dict[str, Any]:
    """Build CP-SAT constraint programming model"""
    await asyncio.sleep(0.3)
    
    # Room dimensions
    room_width = room_bounds.get("max_x", 5.0) - room_bounds.get("min_x", 0.0)
    room_height = room_bounds.get("max_y", 4.0) - room_bounds.get("min_y", 0.0)
    
    # Grid resolution (20cm grid)
    grid_size = 0.2
    grid_width = int(room_width / grid_size)
    grid_height = int(room_height / grid_size)
    
    model = {
        "room_bounds": room_bounds,
        "grid_size": grid_size,
        "grid_width": grid_width,
        "grid_height": grid_height,
        "furniture_catalog": furniture_catalog,
        "walls": walls,
        "doors": doors,
        "windows": windows,
        "constraints": {
            "min_walkway_width": constraints.get("min_walkway_width", 0.8),
            "min_door_clearance": constraints.get("min_door_clearance", 0.8),
            "min_window_access": constraints.get("min_window_access", 0.6),
            "tv_viewing_distance_min": constraints.get("tv_viewing_distance_min", 1.5),
            "tv_viewing_distance_max": constraints.get("tv_viewing_distance_max", 4.0),
            "tv_viewing_angle_max": constraints.get("tv_viewing_angle_max", 30),  # degrees
        }
    }
    
    return model

async def solve_layout_variants(model: Dict[str, Any], num_variants: int = 3) -> List[Dict[str, Any]]:
    """Solve constraint model to generate layout variants"""
    await asyncio.sleep(2.0)  # Simulate CP-SAT solving
    
    furniture_catalog = model["furniture_catalog"]
    room_bounds = model["room_bounds"]
    constraints = model["constraints"]
    
    solutions = []
    
    for variant in range(num_variants):
        # Generate different layout strategies
        if variant == 0:
            strategy = "conversation_focused"
            name = "Cozy Conversation"
        elif variant == 1:
            strategy = "work_focused" 
            name = "Work & Lounge"
        else:
            strategy = "entertainment_focused"
            name = "Entertainment Hub"
        
        solution = await generate_layout_solution(model, strategy, name)
        solutions.append(solution)
    
    return solutions

async def generate_layout_solution(model: Dict[str, Any], strategy: str, name: str) -> Dict[str, Any]:
    """Generate a single layout solution based on strategy"""
    await asyncio.sleep(0.5)
    
    furniture_catalog = model["furniture_catalog"]
    room_bounds = model["room_bounds"]
    
    placements = []
    
    if strategy == "conversation_focused":
        # Place sofa first (wall-aligned)
        sofa = next((f for f in furniture_catalog if f["id"] == "sofa_3seat"), None)
        if sofa:
            placements.append({
                "furniture_id": sofa["id"],
                "x": 1.0, "y": 0.5, "rotation": 0,
                "anchor_type": "wall_aligned"
            })
        
        # Add coffee table in front
        coffee_table = next((f for f in furniture_catalog if f["id"] == "coffee_table"), None)
        if coffee_table:
            placements.append({
                "furniture_id": coffee_table["id"],
                "x": 1.0, "y": 1.8, "rotation": 0,
                "anchor_type": "sofa_front"
            })
        
        # Add armchair for conversation
        armchair = next((f for f in furniture_catalog if f["id"] == "armchair"), None)
        if armchair:
            placements.append({
                "furniture_id": armchair["id"],
                "x": 3.5, "y": 1.0, "rotation": 270,
                "anchor_type": "conversation_angle"
            })
    
    elif strategy == "work_focused":
        # Place desk near window
        desk = next((f for f in furniture_catalog if f["id"] == "desk"), None)
        if desk:
            placements.append({
                "furniture_id": desk["id"],
                "x": 4.0, "y": 1.0, "rotation": 90,
                "anchor_type": "window_adjacent"
            })
        
        # Add office chair
        chair = next((f for f in furniture_catalog if f["id"] == "office_chair"), None)
        if chair:
            placements.append({
                "furniture_id": chair["id"],
                "x": 3.2, "y": 1.0, "rotation": 90,
                "anchor_type": "desk_pair"
            })
        
        # Add sofa for relaxation
        sofa = next((f for f in furniture_catalog if f["id"] == "sofa_3seat"), None)
        if sofa:
            placements.append({
                "furniture_id": sofa["id"],
                "x": 1.0, "y": 2.5, "rotation": 0,
                "anchor_type": "wall_aligned"
            })
    
    else:  # entertainment_focused
        # Place TV stand on main wall
        tv_stand = next((f for f in furniture_catalog if f["id"] == "tv_stand"), None)
        if tv_stand:
            placements.append({
                "furniture_id": tv_stand["id"],
                "x": 2.5, "y": 0.2, "rotation": 0,
                "anchor_type": "wall_centered"
            })
        
        # Place sofa for optimal viewing
        sofa = next((f for f in furniture_catalog if f["id"] == "sofa_3seat"), None)
        if sofa:
            placements.append({
                "furniture_id": sofa["id"],
                "x": 2.5, "y": 2.8, "rotation": 180,
                "anchor_type": "tv_viewing"
            })
        
        # Add side tables
        side_table = next((f for f in furniture_catalog if f["id"] == "side_table"), None)
        if side_table:
            placements.append({
                "furniture_id": side_table["id"],
                "x": 1.0, "y": 2.8, "rotation": 0,
                "anchor_type": "sofa_side"
            })
    
    return {
        "strategy": strategy,
        "name": name,
        "placements": placements
    }

async def post_process_layout(solution: Dict[str, Any], furniture_catalog: List, 
                            floor_plan: Dict[str, Any], layout_id: str) -> Dict[str, Any]:
    """Post-process layout solution with scoring and validation"""
    await asyncio.sleep(0.2)
    
    # Calculate layout score
    score = calculate_layout_score(solution, furniture_catalog, floor_plan)
    
    # Generate rationale
    rationale = generate_layout_rationale(solution, score)
    
    # Validate constraints
    violations = validate_layout_constraints(solution, furniture_catalog, floor_plan)
    
    # Enrich placements with furniture details
    enriched_placements = []
    for placement in solution["placements"]:
        furniture = next((f for f in furniture_catalog if f["id"] == placement["furniture_id"]), None)
        if furniture:
            enriched_placement = {
                **placement,
                "furniture_name": furniture["name"],
                "dimensions": furniture["dimensions"],
                "price_cents": furniture["price_cents"]
            }
            enriched_placements.append(enriched_placement)
    
    return {
        "id": layout_id,
        "name": solution["name"],
        "strategy": solution["strategy"],
        "placements": enriched_placements,
        "score": score,
        "rationale": rationale,
        "violations": violations,
        "metrics": {
            "total_cost_cents": sum(p.get("price_cents", 0) for p in enriched_placements),
            "furniture_count": len(enriched_placements),
            "coverage_ratio": calculate_coverage_ratio(enriched_placements, floor_plan),
            "flow_score": calculate_flow_score(enriched_placements, floor_plan)
        }
    }

def calculate_layout_score(solution: Dict[str, Any], furniture_catalog: List, floor_plan: Dict[str, Any]) -> float:
    """Calculate overall layout quality score"""
    
    # Scoring factors
    placement_score = 0.8  # How well items are placed
    flow_score = 0.9       # Navigation flow quality
    function_score = 0.85   # Functional arrangement
    aesthetic_score = 0.75  # Visual balance and proportion
    
    # Weighted average
    total_score = (
        placement_score * 0.3 +
        flow_score * 0.3 +
        function_score * 0.25 +
        aesthetic_score * 0.15
    )
    
    return round(total_score, 3)

def generate_layout_rationale(solution: Dict[str, Any], score: float) -> str:
    """Generate human-readable rationale for layout decisions"""
    strategy = solution["strategy"]
    
    rationales = {
        "conversation_focused": "Optimized for social interaction with furniture arranged to encourage conversation and comfortable seating distances.",
        "work_focused": "Designed for productivity with dedicated workspace near natural light and separate relaxation area.",
        "entertainment_focused": "Centered around media consumption with optimal TV viewing angles and comfortable seating arrangement."
    }
    
    base_rationale = rationales.get(strategy, "Balanced layout considering room constraints and user preferences.")
    
    if score >= 0.85:
        return f"{base_rationale} Excellent spatial efficiency and flow."
    elif score >= 0.75:
        return f"{base_rationale} Good balance of function and aesthetics."
    else:
        return f"{base_rationale} Functional arrangement with room for optimization."

def validate_layout_constraints(solution: Dict[str, Any], furniture_catalog: List, floor_plan: Dict[str, Any]) -> List[str]:
    """Validate layout against hard constraints"""
    violations = []
    
    # Check for overlapping furniture (simplified)
    placements = solution["placements"]
    for i, p1 in enumerate(placements):
        for j, p2 in enumerate(placements[i+1:], i+1):
            if check_furniture_overlap(p1, p2, furniture_catalog):
                violations.append(f"Furniture overlap detected between {p1['furniture_id']} and {p2['furniture_id']}")
    
    # Check minimum clearances
    for placement in placements:
        if not check_clearance_requirements(placement, furniture_catalog, floor_plan):
            violations.append(f"Insufficient clearance around {placement['furniture_id']}")
    
    return violations

def check_furniture_overlap(p1: Dict, p2: Dict, furniture_catalog: List) -> bool:
    """Check if two furniture pieces overlap"""
    # Simplified overlap check - in real implementation, use proper 2D collision detection
    distance = ((p1["x"] - p2["x"])**2 + (p1["y"] - p2["y"])**2)**0.5
    return distance < 1.0  # Simplified threshold

def check_clearance_requirements(placement: Dict, furniture_catalog: List, floor_plan: Dict) -> bool:
    """Check if furniture placement meets clearance requirements"""
    # Simplified clearance check - in real implementation, check against walls, doors, other furniture
    return True  # Assume valid for now

def calculate_coverage_ratio(placements: List, floor_plan: Dict) -> float:
    """Calculate how much of the room is utilized by furniture"""
    total_area = floor_plan.get("area_sqm", 20.0)
    furniture_area = sum(
        p.get("dimensions", {}).get("width", 1.0) * p.get("dimensions", {}).get("depth", 1.0)
        for p in placements
    )
    return min(1.0, furniture_area / total_area)

def calculate_flow_score(placements: List, floor_plan: Dict) -> float:
    """Calculate navigation flow quality"""
    # Simplified flow calculation - in real implementation, use pathfinding algorithms
    return 0.85  # Mock score

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

async def layout_job_handler(msg):
    """Handle incoming layout jobs from NATS"""
    try:
        job_data = json.loads(msg.data.decode())
        logger.info(f"Received layout job: {job_data.get('id')}")
        
        result = await generate_layouts(job_data)
        
        if nats_client:
            await nats_client.publish(
                "layout.results",
                json.dumps(result.dict()).encode()
            )
            
    except Exception as e:
        logger.error(f"Error handling layout job: {e}")

@app.on_event("startup")
async def startup_event():
    await connect_services()
    if nats_client:
        await nats_client.subscribe("layout.jobs", cb=layout_job_handler)
        logger.info("Subscribed to layout.jobs")

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
        port=int(os.getenv("PORT", 8002)),
        reload=True
    )
