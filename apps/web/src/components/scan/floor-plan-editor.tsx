'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Move,
    RotateCw,
    Trash2,
    Plus,
    Ruler,
    Grid,
    Eye,
    EyeOff,
    Save,
    Undo,
    Redo,
    Settings
} from 'lucide-react';

interface FloorPlanEditorProps {
    floorPlan: any;
    onSave: (updatedPlan: any) => void;
    onBack?: () => void;
}

interface Wall {
    id: string;
    start: { x: number; y: number };
    end: { x: number; y: number };
    height: number;
    thickness: number;
}

interface Door {
    id: string;
    wall_id: string;
    position: { x: number; y: number };
    width: number;
    height: number;
    swing_direction: string;
}

interface Window {
    id: string;
    wall_id: string;
    position: { x: number; y: number };
    width: number;
    height: number;
    sill_height: number;
}

type Tool = 'select' | 'wall' | 'door' | 'window' | 'measure';
type Unit = 'metric' | 'imperial';

export function FloorPlanEditor({ floorPlan, onSave, onBack }: FloorPlanEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [activeTool, setActiveTool] = useState<Tool>('select');
    const [selectedElement, setSelectedElement] = useState<string | null>(null);
    const [unit, setUnit] = useState<Unit>('metric');
    const [showGrid, setShowGrid] = useState(true);
    const [showMeasurements, setShowMeasurements] = useState(true);
    const [scale, setScale] = useState(50); // pixels per meter
    const [offset, setOffset] = useState({ x: 50, y: 50 });

    // Floor plan data
    const [walls, setWalls] = useState<Wall[]>(floorPlan?.walls || []);
    const [doors, setDoors] = useState<Door[]>(floorPlan?.doors || []);
    const [windows, setWindows] = useState<Window[]>(floorPlan?.windows || []);

    // History for undo/redo
    const [history, setHistory] = useState<any[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Canvas drawing
    const drawFloorPlan = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        if (showGrid) {
            drawGrid(ctx, canvas.width, canvas.height);
        }

        // Draw walls
        walls.forEach(wall => drawWall(ctx, wall));

        // Draw doors
        doors.forEach(door => drawDoor(ctx, door));

        // Draw windows
        windows.forEach(window => drawWindow(ctx, window));

        // Draw measurements
        if (showMeasurements) {
            walls.forEach(wall => drawWallMeasurement(ctx, wall));
        }

        // Highlight selected element
        if (selectedElement) {
            highlightElement(ctx, selectedElement);
        }
    }, [walls, doors, windows, selectedElement, showGrid, showMeasurements, scale, offset]);

    const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;

        const gridSize = scale; // 1 meter grid

        // Vertical lines
        for (let x = offset.x % gridSize; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = offset.y % gridSize; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    };

    const drawWall = (ctx: CanvasRenderingContext2D, wall: Wall) => {
        const startX = wall.start.x * scale + offset.x;
        const startY = wall.start.y * scale + offset.y;
        const endX = wall.end.x * scale + offset.x;
        const endY = wall.end.y * scale + offset.y;

        ctx.strokeStyle = selectedElement === wall.id ? '#3b82f6' : '#374151';
        ctx.lineWidth = wall.thickness * scale;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    };

    const drawDoor = (ctx: CanvasRenderingContext2D, door: Door) => {
        const wall = walls.find(w => w.id === door.wall_id);
        if (!wall) return;

        const doorX = door.position.x * scale + offset.x;
        const doorY = door.position.y * scale + offset.y;
        const doorWidth = door.width * scale;

        // Draw door opening (gap in wall)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = wall.thickness * scale + 2;
        ctx.lineCap = 'round';

        // Calculate door position along wall
        const wallAngle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
        const doorStartX = doorX - Math.cos(wallAngle) * doorWidth / 2;
        const doorStartY = doorY - Math.sin(wallAngle) * doorWidth / 2;
        const doorEndX = doorX + Math.cos(wallAngle) * doorWidth / 2;
        const doorEndY = doorY + Math.sin(wallAngle) * doorWidth / 2;

        ctx.beginPath();
        ctx.moveTo(doorStartX, doorStartY);
        ctx.lineTo(doorEndX, doorEndY);
        ctx.stroke();

        // Draw door swing arc
        ctx.strokeStyle = selectedElement === door.id ? '#3b82f6' : '#6b7280';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        const swingRadius = doorWidth;
        const swingStartAngle = wallAngle + (door.swing_direction === 'inward' ? Math.PI / 2 : -Math.PI / 2);
        const swingEndAngle = swingStartAngle + Math.PI / 2;

        ctx.beginPath();
        ctx.arc(doorStartX, doorStartY, swingRadius, swingStartAngle, swingEndAngle);
        ctx.stroke();
        ctx.setLineDash([]);
    };

    const drawWindow = (ctx: CanvasRenderingContext2D, window: Window) => {
        const wall = walls.find(w => w.id === window.wall_id);
        if (!wall) return;

        const windowX = window.position.x * scale + offset.x;
        const windowY = window.position.y * scale + offset.y;
        const windowWidth = window.width * scale;

        // Draw window opening
        ctx.strokeStyle = selectedElement === window.id ? '#3b82f6' : '#06b6d4';
        ctx.lineWidth = wall.thickness * scale;
        ctx.lineCap = 'round';

        const wallAngle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
        const windowStartX = windowX - Math.cos(wallAngle) * windowWidth / 2;
        const windowStartY = windowY - Math.sin(wallAngle) * windowWidth / 2;
        const windowEndX = windowX + Math.cos(wallAngle) * windowWidth / 2;
        const windowEndY = windowY + Math.sin(wallAngle) * windowWidth / 2;

        ctx.beginPath();
        ctx.moveTo(windowStartX, windowStartY);
        ctx.lineTo(windowEndX, windowEndY);
        ctx.stroke();

        // Draw window sill lines
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1;

        const sillOffset = 3;
        ctx.beginPath();
        ctx.moveTo(windowStartX - sillOffset, windowStartY - sillOffset);
        ctx.lineTo(windowEndX - sillOffset, windowEndY - sillOffset);
        ctx.moveTo(windowStartX + sillOffset, windowStartY + sillOffset);
        ctx.lineTo(windowEndX + sillOffset, windowEndY + sillOffset);
        ctx.stroke();
    };

    const drawWallMeasurement = (ctx: CanvasRenderingContext2D, wall: Wall) => {
        const startX = wall.start.x * scale + offset.x;
        const startY = wall.start.y * scale + offset.y;
        const endX = wall.end.x * scale + offset.x;
        const endY = wall.end.y * scale + offset.y;

        const length = Math.sqrt(
            Math.pow(wall.end.x - wall.start.x, 2) +
            Math.pow(wall.end.y - wall.start.y, 2)
        );

        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        // Format measurement based on unit
        const measurement = unit === 'metric'
            ? `${length.toFixed(2)}m`
            : `${(length * 3.28084).toFixed(1)}'`;

        ctx.fillStyle = '#374151';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(measurement, midX, midY - 10);
    };

    const highlightElement = (ctx: CanvasRenderingContext2D, elementId: string) => {
        // Add highlight effect for selected element
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 10;
        // Redraw the selected element with highlight
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    };

    // Event handlers
    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left - offset.x) / scale;
        const y = (event.clientY - rect.top - offset.y) / scale;

        // Find clicked element
        const clickedWall = walls.find(wall => isPointOnWall(x, y, wall));
        const clickedDoor = doors.find(door => isPointOnDoor(x, y, door));
        const clickedWindow = windows.find(window => isPointOnWindow(x, y, window));

        if (clickedWall) {
            setSelectedElement(clickedWall.id);
        } else if (clickedDoor) {
            setSelectedElement(clickedDoor.id);
        } else if (clickedWindow) {
            setSelectedElement(clickedWindow.id);
        } else {
            setSelectedElement(null);
        }
    };

    const isPointOnWall = (x: number, y: number, wall: Wall): boolean => {
        // Simple distance check to wall line
        const distance = distanceToLineSegment(
            x, y,
            wall.start.x, wall.start.y,
            wall.end.x, wall.end.y
        );
        return distance < wall.thickness / 2 + 0.1; // 10cm tolerance
    };

    const isPointOnDoor = (x: number, y: number, door: Door): boolean => {
        const distance = Math.sqrt(
            Math.pow(x - door.position.x, 2) +
            Math.pow(y - door.position.y, 2)
        );
        return distance < door.width / 2;
    };

    const isPointOnWindow = (x: number, y: number, window: Window): boolean => {
        const distance = Math.sqrt(
            Math.pow(x - window.position.x, 2) +
            Math.pow(y - window.position.y, 2)
        );
        return distance < window.width / 2;
    };

    const distanceToLineSegment = (
        px: number, py: number,
        x1: number, y1: number,
        x2: number, y2: number
    ): number => {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;

        if (lenSq === 0) return Math.sqrt(A * A + B * B);

        let param = dot / lenSq;

        if (param < 0) {
            return Math.sqrt(A * A + B * B);
        } else if (param > 1) {
            const E = px - x2;
            const F = py - y2;
            return Math.sqrt(E * E + F * F);
        } else {
            const projX = x1 + param * C;
            const projY = y1 + param * D;
            const G = px - projX;
            const H = py - projY;
            return Math.sqrt(G * G + H * H);
        }
    };

    const handleSave = () => {
        const updatedPlan = {
            ...floorPlan,
            walls,
            doors,
            windows,
            area_sqm: calculateArea(),
            bounds: calculateBounds()
        };
        onSave(updatedPlan);
    };

    const calculateArea = (): number => {
        // Simple polygon area calculation
        if (walls.length < 3) return 0;

        // For now, return the original area or calculate from bounds
        const bounds = calculateBounds();
        return (bounds.max_x - bounds.min_x) * (bounds.max_y - bounds.min_y);
    };

    const calculateBounds = () => {
        if (walls.length === 0) return { min_x: 0, max_x: 0, min_y: 0, max_y: 0 };

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        walls.forEach(wall => {
            minX = Math.min(minX, wall.start.x, wall.end.x);
            maxX = Math.max(maxX, wall.start.x, wall.end.x);
            minY = Math.min(minY, wall.start.y, wall.end.y);
            maxY = Math.max(maxY, wall.start.y, wall.end.y);
        });

        return { min_x: minX, max_x: maxX, min_y: minY, max_y: maxY };
    };

    // Redraw canvas when data changes
    useEffect(() => {
        drawFloorPlan();
    }, [drawFloorPlan]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Floor Plan Editor
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Edit walls, doors, and windows. Measurements are in {unit === 'metric' ? 'meters' : 'feet'}.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setUnit(unit === 'metric' ? 'imperial' : 'metric')}>
                            {unit === 'metric' ? 'Switch to Feet' : 'Switch to Meters'}
                        </Button>
                        <Button onClick={handleSave}>
                            <Save className="mr-2 h-4 w-4" />
                            Save Changes
                        </Button>
                    </div>
                </div>

                <div className="grid lg:grid-cols-4 gap-6">
                    {/* Toolbar */}
                    <div className="lg:col-span-1 space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Tools</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Button
                                    variant={activeTool === 'select' ? 'default' : 'outline'}
                                    className="w-full justify-start"
                                    onClick={() => setActiveTool('select')}
                                >
                                    <Move className="mr-2 h-4 w-4" />
                                    Select
                                </Button>
                                <Button
                                    variant={activeTool === 'wall' ? 'default' : 'outline'}
                                    className="w-full justify-start"
                                    onClick={() => setActiveTool('wall')}
                                >
                                    <Grid className="mr-2 h-4 w-4" />
                                    Wall
                                </Button>
                                <Button
                                    variant={activeTool === 'door' ? 'default' : 'outline'}
                                    className="w-full justify-start"
                                    onClick={() => setActiveTool('door')}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Door
                                </Button>
                                <Button
                                    variant={activeTool === 'window' ? 'default' : 'outline'}
                                    className="w-full justify-start"
                                    onClick={() => setActiveTool('window')}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Window
                                </Button>
                                <Button
                                    variant={activeTool === 'measure' ? 'default' : 'outline'}
                                    className="w-full justify-start"
                                    onClick={() => setActiveTool('measure')}
                                >
                                    <Ruler className="mr-2 h-4 w-4" />
                                    Measure
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">View Options</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => setShowGrid(!showGrid)}
                                >
                                    {showGrid ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                                    Grid
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => setShowMeasurements(!showMeasurements)}
                                >
                                    {showMeasurements ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                                    Measurements
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Element Properties */}
                        {selectedElement && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Properties</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Badge variant="secondary">{selectedElement}</Badge>
                                    <div className="mt-4 space-y-2">
                                        <Button variant="outline" size="sm" className="w-full">
                                            <RotateCw className="mr-2 h-4 w-4" />
                                            Rotate
                                        </Button>
                                        <Button variant="destructive" size="sm" className="w-full">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Canvas */}
                    <div className="lg:col-span-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span>Floor Plan</span>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm">
                                            <Undo className="h-4 w-4" />
                                        </Button>
                                        <Button variant="outline" size="sm">
                                            <Redo className="h-4 w-4" />
                                        </Button>
                                        <Button variant="outline" size="sm">
                                            <Settings className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="border rounded-lg overflow-hidden">
                                    <canvas
                                        ref={canvasRef}
                                        width={800}
                                        height={600}
                                        className="cursor-crosshair"
                                        onClick={handleCanvasClick}
                                    />
                                </div>
                                <div className="mt-4 flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                    <span>Area: {calculateArea().toFixed(1)} m²</span>
                                    <span>Scale: 1:{Math.round(100 / scale)}</span>
                                    <span>Elements: {walls.length} walls, {doors.length} doors, {windows.length} windows</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
