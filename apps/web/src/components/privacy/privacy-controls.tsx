'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
    Shield,
    Eye,
    EyeOff,
    Trash2,
    Download,
    Lock,
    Unlock,
    AlertTriangle,
    CheckCircle,
    Camera,
    Image as ImageIcon,
    Server,
    Clock,
    Settings
} from 'lucide-react';

interface PrivacyControlsProps {
    onPrivacyModeChange?: (enabled: boolean) => void;
    onDataDeletion?: () => void;
}

interface PrivacySettings {
    privateMode: boolean;
    faceBlurring: boolean;
    photoFrameBlurring: boolean;
    localProcessing: boolean;
    dataRetention: number; // days
    shareAnalytics: boolean;
    allowCookies: boolean;
}

interface DataSummary {
    scanImages: number;
    processedLayouts: number;
    sharedProjects: number;
    totalStorageMB: number;
    lastActivity: string;
}

export function PrivacyControls({ onPrivacyModeChange, onDataDeletion }: PrivacyControlsProps) {
    const [settings, setSettings] = useState<PrivacySettings>({
        privateMode: false,
        faceBlurring: true,
        photoFrameBlurring: true,
        localProcessing: false,
        dataRetention: 90,
        shareAnalytics: true,
        allowCookies: true
    });

    const [dataSummary, setDataSummary] = useState<DataSummary>({
        scanImages: 12,
        processedLayouts: 8,
        sharedProjects: 3,
        totalStorageMB: 245,
        lastActivity: '2024-01-15T10:30:00Z'
    });

    const [isDeleting, setIsDeleting] = useState(false);
    const [deletionProgress, setDeletionProgress] = useState(0);

    useEffect(() => {
        onPrivacyModeChange?.(settings.privateMode);
    }, [settings.privateMode, onPrivacyModeChange]);

    const updateSetting = <K extends keyof PrivacySettings>(
        key: K,
        value: PrivacySettings[K]
    ) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleDataDeletion = async () => {
        setIsDeleting(true);
        setDeletionProgress(0);

        // Simulate deletion process
        const steps = [
            'Deleting scan images...',
            'Removing layout data...',
            'Clearing shared projects...',
            'Purging analytics data...',
            'Finalizing deletion...'
        ];

        for (let i = 0; i < steps.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            setDeletionProgress((i + 1) / steps.length * 100);
        }

        // Reset data summary
        setDataSummary({
            scanImages: 0,
            processedLayouts: 0,
            sharedProjects: 0,
            totalStorageMB: 0,
            lastActivity: new Date().toISOString()
        });

        setIsDeleting(false);
        onDataDeletion?.();
    };

    const exportData = () => {
        // Mock data export
        const exportData = {
            settings,
            dataSummary,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'ai-interior-designer-data.json';
        link.click();
        URL.revokeObjectURL(url);
    };

    const formatFileSize = (mb: number) => {
        if (mb < 1) return `${Math.round(mb * 1024)} KB`;
        if (mb < 1024) return `${Math.round(mb)} MB`;
        return `${(mb / 1024).toFixed(1)} GB`;
    };

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6">
            {/* Privacy Mode */}
            <Card className={settings.privateMode ? 'border-green-200 bg-green-50 dark:bg-green-950' : ''}>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                {settings.privateMode ? <Lock className="h-5 w-5 text-green-600" /> : <Unlock className="h-5 w-5" />}
                                Private Mode
                            </CardTitle>
                            <CardDescription>
                                Enhanced privacy with on-device processing and no data persistence
                            </CardDescription>
                        </div>
                        <Switch
                            checked={settings.privateMode}
                            onCheckedChange={(checked) => updateSetting('privateMode', checked)}
                        />
                    </div>
                </CardHeader>

                {settings.privateMode && (
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                                <CheckCircle className="h-4 w-4" />
                                <span>All processing happens on your device</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                                <CheckCircle className="h-4 w-4" />
                                <span>No raw images are stored on our servers</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                                <CheckCircle className="h-4 w-4" />
                                <span>Automatic face and photo blurring enabled</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                                <CheckCircle className="h-4 w-4" />
                                <span>Session data cleared after 24 hours</span>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Image Privacy Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Camera className="h-5 w-5" />
                        Image Privacy
                    </CardTitle>
                    <CardDescription>
                        Control how personal information in images is handled
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium">Face Blurring</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Automatically blur faces detected in room scans
                            </p>
                        </div>
                        <Switch
                            checked={settings.faceBlurring}
                            onCheckedChange={(checked) => updateSetting('faceBlurring', checked)}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium">Photo Frame Blurring</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Blur personal photos and artwork in frames
                            </p>
                        </div>
                        <Switch
                            checked={settings.photoFrameBlurring}
                            onCheckedChange={(checked) => updateSetting('photoFrameBlurring', checked)}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium">Local Processing</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Process images on your device when possible
                            </p>
                        </div>
                        <Switch
                            checked={settings.localProcessing}
                            onCheckedChange={(checked) => updateSetting('localProcessing', checked)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Data Management */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Server className="h-5 w-5" />
                        Data Management
                    </CardTitle>
                    <CardDescription>
                        View and manage your stored data
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Data Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">{dataSummary.scanImages}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Scan Images</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{dataSummary.processedLayouts}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Layouts</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="text-2xl font-bold text-purple-600">{dataSummary.sharedProjects}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Shared</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="text-2xl font-bold text-orange-600">{formatFileSize(dataSummary.totalStorageMB)}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Storage</div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Last activity:</span>
                        <span className="font-medium">{formatDate(dataSummary.lastActivity)}</span>
                    </div>

                    {/* Data Actions */}
                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" onClick={exportData} className="flex-1">
                            <Download className="mr-2 h-4 w-4" />
                            Export Data
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDataDeletion}
                            disabled={isDeleting}
                            className="flex-1"
                        >
                            {isDeleting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete All Data
                                </>
                            )}
                        </Button>
                    </div>

                    {isDeleting && (
                        <div className="space-y-2">
                            <Progress value={deletionProgress} className="h-2" />
                            <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                                Permanently deleting your data... {Math.round(deletionProgress)}%
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Analytics & Cookies */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Analytics & Preferences
                    </CardTitle>
                    <CardDescription>
                        Control data sharing and tracking preferences
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium">Share Analytics</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Help improve our service with anonymous usage data
                            </p>
                        </div>
                        <Switch
                            checked={settings.shareAnalytics}
                            onCheckedChange={(checked) => updateSetting('shareAnalytics', checked)}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium">Allow Cookies</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Enable cookies for better user experience
                            </p>
                        </div>
                        <Switch
                            checked={settings.allowCookies}
                            onCheckedChange={(checked) => updateSetting('allowCookies', checked)}
                        />
                    </div>

                    <div>
                        <h4 className="font-medium mb-2">Data Retention</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            Automatically delete data after: {settings.dataRetention} days
                        </p>
                        <div className="flex gap-2">
                            {[30, 90, 180, 365].map((days) => (
                                <Button
                                    key={days}
                                    variant={settings.dataRetention === days ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => updateSetting('dataRetention', days)}
                                >
                                    {days}d
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Privacy Notice */}
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                                Your Privacy Matters
                            </h4>
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                We're committed to protecting your privacy. All personal data is processed securely,
                                and you have full control over your information. Read our{' '}
                                <a href="/privacy" className="underline hover:no-underline">Privacy Policy</a>{' '}
                                for more details.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
