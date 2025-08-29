'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
    Activity,
    AlertTriangle,
    CheckCircle,
    Clock,
    Server,
    Database,
    Zap,
    Users,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    Bell,
    Settings,
    BarChart3,
    PieChart,
    LineChart
} from 'lucide-react';

interface MetricsDashboardProps {
    refreshInterval?: number;
}

interface SystemMetrics {
    timestamp: string;
    performance: {
        scanToFloorPlan: { p95: number; p99: number; avg: number };
        layoutGeneration: { p95: number; p99: number; avg: number };
        productSearch: { p95: number; p99: number; avg: number };
        arExport: { p95: number; p99: number; avg: number };
        pdfExport: { p95: number; p99: number; avg: number };
    };
    reliability: {
        uptime: number;
        successRate: number;
        errorRate: number;
        pipelineSuccess: number;
    };
    usage: {
        activeUsers: number;
        totalScans: number;
        layoutsGenerated: number;
        arExports: number;
        pdfExports: number;
    };
    infrastructure: {
        apiHealth: 'healthy' | 'degraded' | 'down';
        dbHealth: 'healthy' | 'degraded' | 'down';
        queueHealth: 'healthy' | 'degraded' | 'down';
        workerHealth: { [key: string]: 'healthy' | 'degraded' | 'down' };
    };
    alerts: Alert[];
}

interface Alert {
    id: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    timestamp: string;
    resolved: boolean;
    component: string;
}

