'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    Eye,
    Download,
    Share2,
    Smartphone,
    Monitor,
    Cube,
    ArrowLeft,
    CheckCircle,
    AlertTriangle,
    RotateCcw,
    Maximize2,
    Settings
} from 'lucide-react';

interface ARViewerProps {
    layout: Layout;
    roomData: RoomData;
    onBack?: () => void;
    onExport?: (format: 'usdz' | 'gltf') => void;
}

interface Layout {
    id: string;
    name: string;
    placements: Placement[];
    score: number;
}

interface Placement {
    furniture_id: string;
    furniture_name: string;
    x: number;
    y: number;
    rotation: number;
    dimensions: {
        width: number;
        depth: number;
        height: number;
    };
}

interface RoomData {
    id: string;
    mesh_url?: string;
    floor_plan: {
        bounds: {
            min_x: number;
            max_x: number;
            min_y: number;
            max_y: number;
        };
        walls: any[];
        doors: any[];
        windows: any[];
    };
}

type ARMode = 'setup' | 'calibration' | 'viewing' | 'error';
type ViewerType = 'ios' | 'android' | 'webxr' | 'fallback';

export function ARViewer({ layout, roomData, onBack, onExport }: ARViewerProps) {
    const [arMode, setArMode] = useState<ARMode>('setup');
    const [viewerType, setViewerType] = useState<ViewerType>('fallback');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);
    const [arAssetUrl, setArAssetUrl] = useState<string | null>(null);
    const [calibrationStep, setCalibrationStep] = useState(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        detectARCapabilities();
    }, []);

    const detectARCapabilities = () => {
        const userAgent = navigator.userAgent;

        if (/iPhone|iPad/.test(userAgent)) {
            setViewerType('ios');
        } else if (/Android/.test(userAgent)) {
            setViewerType('android');
        } else if ('xr' in navigator) {
            // Check for WebXR support
            navigator.xr?.isSessionSupported('immersive-ar').then((supported) => {
                if (supported) {
                    setViewerType('webxr');
                } else {
                    setViewerType('fallback');
                }
            }).catch(() => {
                setViewerType('fallback');
            });
        } else {
            setViewerType('fallback');
        }
    };

    const generateARAsset = async () => {
        setIsGenerating(true);
        setGenerationProgress(0);

        try {
            // Simulate AR asset generation
            const progressInterval = setInterval(() => {
                setGenerationProgress(prev => {
                    if (prev >= 95) {
                        clearInterval(progressInterval);
                        return 95;
                    }
                    return prev + Math.random() * 15;
                });
            }, 200);

            // Mock API call to render-worker
            await new Promise(resolve => setTimeout(resolve, 3000));

            clearInterval(progressInterval);
            setGenerationProgress(100);

            // Mock AR asset URL
            const assetUrl = viewerType === 'ios'
                ? `/api/ar/layouts/${layout.id}/model.usdz`
                : `/api/ar/layouts/${layout.id}/model.gltf`;

            setArAssetUrl(assetUrl);
            setArMode('calibration');

        } catch (error) {
            console.error('Error generating AR asset:', error);
            setArMode('error');
        } finally {
            setIsGenerating(false);
        }
    };

    const startCalibration = () => {
        setCalibrationStep(1);
        // Initialize AR calibration process
    };

    const completeCalibration = () => {
        setArMode('viewing');
    };

    const launchARViewer = () => {
        if (viewerType === 'ios' && arAssetUrl) {
            // Launch USDZ Quick Look
            const link = document.createElement('a');
            link.href = arAssetUrl;
            link.rel = 'ar';
            link.click();
        } else if (viewerType === 'webxr') {
            // Launch WebXR session
            startWebXRSession();
        } else {
            // Fallback 3D viewer
            setArMode('viewing');
        }
    };

    const startWebXRSession = async () => {
        try {
            if ('xr' in navigator && navigator.xr) {
                const session = await navigator.xr.requestSession('immersive-ar');
                // Initialize WebXR AR session
                console.log('WebXR AR session started');
            }
        } catch (error) {
            console.error('WebXR not supported:', error);
            setViewerType('fallback');
        }
    };

    const getViewerInstructions = () => {
        switch (viewerType) {
            case 'ios':
                return "Tap 'View in AR' to open in USDZ Quick Look. Point your camera at a flat surface to place furniture.";
            case 'android':
                return "Use Scene Viewer to place furniture in your space. Point your camera at the floor to begin.";
            case 'webxr':
                return "Your browser supports WebXR. Grant camera permissions to view furniture in your space.";
            default:
                return "View a 3D preview of your layout. AR viewing requires a mobile device with AR support.";
        }
    };

    if (arMode === 'error') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
                <div className="max-w-2xl mx-auto">
                    <Button variant="ghost" onClick={onBack} className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Layouts
                    </Button>

                    <Card>
                        <CardHeader className="text-center">
                            <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                            <CardTitle>AR Generation Failed</CardTitle>
                            <CardDescription>
                                Unable to generate AR assets. Please try again or contact support.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => setArMode('setup')} className="w-full">
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Try Again
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
            <div className="max-w-4xl mx-auto">
                <Button variant="ghost" onClick={onBack} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Layouts
                </Button>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* AR Viewer */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Eye className="h-5 w-5" />
                                            AR Preview - {layout.name}
                                        </CardTitle>
                                        <CardDescription>
                                            {getViewerInstructions()}
                                        </CardDescription>
                                    </div>
                                    <Badge variant="secondary">
                                        {viewerType === 'ios' ? 'iOS AR' :
                                            viewerType === 'android' ? 'Android AR' :
                                                viewerType === 'webxr' ? 'WebXR' : '3D Preview'}
                                    </Badge>
                                </div>
                            </CardHeader>

                            <CardContent>
                                {arMode === 'setup' && (
                                    <div className="space-y-6">
                                        {/* Device Compatibility */}
                                        <div className="text-center">
                                            <div className="mx-auto mb-4 p-4 bg-blue-100 dark:bg-blue-900 rounded-full w-fit">
                                                {viewerType === 'ios' || viewerType === 'android' ? (
                                                    <Smartphone className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                                                ) : (
                                                    <Monitor className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                                                )}
                                            </div>
                                            <h3 className="text-lg font-semibold mb-2">
                                                {viewerType === 'fallback' ? '3D Preview Ready' : 'AR Ready'}
                                            </h3>
                                            <p className="text-gray-600 dark:text-gray-400">
                                                {viewerType === 'fallback'
                                                    ? 'View your layout in 3D or use a mobile device for AR'
                                                    : 'Your device supports AR viewing'}
                                            </p>
                                        </div>

                                        {/* Generation Button */}
                                        <div className="text-center">
                                            <Button
                                                onClick={generateARAsset}
                                                disabled={isGenerating}
                                                size="lg"
                                                className="px-8"
                                            >
                                                {isGenerating ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                        Generating AR Assets...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Cube className="mr-2 h-4 w-4" />
                                                        Generate AR View
                                                    </>
                                                )}
                                            </Button>
                                        </div>

                                        {/* Progress */}
                                        {isGenerating && (
                                            <div className="space-y-2">
                                                <Progress value={generationProgress} className="h-2" />
                                                <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                                                    {generationProgress < 30 ? 'Converting furniture models...' :
                                                        generationProgress < 60 ? 'Optimizing for AR...' :
                                                            generationProgress < 90 ? 'Generating textures...' :
                                                                'Finalizing AR assets...'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {arMode === 'calibration' && (
                                    <div className="space-y-6">
                                        <div className="text-center">
                                            <div className="mx-auto mb-4 p-4 bg-green-100 dark:bg-green-900 rounded-full w-fit">
                                                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                                            </div>
                                            <h3 className="text-lg font-semibold mb-2">AR Assets Ready</h3>
                                            <p className="text-gray-600 dark:text-gray-400">
                                                Calibrate your space for accurate furniture placement
                                            </p>
                                        </div>

                                        {/* Calibration Steps */}
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${calibrationStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                                                    }`}>
                                                    1
                                                </div>
                                                <div>
                                                    <h4 className="font-medium">Find a flat surface</h4>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        Point your camera at the floor or a table
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${calibrationStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                                                    }`}>
                                                    2
                                                </div>
                                                <div>
                                                    <h4 className="font-medium">Scale calibration</h4>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        Place a 1m reference cube to set scale
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${calibrationStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                                                    }`}>
                                                    3
                                                </div>
                                                <div>
                                                    <h4 className="font-medium">Place furniture</h4>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        Tap to place each furniture item
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-3">
                                            <Button variant="outline" onClick={() => setArMode('setup')} className="flex-1">
                                                Back
                                            </Button>
                                            <Button onClick={launchARViewer} className="flex-1">
                                                <Eye className="mr-2 h-4 w-4" />
                                                Launch AR Viewer
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {arMode === 'viewing' && (
                                    <div className="space-y-6">
                                        {/* 3D Viewer Canvas */}
                                        <div className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                                            <canvas
                                                ref={canvasRef}
                                                width={600}
                                                height={400}
                                                className="w-full h-64 md:h-80"
                                            />
                                            <div className="absolute top-4 right-4 flex gap-2">
                                                <Button size="sm" variant="secondary">
                                                    <RotateCcw className="h-4 w-4" />
                                                </Button>
                                                <Button size="sm" variant="secondary">
                                                    <Maximize2 className="h-4 w-4" />
                                                </Button>
                                                <Button size="sm" variant="secondary">
                                                    <Settings className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* AR Actions */}
                                        <div className="flex gap-3">
                                            {viewerType !== 'fallback' && (
                                                <Button onClick={launchARViewer} className="flex-1">
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    View in AR
                                                </Button>
                                            )}
                                            <Button variant="outline" onClick={() => onExport?.('usdz')} className="flex-1">
                                                <Download className="mr-2 h-4 w-4" />
                                                Download
                                            </Button>
                                            <Button variant="outline" className="flex-1">
                                                <Share2 className="mr-2 h-4 w-4" />
                                                Share
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Layout Info */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Layout Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <h4 className="font-medium mb-2">{layout.name}</h4>
                                    <Badge variant="secondary">Score: {Math.round(layout.score * 100)}%</Badge>
                                </div>

                                <div>
                                    <h4 className="font-medium mb-2">Furniture ({layout.placements.length} items)</h4>
                                    <div className="space-y-2">
                                        {layout.placements.map((placement, index) => (
                                            <div key={index} className="flex items-center justify-between text-sm">
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    {placement.furniture_name}
                                                </span>
                                                <span className="font-medium">
                                                    {placement.dimensions.width}×{placement.dimensions.depth}cm
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium mb-2">AR Features</h4>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="h-3 w-3 text-green-500" />
                                            <span>True-to-scale placement</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="h-3 w-3 text-green-500" />
                                            <span>Realistic materials</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="h-3 w-3 text-green-500" />
                                            <span>Room occlusion</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="h-3 w-3 text-green-500" />
                                            <span>Interactive placement</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Export Options</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => onExport?.('usdz')}
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    USDZ (iOS AR)
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => onExport?.('gltf')}
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    glTF (Android/Web)
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                >
                                    <Share2 className="mr-2 h-4 w-4" />
                                    Share AR Link
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
