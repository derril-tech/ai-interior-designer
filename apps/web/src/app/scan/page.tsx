'use client';

import { useState } from 'react';
import { ScanWizard } from '@/components/scan/scan-wizard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Smartphone, Monitor } from 'lucide-react';

export default function ScanPage() {
    const [scanMode, setScanMode] = useState<'select' | 'mobile' | 'web'>('select');

    if (scanMode === 'mobile' || scanMode === 'web') {
        return <ScanWizard mode={scanMode} onBack={() => setScanMode('select')} />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
            <div className="container mx-auto px-4 py-16">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                        Scan Your Room
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                        Choose how you'd like to capture your room. For best results, use your phone's camera
                        to walk around and scan the entire space.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {/* Mobile Scanning */}
                    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setScanMode('mobile')}>
                        <CardHeader className="text-center">
                            <div className="mx-auto mb-4 p-4 bg-blue-100 dark:bg-blue-900 rounded-full w-fit">
                                <Smartphone className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                            </div>
                            <CardTitle className="text-xl">Mobile Scanning</CardTitle>
                            <CardDescription>
                                Use your phone's camera and sensors for the most accurate 3D capture
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span>ARKit/ARCore depth sensing</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span>Real-time quality feedback</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span>Highest accuracy (±1.5%)</span>
                                </div>
                            </div>
                            <Button className="w-full mt-6">
                                <Camera className="mr-2 h-4 w-4" />
                                Start Mobile Scan
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Web Scanning */}
                    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setScanMode('web')}>
                        <CardHeader className="text-center">
                            <div className="mx-auto mb-4 p-4 bg-purple-100 dark:bg-purple-900 rounded-full w-fit">
                                <Monitor className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                            </div>
                            <CardTitle className="text-xl">Web Scanning</CardTitle>
                            <CardDescription>
                                Use your computer's webcam or upload photos for basic room capture
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                    <span>WebXR or photo upload</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                    <span>Manual measurement input</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                    <span>Good for testing (±5%)</span>
                                </div>
                            </div>
                            <Button variant="outline" className="w-full mt-6">
                                <Camera className="mr-2 h-4 w-4" />
                                Start Web Scan
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="text-center mt-12">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Scanning typically takes 2-5 minutes. Make sure you have good lighting and
                        walk slowly around the entire room for best results.
                    </p>
                </div>
            </div>
        </div>
    );
}
