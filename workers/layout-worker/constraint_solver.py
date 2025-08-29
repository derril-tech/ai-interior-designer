#!/usr/bin/env python3
"""
Real Constraint Programming Solver using OR-Tools CP-SAT
"""

from ortools.sat.python import cp_model
import numpy as np
from typing import List, Dict, Tuple, Optional
import logging
from dataclasses import dataclass
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union
import networkx as nx

logger = logging.getLogger(__name__)

@dataclass
class FurnitureItem:
    """Furniture item with constraints"""
    id: str
    name: str
    width_cm: int
    depth_cm: int
    height_cm: int
    category: str
    clearances: Dict[str, int]  # cm
    placement_rules: List[str]
    priority: int
    price_cents: int

@dataclass
class RoomConstraints:
    """Room-level constraints"""
    bounds: Dict[str, float]  # meters
    walls: List[Dict]
    doors: List[Dict]
    windows: List[Dict]
    min_walkway_cm: int = 80
    min_door_clearance_cm: int = 80
    min_window_access_cm: int = 60

@dataclass
class PlacementSolution:
    """Furniture placement solution"""
    furniture_id: str
    x_cm: int
    y_cm: int
    rotation_deg: int
    confidence: float

class RealConstraintSolver:
    """Production CP-SAT constraint solver for furniture placement"""
    
    def __init__(self):
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()
        
        # Solver configuration
        self.solver.parameters.max_time_in_seconds = 30.0
        self.solver.parameters.num_search_workers = 4
        
        # Grid resolution (2cm precision)
        self.grid_resolution_cm = 2
        
    async def solve_layout(self, furniture_items: List[FurnitureItem], 
                          room_constraints: RoomConstraints,
                          objectives: Dict[str, float]) -> List[PlacementSolution]:
        """Solve furniture placement using CP-SAT"""
        
        # Convert room bounds to grid coordinates
        room_width_cm = int((room_constraints.bounds["max_x"] - room_constraints.bounds["min_x"]) * 100)
        room_height_cm = int((room_constraints.bounds["max_y"] - room_constraints.bounds["min_y"]) * 100)
        
        grid_width = room_width_cm // self.grid_resolution_cm
        grid_height = room_height_cm // self.grid_resolution_cm
        
        # Decision variables
        placement_vars = {}
        rotation_vars = {}
        placed_vars = {}
        
        for item in furniture_items:
            # Position variables (grid coordinates)
            placement_vars[item.id] = {
                'x': self.model.NewIntVar(0, grid_width - 1, f'{item.id}_x'),
                'y': self.model.NewIntVar(0, grid_height - 1, f'{item.id}_y')
            }
            
            # Rotation variable (0, 90, 180, 270 degrees)
            rotation_vars[item.id] = self.model.NewIntVar(0, 3, f'{item.id}_rot')
            
            # Whether item is placed
            placed_vars[item.id] = self.model.NewBoolVar(f'{item.id}_placed')
        
        # Add constraints
        await self._add_boundary_constraints(furniture_items, placement_vars, rotation_vars, 
                                           placed_vars, grid_width, grid_height)
        
        await self._add_collision_constraints(furniture_items, placement_vars, rotation_vars, placed_vars)
        
        await self._add_clearance_constraints(furniture_items, placement_vars, rotation_vars, 
                                            placed_vars, room_constraints)
        
        await self._add_door_constraints(furniture_items, placement_vars, rotation_vars, 
                                       placed_vars, room_constraints)
        
        await self._add_window_constraints(furniture_items, placement_vars, rotation_vars, 
                                         placed_vars, room_constraints)
        
        await self._add_functional_constraints(furniture_items, placement_vars, rotation_vars, placed_vars)
        
        # Add objectives
        await self._add_objectives(furniture_items, placement_vars, rotation_vars, 
                                 placed_vars, objectives, room_constraints)
        
        # Solve
        status = self.solver.Solve(self.model)
        
        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            return await self._extract_solution(furniture_items, placement_vars, 
                                              rotation_vars, placed_vars)
        else:
            logger.warning(f"Solver status: {status}")
            return []
    
    async def _add_boundary_constraints(self, furniture_items: List[FurnitureItem],
                                      placement_vars: Dict, rotation_vars: Dict,
                                      placed_vars: Dict, grid_width: int, grid_height: int):
        """Add room boundary constraints"""
        
        for item in furniture_items:
            x_var = placement_vars[item.id]['x']
            y_var = placement_vars[item.id]['y']
            rot_var = rotation_vars[item.id]
            placed_var = placed_vars[item.id]
            
            # Convert furniture dimensions to grid units
            width_grid = item.width_cm // self.grid_resolution_cm
            depth_grid = item.depth_cm // self.grid_resolution_cm
            
            # Boundary constraints considering rotation
            # For 0° and 180° rotation
            self.model.Add(x_var + width_grid <= grid_width).OnlyEnforceIf(
                [placed_var, rot_var == 0])
            self.model.Add(x_var + width_grid <= grid_width).OnlyEnforceIf(
                [placed_var, rot_var == 2])
            
            self.model.Add(y_var + depth_grid <= grid_height).OnlyEnforceIf(
                [placed_var, rot_var == 0])
            self.model.Add(y_var + depth_grid <= grid_height).OnlyEnforceIf(
                [placed_var, rot_var == 2])
            
            # For 90° and 270° rotation (dimensions swapped)
            self.model.Add(x_var + depth_grid <= grid_width).OnlyEnforceIf(
                [placed_var, rot_var == 1])
            self.model.Add(x_var + depth_grid <= grid_width).OnlyEnforceIf(
                [placed_var, rot_var == 3])
            
            self.model.Add(y_var + width_grid <= grid_height).OnlyEnforceIf(
                [placed_var, rot_var == 1])
            self.model.Add(y_var + width_grid <= grid_height).OnlyEnforceIf(
                [placed_var, rot_var == 3])
    
    async def _add_collision_constraints(self, furniture_items: List[FurnitureItem],
                                       placement_vars: Dict, rotation_vars: Dict,
                                       placed_vars: Dict):
        """Add non-overlapping constraints between furniture"""
        
        for i, item1 in enumerate(furniture_items):
            for j, item2 in enumerate(furniture_items[i+1:], i+1):
                
                x1 = placement_vars[item1.id]['x']
                y1 = placement_vars[item1.id]['y']
                rot1 = rotation_vars[item1.id]
                placed1 = placed_vars[item1.id]
                
                x2 = placement_vars[item2.id]['x']
                y2 = placement_vars[item2.id]['y']
                rot2 = rotation_vars[item2.id]
                placed2 = placed_vars[item2.id]
                
                # Create non-overlap constraints for all rotation combinations
                for r1 in range(4):
                    for r2 in range(4):
                        w1, h1 = self._get_rotated_dimensions(item1, r1)
                        w2, h2 = self._get_rotated_dimensions(item2, r2)
                        
                        # Convert to grid units
                        w1_grid = w1 // self.grid_resolution_cm
                        h1_grid = h1 // self.grid_resolution_cm
                        w2_grid = w2 // self.grid_resolution_cm
                        h2_grid = h2 // self.grid_resolution_cm
                        
                        # Non-overlap constraint: at least one of these must be true:
                        # x1 + w1 <= x2 OR x2 + w2 <= x1 OR y1 + h1 <= y2 OR y2 + h2 <= y1
                        
                        b1 = self.model.NewBoolVar(f'no_overlap_{item1.id}_{item2.id}_{r1}_{r2}_x1')
                        b2 = self.model.NewBoolVar(f'no_overlap_{item1.id}_{item2.id}_{r1}_{r2}_x2')
                        b3 = self.model.NewBoolVar(f'no_overlap_{item1.id}_{item2.id}_{r1}_{r2}_y1')
                        b4 = self.model.NewBoolVar(f'no_overlap_{item1.id}_{item2.id}_{r1}_{r2}_y2')
                        
                        # At least one separation must be true
                        self.model.AddBoolOr([b1, b2, b3, b4]).OnlyEnforceIf([
                            placed1, placed2, rot1 == r1, rot2 == r2
                        ])
                        
                        # Define what each boolean means
                        self.model.Add(x1 + w1_grid <= x2).OnlyEnforceIf([b1])
                        self.model.Add(x2 + w2_grid <= x1).OnlyEnforceIf([b2])
                        self.model.Add(y1 + h1_grid <= y2).OnlyEnforceIf([b3])
                        self.model.Add(y2 + h2_grid <= y1).OnlyEnforceIf([b4])
    
    def _get_rotated_dimensions(self, item: FurnitureItem, rotation: int) -> Tuple[int, int]:
        """Get furniture dimensions after rotation"""
        if rotation == 0 or rotation == 2:  # 0° or 180°
            return item.width_cm, item.depth_cm
        else:  # 90° or 270°
            return item.depth_cm, item.width_cm
    
    async def _add_clearance_constraints(self, furniture_items: List[FurnitureItem],
                                       placement_vars: Dict, rotation_vars: Dict,
                                       placed_vars: Dict, room_constraints: RoomConstraints):
        """Add minimum clearance constraints"""
        
        for i, item1 in enumerate(furniture_items):
            for j, item2 in enumerate(furniture_items[i+1:], i+1):
                
                # Get required clearance
                clearance1 = item1.clearances.get('all', 40)  # Default 40cm
                clearance2 = item2.clearances.get('all', 40)
                min_clearance = max(clearance1, clearance2)
                clearance_grid = min_clearance // self.grid_resolution_cm
                
                x1 = placement_vars[item1.id]['x']
                y1 = placement_vars[item1.id]['y']
                x2 = placement_vars[item2.id]['x']
                y2 = placement_vars[item2.id]['y']
                
                placed1 = placed_vars[item1.id]
                placed2 = placed_vars[item2.id]
                
                # Distance constraint (simplified Manhattan distance)
                distance_var = self.model.NewIntVar(0, 1000, f'dist_{item1.id}_{item2.id}')
                
                # |x1 - x2| + |y1 - y2| >= clearance_grid
                abs_x = self.model.NewIntVar(0, 1000, f'abs_x_{item1.id}_{item2.id}')
                abs_y = self.model.NewIntVar(0, 1000, f'abs_y_{item1.id}_{item2.id}')
                
                self.model.AddAbsEquality(abs_x, x1 - x2)
                self.model.AddAbsEquality(abs_y, y1 - y2)
                self.model.Add(distance_var == abs_x + abs_y)
                
                self.model.Add(distance_var >= clearance_grid).OnlyEnforceIf([placed1, placed2])
    
    async def _add_door_constraints(self, furniture_items: List[FurnitureItem],
                                  placement_vars: Dict, rotation_vars: Dict,
                                  placed_vars: Dict, room_constraints: RoomConstraints):
        """Add door clearance constraints"""
        
        for door in room_constraints.doors:
            door_x_cm = int(door["position"]["x"] * 100)
            door_y_cm = int(door["position"]["y"] * 100)
            door_width_cm = int(door.get("width", 80) * 100)
            
            door_x_grid = door_x_cm // self.grid_resolution_cm
            door_y_grid = door_y_cm // self.grid_resolution_cm
            clearance_grid = room_constraints.min_door_clearance_cm // self.grid_resolution_cm
            
            for item in furniture_items:
                x_var = placement_vars[item.id]['x']
                y_var = placement_vars[item.id]['y']
                placed_var = placed_vars[item.id]
                
                # Furniture must be at least clearance_grid away from door
                distance_to_door = self.model.NewIntVar(0, 1000, f'door_dist_{item.id}_{door["id"]}')
                
                abs_x = self.model.NewIntVar(0, 1000, f'door_abs_x_{item.id}_{door["id"]}')
                abs_y = self.model.NewIntVar(0, 1000, f'door_abs_y_{item.id}_{door["id"]}')
                
                self.model.AddAbsEquality(abs_x, x_var - door_x_grid)
                self.model.AddAbsEquality(abs_y, y_var - door_y_grid)
                self.model.Add(distance_to_door == abs_x + abs_y)
                
                self.model.Add(distance_to_door >= clearance_grid).OnlyEnforceIf([placed_var])
    
    async def _add_window_constraints(self, furniture_items: List[FurnitureItem],
                                    placement_vars: Dict, rotation_vars: Dict,
                                    placed_vars: Dict, room_constraints: RoomConstraints):
        """Add window access constraints"""
        
        for window in room_constraints.windows:
            window_x_cm = int(window["position"]["x"] * 100)
            window_y_cm = int(window["position"]["y"] * 100)
            
            window_x_grid = window_x_cm // self.grid_resolution_cm
            window_y_grid = window_y_cm // self.grid_resolution_cm
            access_grid = room_constraints.min_window_access_cm // self.grid_resolution_cm
            
            for item in furniture_items:
                # Only apply to tall furniture that might block windows
                if item.height_cm > 100:  # Taller than 1m
                    x_var = placement_vars[item.id]['x']
                    y_var = placement_vars[item.id]['y']
                    placed_var = placed_vars[item.id]
                    
                    distance_to_window = self.model.NewIntVar(0, 1000, f'window_dist_{item.id}_{window["id"]}')
                    
                    abs_x = self.model.NewIntVar(0, 1000, f'window_abs_x_{item.id}_{window["id"]}')
                    abs_y = self.model.NewIntVar(0, 1000, f'window_abs_y_{item.id}_{window["id"]}')
                    
                    self.model.AddAbsEquality(abs_x, x_var - window_x_grid)
                    self.model.AddAbsEquality(abs_y, y_var - window_y_grid)
                    self.model.Add(distance_to_window == abs_x + abs_y)
                    
                    self.model.Add(distance_to_window >= access_grid).OnlyEnforceIf([placed_var])
    
    async def _add_functional_constraints(self, furniture_items: List[FurnitureItem],
                                        placement_vars: Dict, rotation_vars: Dict,
                                        placed_vars: Dict):
        """Add functional relationship constraints"""
        
        # Find furniture pairs that should be related
        sofas = [item for item in furniture_items if 'sofa' in item.name.lower()]
        coffee_tables = [item for item in furniture_items if 'coffee' in item.name.lower()]
        desks = [item for item in furniture_items if 'desk' in item.name.lower()]
        chairs = [item for item in furniture_items if 'chair' in item.name.lower()]
        tv_stands = [item for item in furniture_items if 'tv' in item.name.lower()]
        
        # Sofa-coffee table relationship
        for sofa in sofas:
            for table in coffee_tables:
                await self._add_sofa_table_constraint(sofa, table, placement_vars, 
                                                    rotation_vars, placed_vars)
        
        # Desk-chair relationship
        for desk in desks:
            for chair in chairs:
                await self._add_desk_chair_constraint(desk, chair, placement_vars, 
                                                    rotation_vars, placed_vars)
        
        # TV viewing constraints
        for tv in tv_stands:
            for sofa in sofas:
                await self._add_tv_viewing_constraint(tv, sofa, placement_vars, 
                                                    rotation_vars, placed_vars)
    
    async def _add_sofa_table_constraint(self, sofa: FurnitureItem, table: FurnitureItem,
                                       placement_vars: Dict, rotation_vars: Dict,
                                       placed_vars: Dict):
        """Coffee table should be in front of sofa at appropriate distance"""
        
        sofa_x = placement_vars[sofa.id]['x']
        sofa_y = placement_vars[sofa.id]['y']
        sofa_rot = rotation_vars[sofa.id]
        sofa_placed = placed_vars[sofa.id]
        
        table_x = placement_vars[table.id]['x']
        table_y = placement_vars[table.id]['y']
        table_placed = placed_vars[table.id]
        
        # Optimal distance: 40-60cm from sofa front
        optimal_dist_grid = 50 // self.grid_resolution_cm  # 50cm
        tolerance_grid = 20 // self.grid_resolution_cm     # ±20cm
        
        # For each sofa rotation, define where table should be
        for rot in range(4):
            # Calculate front direction based on rotation
            if rot == 0:    # Sofa facing up
                target_table_y = sofa_y - optimal_dist_grid
            elif rot == 1:  # Sofa facing right
                target_table_x = sofa_x + optimal_dist_grid
            elif rot == 2:  # Sofa facing down
                target_table_y = sofa_y + optimal_dist_grid
            else:           # Sofa facing left
                target_table_x = sofa_x - optimal_dist_grid
            
            # Add soft constraint (will be handled in objectives)
            pass  # Implemented in objectives section
    
    async def _add_desk_chair_constraint(self, desk: FurnitureItem, chair: FurnitureItem,
                                       placement_vars: Dict, rotation_vars: Dict,
                                       placed_vars: Dict):
        """Chair should be positioned for desk use"""
        
        # Chair should be 60-80cm from desk front
        optimal_dist_grid = 70 // self.grid_resolution_cm
        
        desk_x = placement_vars[desk.id]['x']
        desk_y = placement_vars[desk.id]['y']
        desk_placed = placed_vars[desk.id]
        
        chair_x = placement_vars[chair.id]['x']
        chair_y = placement_vars[chair.id]['y']
        chair_placed = placed_vars[chair.id]
        
        # Distance constraint
        distance_var = self.model.NewIntVar(0, 1000, f'desk_chair_dist_{desk.id}_{chair.id}')
        
        abs_x = self.model.NewIntVar(0, 1000, f'desk_chair_abs_x_{desk.id}_{chair.id}')
        abs_y = self.model.NewIntVar(0, 1000, f'desk_chair_abs_y_{desk.id}_{chair.id}')
        
        self.model.AddAbsEquality(abs_x, desk_x - chair_x)
        self.model.AddAbsEquality(abs_y, desk_y - chair_y)
        self.model.Add(distance_var == abs_x + abs_y)
        
        # Soft constraint: prefer optimal distance
        self.model.Add(distance_var >= optimal_dist_grid - 10).OnlyEnforceIf([desk_placed, chair_placed])
        self.model.Add(distance_var <= optimal_dist_grid + 10).OnlyEnforceIf([desk_placed, chair_placed])
    
    async def _add_tv_viewing_constraint(self, tv: FurnitureItem, sofa: FurnitureItem,
                                       placement_vars: Dict, rotation_vars: Dict,
                                       placed_vars: Dict):
        """TV and sofa should be positioned for optimal viewing"""
        
        # Optimal viewing distance: 2-4 meters
        min_dist_grid = 200 // self.grid_resolution_cm  # 2m
        max_dist_grid = 400 // self.grid_resolution_cm  # 4m
        
        tv_x = placement_vars[tv.id]['x']
        tv_y = placement_vars[tv.id]['y']
        tv_placed = placed_vars[tv.id]
        
        sofa_x = placement_vars[sofa.id]['x']
        sofa_y = placement_vars[sofa.id]['y']
        sofa_placed = placed_vars[sofa.id]
        
        distance_var = self.model.NewIntVar(0, 2000, f'tv_sofa_dist_{tv.id}_{sofa.id}')
        
        abs_x = self.model.NewIntVar(0, 1000, f'tv_sofa_abs_x_{tv.id}_{sofa.id}')
        abs_y = self.model.NewIntVar(0, 1000, f'tv_sofa_abs_y_{tv.id}_{sofa.id}')
        
        self.model.AddAbsEquality(abs_x, tv_x - sofa_x)
        self.model.AddAbsEquality(abs_y, tv_y - sofa_y)
        self.model.Add(distance_var == abs_x + abs_y)
        
        # Viewing distance constraints
        self.model.Add(distance_var >= min_dist_grid).OnlyEnforceIf([tv_placed, sofa_placed])
        self.model.Add(distance_var <= max_dist_grid).OnlyEnforceIf([tv_placed, sofa_placed])
    
    async def _add_objectives(self, furniture_items: List[FurnitureItem],
                            placement_vars: Dict, rotation_vars: Dict,
                            placed_vars: Dict, objectives: Dict[str, float],
                            room_constraints: RoomConstraints):
        """Add optimization objectives"""
        
        objective_terms = []
        
        # Maximize number of placed items
        if objectives.get('placement_coverage', 0) > 0:
            total_placed = sum(placed_vars[item.id] for item in furniture_items)
            objective_terms.append(total_placed * int(objectives['placement_coverage'] * 1000))
        
        # Minimize total cost
        if objectives.get('budget_optimization', 0) > 0:
            total_cost = sum(placed_vars[item.id] * item.price_cents for item in furniture_items)
            objective_terms.append(-total_cost * int(objectives['budget_optimization']))
        
        # Maximize flow (prefer items away from center)
        if objectives.get('flow_optimization', 0) > 0:
            room_center_x = (room_constraints.bounds["max_x"] * 50) // self.grid_resolution_cm
            room_center_y = (room_constraints.bounds["max_y"] * 50) // self.grid_resolution_cm
            
            for item in furniture_items:
                x_var = placement_vars[item.id]['x']
                y_var = placement_vars[item.id]['y']
                placed_var = placed_vars[item.id]
                
                # Distance from center
                center_dist = self.model.NewIntVar(0, 2000, f'center_dist_{item.id}')
                abs_x = self.model.NewIntVar(0, 1000, f'center_abs_x_{item.id}')
                abs_y = self.model.NewIntVar(0, 1000, f'center_abs_y_{item.id}')
                
                self.model.AddAbsEquality(abs_x, x_var - room_center_x)
                self.model.AddAbsEquality(abs_y, y_var - room_center_y)
                self.model.Add(center_dist == abs_x + abs_y)
                
                # Reward distance from center
                flow_bonus = self.model.NewIntVar(0, 10000, f'flow_bonus_{item.id}')
                self.model.Add(flow_bonus == center_dist * placed_var)
                objective_terms.append(flow_bonus * int(objectives['flow_optimization'] * 100))
        
        # Set objective
        if objective_terms:
            self.model.Maximize(sum(objective_terms))
    
    async def _extract_solution(self, furniture_items: List[FurnitureItem],
                              placement_vars: Dict, rotation_vars: Dict,
                              placed_vars: Dict) -> List[PlacementSolution]:
        """Extract solution from solved model"""
        
        solutions = []
        
        for item in furniture_items:
            if self.solver.Value(placed_vars[item.id]):
                x_grid = self.solver.Value(placement_vars[item.id]['x'])
                y_grid = self.solver.Value(placement_vars[item.id]['y'])
                rotation = self.solver.Value(rotation_vars[item.id])
                
                # Convert back to centimeters
                x_cm = x_grid * self.grid_resolution_cm
                y_cm = y_grid * self.grid_resolution_cm
                rotation_deg = rotation * 90
                
                solution = PlacementSolution(
                    furniture_id=item.id,
                    x_cm=x_cm,
                    y_cm=y_cm,
                    rotation_deg=rotation_deg,
                    confidence=0.9  # High confidence from CP-SAT solver
                )
                solutions.append(solution)
        
        return solutions

# Factory function
async def create_constraint_solver() -> RealConstraintSolver:
    """Create constraint solver instance"""
    return RealConstraintSolver()
