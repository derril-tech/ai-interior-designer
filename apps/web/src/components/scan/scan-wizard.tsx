'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
    Camera,
    ArrowLeft,
    Play,
    Pause,
    Square,
    CheckCircle,
    AlertTriangle,
    Upload,
    RotateCcw,
    Smartphone
} from 'lucide-react';

interface ScanWizardProps {
    mode: 'mobile' | 'web';
    onBack: () => void;
}

type ScanState = 'setup' | 'scanning' | 'processing' | 'complete' | 'error';

interface ScanMetrics {
    framesCapture: number;
    coverage: number;
    quality: number;
    duration: number;
}

export function ScanWizard({ mode, onBack }: ScanWizardProps) {
    const [scanState, setScanState] = useState<ScanState>('setup');
    const [isRecording, setIsRecording] = useState(false);
    const [metrics, setMetrics] = useState<ScanMetrics>({
        framesCapture: 0,
        coverage: 0,
        quality: 0,
        duration: 0
    });
    const [processingProgress, setProcessingProgress] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize camera
    useEffect(() => {
        if (mode === 'web' && scanState === 'setup') {
            initializeCamera();
        }
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [mode, scanState]);

    const initializeCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'environment' // Prefer back camera on mobile
                },
                audio: false
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            setScanState('error');
        }
    };

    const startScanning = useCallback(() => {
        setIsRecording(true);
        setScanState('scanning');

        // Simulate scan metrics updates
        intervalRef.current = setInterval(() => {
            setMetrics(prev => ({
                framesCapture: Math.min(prev.framesCapture + Math.random() * 10, 100),
                coverage: Math.min(prev.coverage + Math.random() * 2, 100),
                quality: Math.min(prev.quality + Math.random() * 1.5, 100),
                duration: prev.duration + 1
            }));
        }, 1000);
    }, []);

    const stopScanning = useCallback(() => {
        setIsRecording(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        // Start processing
        setScanState('processing');

        // Simulate processing progress
        let progress = 0;
        const processingInterval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 100) {
                progress = 100;
                clearInterval(processingInterval);
                setScanState('complete');
            }
            setProcessingProgress(progress);
        }, 500);
    }, []);

    const resetScan = () => {
        setMetrics({ framesCapture: 0, coverage: 0, quality: 0, duration: 0 });
        setProcessingProgress(0);
        setScanState('setup');
        setIsRecording(false);
    };

    const getQualityColor = (quality: number) => {
        if (quality >= 80) return 'bg-green-500';
        if (quality >= 60) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const getQualityLabel = (quality: number) => {
        if (quality >= 80) return 'Excellent';
        if (quality >= 60) return 'Good';
        if (quality >= 40) return 'Fair';
        return 'Poor';
    };

    if (scanState === 'error') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
                <div className="max-w-2xl mx-auto">
                    <Button variant="ghost" onClick={onBack} className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>

                    <Card>
                        <CardHeader className="text-center">
                            <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                            <CardTitle>Camera Access Error</CardTitle>
                            <CardDescription>
                                Unable to access your camera. Please check permissions and try again.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={resetScan} className="w-full">
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
                    Back
                </Button>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Camera View */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Camera className="h-5 w-5" />
                                    {mode === 'mobile' ? 'Mobile Camera' : 'Web Camera'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                                    {mode === 'web' ? (
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-white">
                                            <div className="text-center">
                                                <Smartphone className="mx-auto h-16 w-16 mb-4 opacity-50" />
                                                <p>Open this page on your mobile device</p>
                                                <p className="text-sm opacity-75 mt-2">
                                                    Scan QR code or visit: {window.location.href}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Recording indicator */}
                                    {isRecording && (
                                        <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full">
                                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                            <span className="text-sm font-medium">Recording</span>
                                        </div>
                                    )}

                                    {/* Quality indicator */}
                                    {scanState === 'scanning' && (
                                        <div className="absolute top-4 right-4">
                                            <Badge variant="secondary" className={`${getQualityColor(metrics.quality)} text-white`}>
                                                {getQualityLabel(metrics.quality)}
                                            </Badge>
                                        </div>
                                    )}
                                </div>

                                {/* Controls */}
                                <div className="flex justify-center gap-4 mt-6">
                                    {scanState === 'setup' && (
                                        <Button onClick={startScanning} size="lg" className="px-8">
                                            <Play className="mr-2 h-4 w-4" />
                                            Start Scanning
                                        </Button>
                                    )}

                                    {scanState === 'scanning' && (
                                        <>
                                            <Button onClick={() => setIsRecording(!isRecording)} variant="outline">
                                                {isRecording ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                            </Button>
                                            <Button onClick={stopScanning} variant="destructive">
                                                <Square className="mr-2 h-4 w-4" />
                                                Finish Scan
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Metrics Panel */}
                    <div className="space-y-6">
                        {/* Scan Metrics */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Scan Quality</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span>Room Coverage</span>
                                        <span>{Math.round(metrics.coverage)}%</span>
                                    </div>
                                    <Progress value={metrics.coverage} className="h-2" />
                                </div>

                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span>Frames Captured</span>
                                        <span>{Math.round(metrics.framesCapture)}</span>
                                    </div>
                                    <Progress value={metrics.framesCapture} className="h-2" />
                                </div>

                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span>Overall Quality</span>
                                        <span>{Math.round(metrics.quality)}%</span>
                                    </div>
                                    <Progress value={metrics.quality} className="h-2" />
                                </div>

                                <div className="pt-2 border-t">
                                    <div className="flex justify-between text-sm">
                                        <span>Duration</span>
                                        <span>{Math.floor(metrics.duration / 60)}:{(metrics.duration % 60).toString().padStart(2, '0')}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Processing Status */}
                        {scanState === 'processing' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Processing Scan</CardTitle>
                                    <CardDescription>
                                        Generating 3D mesh and floor plan...
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Progress value={processingProgress} className="mb-2" />
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {Math.round(processingProgress)}% complete
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Success State */}
                        {scanState === 'complete' && (
                            <Card>
                                <CardHeader className="text-center">
                                    <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-2" />
                                    <CardTitle className="text-lg">Scan Complete!</CardTitle>
                                    <CardDescription>
                                        Your room has been successfully scanned and processed.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Button className="w-full mb-2">
                                        <Upload className="mr-2 h-4 w-4" />
                                        View Floor Plan
                                    </Button>
                                    <Button variant="outline" onClick={resetScan} className="w-full">
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        Scan Another Room
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {/* Tips */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Scanning Tips</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm space-y-2">
                                <p>• Move slowly and steadily around the room</p>
                                <p>• Keep the camera pointed at walls and furniture</p>
                                <p>• Ensure good lighting throughout</p>
                                <p>• Capture all corners and doorways</p>
                                <p>• Avoid reflective surfaces when possible</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