export function MetricsDashboard({ refreshInterval = 30000 }: MetricsDashboardProps) {
    const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    useEffect(() => {
        loadMetrics();
        const interval = setInterval(loadMetrics, refreshInterval);
        return () => clearInterval(interval);
    }, [refreshInterval]);

    const loadMetrics = async () => {
        setIsLoading(true);

        // Mock metrics data - in production, fetch from monitoring API
        const mockMetrics: SystemMetrics = {
            timestamp: new Date().toISOString(),
            performance: {
                scanToFloorPlan: { p95: 42.3, p99: 58.7, avg: 28.5 },
                layoutGeneration: { p95: 6.8, p99: 9.2, avg: 4.3 },
                productSearch: { p95: 1.2, p99: 1.8, avg: 0.8 },
                arExport: { p95: 4.1, p99: 6.3, avg: 2.9 },
                pdfExport: { p95: 2.3, p99: 3.1, avg: 1.7 }
            },
            reliability: {
                uptime: 99.94,
                successRate: 98.7,
                errorRate: 1.3,
                pipelineSuccess: 99.1
            },
            usage: {
                activeUsers: 1247,
                totalScans: 15623,
                layoutsGenerated: 12890,
                arExports: 8934,
                pdfExports: 6721
            },
            infrastructure: {
                apiHealth: 'healthy',
                dbHealth: 'healthy',
                queueHealth: 'healthy',
                workerHealth: {
                    'scan-worker': 'healthy',
                    'layout-worker': 'healthy',
                    'validate-worker': 'degraded',
                    'rag-worker': 'healthy',
                    'catalog-worker': 'healthy',
                    'render-worker': 'healthy',
                    'export-worker': 'healthy'
                }
            },
            alerts: [
                {
                    id: '1',
                    severity: 'warning',
                    message: 'Validate worker response time increased by 15%',
                    timestamp: '2024-01-15T14:30:00Z',
                    resolved: false,
                    component: 'validate-worker'
                },
                {
                    id: '2',
                    severity: 'info',
                    message: 'Scheduled maintenance completed successfully',
                    timestamp: '2024-01-15T12:00:00Z',
                    resolved: true,
                    component: 'infrastructure'
                }
            ]
        };

        setMetrics(mockMetrics);
        setLastRefresh(new Date());
        setIsLoading(false);
    };

    const getHealthColor = (health: string) => {
        switch (health) {
            case 'healthy': return 'text-green-600 bg-green-100';
            case 'degraded': return 'text-yellow-600 bg-yellow-100';
            case 'down': return 'text-red-600 bg-red-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'text-red-600 bg-red-100';
            case 'warning': return 'text-yellow-600 bg-yellow-100';
            case 'info': return 'text-blue-600 bg-blue-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const formatDuration = (seconds: number) => {
        if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
        return `${seconds.toFixed(1)}s`;
    };

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    if (isLoading || !metrics) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">System Metrics</h1>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <CardHeader>
                                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">System Metrics</h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Last updated: {lastRefresh.toLocaleTimeString()}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={loadMetrics} disabled={isLoading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button variant="outline">
                        <Settings className="mr-2 h-4 w-4" />
                        Configure
                    </Button>
                </div>
            </div>

            {/* Alerts */}
            {metrics.alerts.filter(a => !a.resolved).length > 0 && (
                <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                            <Bell className="h-5 w-5" />
                            Active Alerts ({metrics.alerts.filter(a => !a.resolved).length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {metrics.alerts.filter(a => !a.resolved).map((alert) => (
                                <div key={alert.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border">
                                    <div className="flex items-center gap-3">
                                        <Badge className={`${getSeverityColor(alert.severity)} border-0`}>
                                            {alert.severity}
                                        </Badge>
                                        <span className="font-medium">{alert.message}</span>
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {alert.component}
                                        </span>
                                    </div>
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        {new Date(alert.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{metrics.reliability.uptime}%</div>
                        <p className="text-xs text-muted-foreground">Last 30 days</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{metrics.reliability.successRate}%</div>
                        <p className="text-xs text-muted-foreground">Pipeline success rate</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatNumber(metrics.usage.activeUsers)}</div>
                        <p className="text-xs text-muted-foreground">Currently online</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatNumber(metrics.usage.totalScans)}</div>
                        <p className="text-xs text-muted-foreground">All time</p>
                    </CardContent>
                </Card>
            </div>

            {/* Performance Metrics */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Performance Metrics
                    </CardTitle>
                    <CardDescription>Response times and SLA compliance</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries(metrics.performance).map(([key, perf]) => {
                            const slaTarget = {
                                scanToFloorPlan: 45,
                                layoutGeneration: 8,
                                productSearch: 1.5,
                                arExport: 5,
                                pdfExport: 3
                            }[key] || 10;

                            const isWithinSLA = perf.p95 <= slaTarget;

                            return (
                                <div key={key} className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-medium capitalize">
                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                        </h4>
                                        <Badge className={isWithinSLA ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                            {isWithinSLA ? 'SLA Met' : 'SLA Miss'}
                                        </Badge>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span>P95: {formatDuration(perf.p95)}</span>
                                            <span>Target: {formatDuration(slaTarget)}</span>
                                        </div>
                                        <Progress
                                            value={Math.min(100, (perf.p95 / slaTarget) * 100)}
                                            className={`h-2 ${isWithinSLA ? '' : 'bg-red-100'}`}
                                        />
                                        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                                            <span>Avg: {formatDuration(perf.avg)}</span>
                                            <span>P99: {formatDuration(perf.p99)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Infrastructure Health */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Server className="h-5 w-5" />
                            Infrastructure Health
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">API</span>
                                <Badge className={`${getHealthColor(metrics.infrastructure.apiHealth)} border-0`}>
                                    {metrics.infrastructure.apiHealth}
                                </Badge>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Database</span>
                                <Badge className={`${getHealthColor(metrics.infrastructure.dbHealth)} border-0`}>
                                    {metrics.infrastructure.dbHealth}
                                </Badge>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Queue</span>
                                <Badge className={`${getHealthColor(metrics.infrastructure.queueHealth)} border-0`}>
                                    {metrics.infrastructure.queueHealth}
                                </Badge>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-medium mb-3">Worker Health</h4>
                            <div className="grid grid-cols-1 gap-2">
                                {Object.entries(metrics.infrastructure.workerHealth).map(([worker, health]) => (
                                    <div key={worker} className="flex items-center justify-between">
                                        <span className="text-sm">{worker}</span>
                                        <Badge className={`${getHealthColor(health)} border-0 text-xs`}>
                                            {health}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PieChart className="h-5 w-5" />
                            Usage Statistics
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <div className="text-2xl font-bold text-blue-600">
                                        {formatNumber(metrics.usage.layoutsGenerated)}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">Layouts</div>
                                </div>

                                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <div className="text-2xl font-bold text-green-600">
                                        {formatNumber(metrics.usage.arExports)}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">AR Exports</div>
                                </div>

                                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <div className="text-2xl font-bold text-purple-600">
                                        {formatNumber(metrics.usage.pdfExports)}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">PDF Exports</div>
                                </div>

                                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <div className="text-2xl font-bold text-orange-600">
                                        {metrics.reliability.errorRate}%
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">Error Rate</div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
