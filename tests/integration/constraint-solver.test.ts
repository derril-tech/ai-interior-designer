import { describe, test, expect, beforeAll } from '@jest/test';
import { RealConstraintSolver, FurnitureItem, RoomConstraints, PlacementSolution } from '../../workers/layout-worker/constraint_solver';

describe('Constraint Solver Integration Tests', () => {
    let solver: RealConstraintSolver;
    let testFurniture: FurnitureItem[];
    let testRoom: RoomConstraints;

    beforeAll(async () => {
        solver = await RealConstraintSolver();

        // Test furniture items
        testFurniture = [
            {
                id: 'sofa_001',
                name: 'Test Sofa',
                width_cm: 200,
                depth_cm: 90,
                height_cm: 80,
                category: 'seating',
                clearances: { all: 60 },
                placement_rules: ['against_wall'],
                priority: 1,
                price_cents: 79900
            },
            {
                id: 'table_001',
                name: 'Coffee Table',
                width_cm: 120,
                depth_cm: 60,
                height_cm: 45,
                category: 'tables',
                clearances: { all: 40 },
                placement_rules: ['sofa_front'],
                priority: 2,
                price_cents: 24999
            },
            {
                id: 'chair_001',
                name: 'Armchair',
                width_cm: 80,
                depth_cm: 85,
                height_cm: 90,
                category: 'seating',
                clearances: { all: 50 },
                placement_rules: ['corner'],
                priority: 2,
                price_cents: 39900
            }
        ];

        // Test room constraints
        testRoom = {
            bounds: { min_x: 0, max_x: 5, min_y: 0, max_y: 4 },
            walls: [
                { id: 'wall_1', start: { x: 0, y: 0 }, end: { x: 5, y: 0 } },
                { id: 'wall_2', start: { x: 5, y: 0 }, end: { x: 5, y: 4 } },
                { id: 'wall_3', start: { x: 5, y: 4 }, end: { x: 0, y: 4 } },
                { id: 'wall_4', start: { x: 0, y: 4 }, end: { x: 0, y: 0 } }
            ],
            doors: [
                { id: 'door_1', position: { x: 2.5, y: 0 }, width: 0.8 }
            ],
            windows: [
                { id: 'window_1', position: { x: 5, y: 2 }, width: 1.2 }
            ],
            min_walkway_cm: 80,
            min_door_clearance_cm: 80,
            min_window_access_cm: 60
        };
    });

    describe('Basic Solving', () => {
        test('should solve simple furniture placement', async () => {
            const objectives = {
                placement_coverage: 1.0,
                budget_optimization: 0.0,
                flow_optimization: 0.5
            };

            const solutions = await solver.solve_layout(
                testFurniture,
                testRoom,
                objectives
            );

            expect(solutions).toBeInstanceOf(Array);
            expect(solutions.length).toBeGreaterThan(0);
            expect(solutions.length).toBeLessThanOrEqual(testFurniture.length);
        });

        test('should respect room boundaries', async () => {
            const objectives = { placement_coverage: 1.0 };

            const solutions = await solver.solve_layout(
                testFurniture,
                testRoom,
                objectives
            );

            solutions.forEach(solution => {
                // Check that furniture stays within room bounds
                expect(solution.x_cm).toBeGreaterThanOrEqual(0);
                expect(solution.y_cm).toBeGreaterThanOrEqual(0);
                expect(solution.x_cm).toBeLessThan(testRoom.bounds.max_x * 100);
                expect(solution.y_cm).toBeLessThan(testRoom.bounds.max_y * 100);
            });
        });

        test('should avoid furniture collisions', async () => {
            const objectives = { placement_coverage: 1.0 };

            const solutions = await solver.solve_layout(
                testFurniture,
                testRoom,
                objectives
            );

            // Check that no two furniture pieces overlap
            for (let i = 0; i < solutions.length; i++) {
                for (let j = i + 1; j < solutions.length; j++) {
                    const item1 = solutions[i];
                    const item2 = solutions[j];

                    const furniture1 = testFurniture.find(f => f.id === item1.furniture_id)!;
                    const furniture2 = testFurniture.find(f => f.id === item2.furniture_id)!;

                    // Calculate bounding boxes
                    const box1 = {
                        x1: item1.x_cm,
                        y1: item1.y_cm,
                        x2: item1.x_cm + furniture1.width_cm,
                        y2: item1.y_cm + furniture1.depth_cm
                    };

                    const box2 = {
                        x1: item2.x_cm,
                        y1: item2.y_cm,
                        x2: item2.x_cm + furniture2.width_cm,
                        y2: item2.y_cm + furniture2.depth_cm
                    };

                    // Check for overlap
                    const noOverlap = box1.x2 <= box2.x1 || box2.x2 <= box1.x1 ||
                        box1.y2 <= box2.y1 || box2.y2 <= box1.y1;

                    expect(noOverlap).toBe(true);
                }
            }
        });
    });

    describe('Constraint Compliance', () => {
        test('should maintain door clearances', async () => {
            const objectives = { placement_coverage: 1.0 };

            const solutions = await solver.solve_layout(
                testFurniture,
                testRoom,
                objectives
            );

            solutions.forEach(solution => {
                testRoom.doors.forEach(door => {
                    const doorX = door.position.x * 100; // Convert to cm
                    const doorY = door.position.y * 100;

                    const distance = Math.sqrt(
                        Math.pow(solution.x_cm - doorX, 2) +
                        Math.pow(solution.y_cm - doorY, 2)
                    );

                    expect(distance).toBeGreaterThanOrEqual(testRoom.min_door_clearance_cm);
                });
            });
        });

        test('should maintain window access', async () => {
            const objectives = { placement_coverage: 1.0 };

            const solutions = await solver.solve_layout(
                testFurniture,
                testRoom,
                objectives
            );

            solutions.forEach(solution => {
                const furniture = testFurniture.find(f => f.id === solution.furniture_id)!;

                // Only check tall furniture
                if (furniture.height_cm > 100) {
                    testRoom.windows.forEach(window => {
                        const windowX = window.position.x * 100;
                        const windowY = window.position.y * 100;

                        const distance = Math.sqrt(
                            Math.pow(solution.x_cm - windowX, 2) +
                            Math.pow(solution.y_cm - windowY, 2)
                        );

                        expect(distance).toBeGreaterThanOrEqual(testRoom.min_window_access_cm);
                    });
                }
            });
        });
    });

    describe('Optimization Objectives', () => {
        test('should optimize for budget when requested', async () => {
            const budgetObjectives = {
                placement_coverage: 0.5,
                budget_optimization: 1.0,
                flow_optimization: 0.0
            };

            const coverageObjectives = {
                placement_coverage: 1.0,
                budget_optimization: 0.0,
                flow_optimization: 0.0
            };

            const budgetSolutions = await solver.solve_layout(
                testFurniture,
                testRoom,
                budgetObjectives
            );

            const coverageSolutions = await solver.solve_layout(
                testFurniture,
                testRoom,
                coverageObjectives
            );

            // Budget-optimized should have lower total cost
            const budgetCost = budgetSolutions.reduce((sum, sol) => {
                const furniture = testFurniture.find(f => f.id === sol.furniture_id)!;
                return sum + furniture.price_cents;
            }, 0);

            const coverageCost = coverageSolutions.reduce((sum, sol) => {
                const furniture = testFurniture.find(f => f.id === sol.furniture_id)!;
                return sum + furniture.price_cents;
            }, 0);

            expect(budgetCost).toBeLessThanOrEqual(coverageCost);
        });

        test('should optimize for coverage when requested', async () => {
            const objectives = {
                placement_coverage: 1.0,
                budget_optimization: 0.0,
                flow_optimization: 0.0
            };

            const solutions = await solver.solve_layout(
                testFurniture,
                testRoom,
                objectives
            );

            // Should try to place as many items as possible
            expect(solutions.length).toBeGreaterThan(0);
        });
    });

    describe('Performance', () => {
        test('should solve within time limit', async () => {
            const startTime = Date.now();

            const objectives = { placement_coverage: 1.0 };
            await solver.solve_layout(testFurniture, testRoom, objectives);

            const solvingTime = Date.now() - startTime;

            // Should solve in under 30 seconds (solver timeout)
            expect(solvingTime).toBeLessThan(30000);
        });

        test('should handle large furniture sets', async () => {
            // Create larger furniture set
            const largeFurnitureSet: FurnitureItem[] = [];
            for (let i = 0; i < 20; i++) {
                largeFurnitureSet.push({
                    id: `item_${i}`,
                    name: `Test Item ${i}`,
                    width_cm: 50 + (i % 5) * 20,
                    depth_cm: 40 + (i % 3) * 15,
                    height_cm: 60 + (i % 4) * 20,
                    category: ['seating', 'tables', 'storage'][i % 3],
                    clearances: { all: 40 },
                    placement_rules: ['against_wall'],
                    priority: (i % 3) + 1,
                    price_cents: 10000 + i * 5000
                });
            }

            const objectives = { placement_coverage: 1.0 };

            const startTime = Date.now();
            const solutions = await solver.solve_layout(
                largeFurnitureSet,
                testRoom,
                objectives
            );
            const solvingTime = Date.now() - startTime;

            expect(solutions).toBeInstanceOf(Array);
            expect(solvingTime).toBeLessThan(30000); // Still within time limit
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty furniture list', async () => {
            const objectives = { placement_coverage: 1.0 };

            const solutions = await solver.solve_layout([], testRoom, objectives);

            expect(solutions).toEqual([]);
        });

        test('should handle oversized furniture', async () => {
            const oversizedFurniture: FurnitureItem[] = [{
                id: 'huge_sofa',
                name: 'Huge Sofa',
                width_cm: 600, // 6 meters - too big for room
                depth_cm: 500,
                height_cm: 100,
                category: 'seating',
                clearances: { all: 50 },
                placement_rules: [],
                priority: 1,
                price_cents: 100000
            }];

            const objectives = { placement_coverage: 1.0 };

            const solutions = await solver.solve_layout(
                oversizedFurniture,
                testRoom,
                objectives
            );

            // Should not place oversized furniture
            expect(solutions).toEqual([]);
        });

        test('should handle very small room', async () => {
            const tinyRoom: RoomConstraints = {
                bounds: { min_x: 0, max_x: 1.5, min_y: 0, max_y: 1.5 }, // 1.5m x 1.5m
                walls: [],
                doors: [],
                windows: [],
                min_walkway_cm: 80,
                min_door_clearance_cm: 80,
                min_window_access_cm: 60
            };

            const objectives = { placement_coverage: 1.0 };

            const solutions = await solver.solve_layout(
                testFurniture,
                tinyRoom,
                objectives
            );

            // May place some small items or none at all
            expect(solutions).toBeInstanceOf(Array);
        });
    });
});
