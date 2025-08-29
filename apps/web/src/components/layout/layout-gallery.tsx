'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    Star,
    DollarSign,
    Users,
    Tv,
    Briefcase,
    Eye,
    ArrowRight,
    CheckCircle,
    AlertTriangle,
    Info,
    Maximize2,
    RotateCw
} from 'lucide-react';

interface LayoutGalleryProps {
    layouts: Layout[];
    onSelectLayout: (layout: Layout) => void;
    onViewAR?: (layout: Layout) => void;
    loading?: boolean;
}

interface Layout {
    id: string;
    name: string;
    strategy: string;
    score: number;
    rationale: string;
    placements: Placement[];
    violations: string[];
    metrics: {
        total_cost_cents: number;
        furniture_count: number;
        coverage_ratio: number;
        flow_score: number;
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

export function LayoutGallery({ layouts, onSelectLayout, onViewAR, loading = false }: LayoutGalleryProps) {
    const [selectedLayout, setSelectedLayout] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'detailed'>('grid');

    const getStrategyIcon = (strategy: string) => {
        switch (strategy) {
            case 'conversation_focused':
                return <Users className="h-4 w-4" />;
            case 'work_focused':
                return <Briefcase className="h-4 w-4" />;
            case 'entertainment_focused':
                return <Tv className="h-4 w-4" />;
            default:
                return <Star className="h-4 w-4" />;
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 0.85) return 'text-green-600 bg-green-100';
        if (score >= 0.75) return 'text-yellow-600 bg-yellow-100';
        return 'text-red-600 bg-red-100';
    };

    const formatPrice = (cents: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(cents / 100);
    };

    const handleLayoutSelect = (layout: Layout) => {
        setSelectedLayout(layout.id);
        onSelectLayout(layout);
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <h3 className="text-lg font-semibold">Generating Layouts</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                        Our AI is creating optimized furniture arrangements for your room...
                    </p>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <CardHeader>
                                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-32 bg-gray-200 rounded mb-4"></div>
                                <div className="space-y-2">
                                    <div className="h-3 bg-gray-200 rounded"></div>
                                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (!layouts || layouts.length === 0) {
        return (
            <Card>
                <CardContent className="text-center py-12">
                    <AlertTriangle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        No Layouts Generated
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                        We couldn't generate any layouts for this room. Please check the room scan and try again.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Layout Options
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        Choose from {layouts.length} AI-generated layout{layouts.length !== 1 ? 's' : ''} optimized for your space
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={viewMode === 'grid' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('grid')}
                    >
                        Grid View
                    </Button>
                    <Button
                        variant={viewMode === 'detailed' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('detailed')}
                    >
                        Detailed View
                    </Button>
                </div>
            </div>

            {/* Layout Grid */}
            <div className={`grid gap-6 ${viewMode === 'grid' ? 'md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                {layouts.map((layout) => (
                    <Card
                        key={layout.id}
                        className={`cursor-pointer transition-all hover:shadow-lg ${selectedLayout === layout.id ? 'ring-2 ring-blue-500 shadow-lg' : ''
                            }`}
                        onClick={() => handleLayoutSelect(layout)}
                    >
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    {getStrategyIcon(layout.strategy)}
                                    <CardTitle className="text-lg">{layout.name}</CardTitle>
                                </div>
                                <Badge className={`${getScoreColor(layout.score)} border-0`}>
                                    {Math.round(layout.score * 100)}%
                                </Badge>
                            </div>
                            <CardDescription className="text-sm">
                                {layout.rationale}
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {/* Layout Preview */}
                            <div className="relative bg-gray-50 dark:bg-gray-800 rounded-lg p-4 h-32">
                                <LayoutPreview layout={layout} />
                                <div className="absolute top-2 right-2">
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                        <Maximize2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>

                            {/* Metrics */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                        <DollarSign className="h-3 w-3" />
                                        <span>Total Cost</span>
                                    </div>
                                    <div className="font-semibold">
                                        {formatPrice(layout.metrics.total_cost_cents)}
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                        <Star className="h-3 w-3" />
                                        <span>Flow Score</span>
                                    </div>
                                    <div className="font-semibold">
                                        {Math.round(layout.metrics.flow_score * 100)}%
                                    </div>
                                </div>
                            </div>

                            {/* Furniture Count */}
                            <div>
                                <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="text-gray-600 dark:text-gray-400">
                                        {layout.metrics.furniture_count} pieces
                                    </span>
                                    <span className="text-gray-600 dark:text-gray-400">
                                        {Math.round(layout.metrics.coverage_ratio * 100)}% coverage
                                    </span>
                                </div>
                                <Progress value={layout.metrics.coverage_ratio * 100} className="h-1" />
                            </div>

                            {/* Violations */}
                            {layout.violations && layout.violations.length > 0 && (
                                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>{layout.violations.length} issue{layout.violations.length !== 1 ? 's' : ''}</span>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 pt-2">
                                <Button
                                    className="flex-1"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleLayoutSelect(layout);
                                    }}
                                >
                                    <CheckCircle className="mr-2 h-3 w-3" />
                                    Select Layout
                                </Button>
                                {onViewAR && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onViewAR(layout);
                                        }}
                                    >
                                        <Eye className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>

                            {/* Detailed View Additional Info */}
                            {viewMode === 'detailed' && (
                                <div className="border-t pt-4 space-y-3">
                                    {/* Furniture List */}
                                    <div>
                                        <h4 className="font-medium text-sm mb-2">Furniture Items</h4>
                                        <div className="space-y-1">
                                            {layout.placements.map((placement, index) => (
                                                <div key={index} className="flex items-center justify-between text-xs">
                                                    <span className="text-gray-600 dark:text-gray-400">
                                                        {placement.furniture_name}
                                                    </span>
                                                    <span className="font-medium">
                                                        {formatPrice(placement.price_cents)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Violations Details */}
                                    {layout.violations && layout.violations.length > 0 && (
                                        <div>
                                            <h4 className="font-medium text-sm mb-2 text-amber-600">Issues to Address</h4>
                                            <div className="space-y-1">
                                                {layout.violations.map((violation, index) => (
                                                    <div key={index} className="flex items-start gap-2 text-xs">
                                                        <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                                                        <span className="text-gray-600 dark:text-gray-400">{violation}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Selected Layout Actions */}
            {selectedLayout && (
                <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <CheckCircle className="h-5 w-5 text-blue-600" />
                                <div>
                                    <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                                        Layout Selected
                                    </h3>
                                    <p className="text-sm text-blue-700 dark:text-blue-300">
                                        Ready to view in AR or proceed to shopping
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {onViewAR && (
                                    <Button variant="outline" className="border-blue-300">
                                        <Eye className="mr-2 h-4 w-4" />
                                        View in AR
                                    </Button>
                                )}
                                <Button className="bg-blue-600 hover:bg-blue-700">
                                    Continue to Shopping
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function LayoutPreview({ layout }: { layout: Layout }) {
    // Simple 2D layout visualization
    return (
        <div className="relative w-full h-full">
            {/* Room outline */}
            <div className="absolute inset-2 border-2 border-gray-300 dark:border-gray-600 rounded"></div>

            {/* Furniture representations */}
            {layout.placements.map((placement, index) => {
                // Scale and position furniture items
                const scale = 0.02; // Scale factor for preview
                const offsetX = 20; // Offset from room edge
                const offsetY = 20;

                const width = Math.max(8, placement.dimensions.width * 50 * scale);
                const height = Math.max(6, placement.dimensions.depth * 50 * scale);
                const left = offsetX + (placement.x * 20);
                const top = offsetY + (placement.y * 20);

                return (
                    <div
                        key={index}
                        className="absolute bg-blue-400 dark:bg-blue-500 rounded-sm opacity-80"
                        style={{
                            width: `${width}px`,
                            height: `${height}px`,
                            left: `${Math.min(left, 80)}px`,
                            top: `${Math.min(top, 80)}px`,
                            transform: `rotate(${placement.rotation}deg)`,
                        }}
                        title={placement.furniture_name}
                    />
                );
            })}

            {/* Strategy indicator */}
            <div className="absolute bottom-1 left-1 text-xs text-gray-500 dark:text-gray-400">
                {layout.strategy.replace('_', ' ')}
            </div>
        </div>
    );
}
