'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
    FileText,
    Download,
    Share2,
    Mail,
    Printer,
    ArrowLeft,
    CheckCircle,
    AlertTriangle,
    Package,
    DollarSign,
    Ruler,
    Calendar,
    ExternalLink
} from 'lucide-react';

interface ExportWizardProps {
    layout: Layout;
    roomData: RoomData;
    onBack?: () => void;
}

interface Layout {
    id: string;
    name: string;
    placements: Placement[];
    score: number;
    metrics: {
        total_cost_cents: number;
        furniture_count: number;
    };
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
    price_cents: number;
}

interface RoomData {
    id: string;
    name: string;
    area_sqm: number;
    floor_plan: any;
}

type ExportType = 'pdf' | 'bom' | 'both';
type ExportStatus = 'setup' | 'generating' | 'complete' | 'error';

interface ExportOptions {
    includeFloorPlan: boolean;
    includeDimensions: boolean;
    includeProductDetails: boolean;
    includePricing: boolean;
    includeVendorLinks: boolean;
    includeAssemblyNotes: boolean;
    format: 'detailed' | 'summary';
}

export function ExportWizard({ layout, roomData, onBack }: ExportWizardProps) {
    const [exportType, setExportType] = useState<ExportType>('both');
    const [exportStatus, setExportStatus] = useState<ExportStatus>('setup');
    const [exportProgress, setExportProgress] = useState(0);
    const [exportUrls, setExportUrls] = useState<{ pdf?: string; bom?: string }>({});
    const [options, setOptions] = useState<ExportOptions>({
        includeFloorPlan: true,
        includeDimensions: true,
        includeProductDetails: true,
        includePricing: true,
        includeVendorLinks: true,
        includeAssemblyNotes: false,
        format: 'detailed'
    });

    const generateExports = async () => {
        setExportStatus('generating');
        setExportProgress(0);

        try {
            // Simulate export generation
            const progressInterval = setInterval(() => {
                setExportProgress(prev => {
                    if (prev >= 95) {
                        clearInterval(progressInterval);
                        return 95;
                    }
                    return prev + Math.random() * 20;
                });
            }, 300);

            // Mock API calls
            await new Promise(resolve => setTimeout(resolve, 2500));

            clearInterval(progressInterval);
            setExportProgress(100);

            // Mock export URLs
            const urls: { pdf?: string; bom?: string } = {};

            if (exportType === 'pdf' || exportType === 'both') {
                urls.pdf = `/api/exports/layouts/${layout.id}/layout.pdf`;
            }

            if (exportType === 'bom' || exportType === 'both') {
                urls.bom = `/api/exports/layouts/${layout.id}/bom.csv`;
            }

            setExportUrls(urls);
            setExportStatus('complete');

        } catch (error) {
            console.error('Export generation failed:', error);
            setExportStatus('error');
        }
    };

    const downloadFile = (url: string, filename: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
    };

    const formatPrice = (cents: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(cents / 100);
    };

    const getTotalCost = () => {
        return layout.placements.reduce((sum, item) => sum + item.price_cents, 0);
    };

    if (exportStatus === 'error') {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
                <div className="max-w-2xl mx-auto">
                    <Button variant="ghost" onClick={onBack} className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Layout
                    </Button>

                    <Card>
                        <CardHeader className="text-center">
                            <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                            <CardTitle>Export Failed</CardTitle>
                            <CardDescription>
                                Unable to generate exports. Please try again or contact support.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => setExportStatus('setup')} className="w-full">
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
                    Back to Layout
                </Button>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Export Configuration */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Export Layout - {layout.name}
                                </CardTitle>
                                <CardDescription>
                                    Generate professional documents for your interior design layout
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-6">
                                {exportStatus === 'setup' && (
                                    <>
                                        {/* Export Type Selection */}
                                        <div>
                                            <h3 className="font-medium mb-3">Export Type</h3>
                                            <div className="grid grid-cols-3 gap-3">
                                                <Card
                                                    className={`cursor-pointer transition-all ${exportType === 'pdf' ? 'ring-2 ring-blue-500' : ''}`}
                                                    onClick={() => setExportType('pdf')}
                                                >
                                                    <CardContent className="p-4 text-center">
                                                        <FileText className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                                                        <h4 className="font-medium">Layout PDF</h4>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                                            Floor plan with dimensions
                                                        </p>
                                                    </CardContent>
                                                </Card>

                                                <Card
                                                    className={`cursor-pointer transition-all ${exportType === 'bom' ? 'ring-2 ring-blue-500' : ''}`}
                                                    onClick={() => setExportType('bom')}
                                                >
                                                    <CardContent className="p-4 text-center">
                                                        <Package className="h-8 w-8 mx-auto mb-2 text-green-600" />
                                                        <h4 className="font-medium">BOM Export</h4>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                                            Shopping list CSV/JSON
                                                        </p>
                                                    </CardContent>
                                                </Card>

                                                <Card
                                                    className={`cursor-pointer transition-all ${exportType === 'both' ? 'ring-2 ring-blue-500' : ''}`}
                                                    onClick={() => setExportType('both')}
                                                >
                                                    <CardContent className="p-4 text-center">
                                                        <Download className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                                                        <h4 className="font-medium">Complete Set</h4>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                                            PDF + BOM bundle
                                                        </p>
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        </div>

                                        {/* Export Options */}
                                        <div>
                                            <h3 className="font-medium mb-3">Export Options</h3>
                                            <div className="space-y-3">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id="floorplan"
                                                        checked={options.includeFloorPlan}
                                                        onCheckedChange={(checked) =>
                                                            setOptions(prev => ({ ...prev, includeFloorPlan: !!checked }))
                                                        }
                                                    />
                                                    <label htmlFor="floorplan" className="text-sm font-medium">
                                                        Include floor plan diagram
                                                    </label>
                                                </div>

                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id="dimensions"
                                                        checked={options.includeDimensions}
                                                        onCheckedChange={(checked) =>
                                                            setOptions(prev => ({ ...prev, includeDimensions: !!checked }))
                                                        }
                                                    />
                                                    <label htmlFor="dimensions" className="text-sm font-medium">
                                                        Include furniture dimensions
                                                    </label>
                                                </div>

                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id="details"
                                                        checked={options.includeProductDetails}
                                                        onCheckedChange={(checked) =>
                                                            setOptions(prev => ({ ...prev, includeProductDetails: !!checked }))
                                                        }
                                                    />
                                                    <label htmlFor="details" className="text-sm font-medium">
                                                        Include product details
                                                    </label>
                                                </div>

                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id="pricing"
                                                        checked={options.includePricing}
                                                        onCheckedChange={(checked) =>
                                                            setOptions(prev => ({ ...prev, includePricing: !!checked }))
                                                        }
                                                    />
                                                    <label htmlFor="pricing" className="text-sm font-medium">
                                                        Include pricing information
                                                    </label>
                                                </div>

                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id="links"
                                                        checked={options.includeVendorLinks}
                                                        onCheckedChange={(checked) =>
                                                            setOptions(prev => ({ ...prev, includeVendorLinks: !!checked }))
                                                        }
                                                    />
                                                    <label htmlFor="links" className="text-sm font-medium">
                                                        Include vendor purchase links
                                                    </label>
                                                </div>

                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id="assembly"
                                                        checked={options.includeAssemblyNotes}
                                                        onCheckedChange={(checked) =>
                                                            setOptions(prev => ({ ...prev, includeAssemblyNotes: !!checked }))
                                                        }
                                                    />
                                                    <label htmlFor="assembly" className="text-sm font-medium">
                                                        Include assembly notes
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Format Selection */}
                                        <div>
                                            <h3 className="font-medium mb-3">Detail Level</h3>
                                            <div className="flex gap-3">
                                                <Button
                                                    variant={options.format === 'summary' ? 'default' : 'outline'}
                                                    onClick={() => setOptions(prev => ({ ...prev, format: 'summary' }))}
                                                >
                                                    Summary
                                                </Button>
                                                <Button
                                                    variant={options.format === 'detailed' ? 'default' : 'outline'}
                                                    onClick={() => setOptions(prev => ({ ...prev, format: 'detailed' }))}
                                                >
                                                    Detailed
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Generate Button */}
                                        <div className="pt-4">
                                            <Button onClick={generateExports} className="w-full" size="lg">
                                                <Download className="mr-2 h-4 w-4" />
                                                Generate Exports
                                            </Button>
                                        </div>
                                    </>
                                )}

                                {exportStatus === 'generating' && (
                                    <div className="space-y-6 text-center">
                                        <div>
                                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                            <h3 className="text-lg font-semibold">Generating Exports</h3>
                                            <p className="text-gray-600 dark:text-gray-400">
                                                Creating your professional layout documents...
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Progress value={exportProgress} className="h-2" />
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                {exportProgress < 30 ? 'Processing layout data...' :
                                                    exportProgress < 60 ? 'Generating floor plan...' :
                                                        exportProgress < 90 ? 'Creating product list...' :
                                                            'Finalizing documents...'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {exportStatus === 'complete' && (
                                    <div className="space-y-6">
                                        <div className="text-center">
                                            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                                            <h3 className="text-lg font-semibold">Exports Ready</h3>
                                            <p className="text-gray-600 dark:text-gray-400">
                                                Your documents have been generated successfully
                                            </p>
                                        </div>

                                        {/* Download Links */}
                                        <div className="space-y-3">
                                            {exportUrls.pdf && (
                                                <Card>
                                                    <CardContent className="p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <FileText className="h-8 w-8 text-blue-600" />
                                                                <div>
                                                                    <h4 className="font-medium">Layout PDF</h4>
                                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                                        Floor plan with dimensions and furniture placement
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                onClick={() => downloadFile(exportUrls.pdf!, `${layout.name}_layout.pdf`)}
                                                            >
                                                                <Download className="mr-2 h-4 w-4" />
                                                                Download
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {exportUrls.bom && (
                                                <Card>
                                                    <CardContent className="p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <Package className="h-8 w-8 text-green-600" />
                                                                <div>
                                                                    <h4 className="font-medium">Bill of Materials</h4>
                                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                                        Complete shopping list with prices and links
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="outline"
                                                                onClick={() => downloadFile(exportUrls.bom!, `${layout.name}_bom.csv`)}
                                                            >
                                                                <Download className="mr-2 h-4 w-4" />
                                                                Download
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </div>

                                        {/* Additional Actions */}
                                        <div className="flex gap-3">
                                            <Button variant="outline" className="flex-1">
                                                <Mail className="mr-2 h-4 w-4" />
                                                Email
                                            </Button>
                                            <Button variant="outline" className="flex-1">
                                                <Share2 className="mr-2 h-4 w-4" />
                                                Share
                                            </Button>
                                            <Button variant="outline" className="flex-1">
                                                <Printer className="mr-2 h-4 w-4" />
                                                Print
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Layout Summary */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Export Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <h4 className="font-medium mb-2">Layout Details</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-400">Name:</span>
                                            <span className="font-medium">{layout.name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-400">Room:</span>
                                            <span className="font-medium">{roomData.name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-400">Area:</span>
                                            <span className="font-medium">{roomData.area_sqm.toFixed(1)} m²</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-400">Score:</span>
                                            <Badge variant="secondary">{Math.round(layout.score * 100)}%</Badge>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium mb-2">Furniture Summary</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Package className="h-4 w-4 text-gray-400" />
                                                <span>Items:</span>
                                            </div>
                                            <span className="font-medium">{layout.placements.length}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <DollarSign className="h-4 w-4 text-gray-400" />
                                                <span>Total Cost:</span>
                                            </div>
                                            <span className="font-medium">{formatPrice(getTotalCost())}</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium mb-2">Furniture List</h4>
                                    <div className="space-y-2">
                                        {layout.placements.map((item, index) => (
                                            <div key={index} className="flex items-center justify-between text-sm">
                                                <span className="text-gray-600 dark:text-gray-400 truncate">
                                                    {item.furniture_name}
                                                </span>
                                                <span className="font-medium">
                                                    {formatPrice(item.price_cents)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium mb-2">Export Options</h4>
                                    <div className="space-y-1 text-sm">
                                        {options.includeFloorPlan && (
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="h-3 w-3 text-green-500" />
                                                <span>Floor plan diagram</span>
                                            </div>
                                        )}
                                        {options.includeDimensions && (
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="h-3 w-3 text-green-500" />
                                                <span>Furniture dimensions</span>
                                            </div>
                                        )}
                                        {options.includePricing && (
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="h-3 w-3 text-green-500" />
                                                <span>Pricing information</span>
                                            </div>
                                        )}
                                        {options.includeVendorLinks && (
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="h-3 w-3 text-green-500" />
                                                <span>Purchase links</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Need Help?</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Having trouble with exports? Check our help resources:
                                </p>
                                <div className="space-y-2">
                                    <Button variant="ghost" size="sm" className="w-full justify-start">
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        Export Guide
                                    </Button>
                                    <Button variant="ghost" size="sm" className="w-full justify-start">
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        Contact Support
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
