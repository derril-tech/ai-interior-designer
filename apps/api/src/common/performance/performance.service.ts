import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { performance } from 'perf_hooks';
import * as cluster from 'cluster';
import * as os from 'os';

interface PerformanceMetrics {
    responseTime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    eventLoopDelay: number;
    activeHandles: number;
    activeRequests: number;
}

@Injectable()
export class PerformanceService {
    private readonly logger = new Logger(PerformanceService.name);
    private metrics: Map<string, PerformanceMetrics[]> = new Map();
    private eventLoopMonitor: any;

    constructor(private configService: ConfigService) {
        this.startEventLoopMonitoring();
        this.startPeriodicCleanup();
    }

    /**
     * Start performance measurement
     */
    startMeasurement(label: string): number {
        return performance.now();
    }

    /**
     * End performance measurement and record metrics
     */
    endMeasurement(label: string, startTime: number): number {
        const endTime = performance.now();
        const duration = endTime - startTime;

        this.recordMetrics(label, {
            responseTime: duration,
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            eventLoopDelay: this.getEventLoopDelay(),
            activeHandles: (process as any)._getActiveHandles().length,
            activeRequests: (process as any)._getActiveRequests().length,
        });

        return duration;
    }

    /**
     * Record performance metrics
     */
    private recordMetrics(label: string, metrics: PerformanceMetrics): void {
        if (!this.metrics.has(label)) {
            this.metrics.set(label, []);
        }

        const labelMetrics = this.metrics.get(label)!;
        labelMetrics.push(metrics);

        // Keep only last 1000 measurements per label
        if (labelMetrics.length > 1000) {
            labelMetrics.shift();
        }

        // Log slow operations
        if (metrics.responseTime > 1000) {
            this.logger.warn(`Slow operation detected: ${label} took ${metrics.responseTime.toFixed(2)}ms`);
        }

        // Log high memory usage
        const memoryUsageMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
        if (memoryUsageMB > 500) {
            this.logger.warn(`High memory usage: ${memoryUsageMB.toFixed(2)}MB heap used`);
        }
    }

    /**
     * Get performance statistics for a label
     */
    getStatistics(label: string): any {
        const labelMetrics = this.metrics.get(label);
        if (!labelMetrics || labelMetrics.length === 0) {
            return null;
        }

        const responseTimes = labelMetrics.map(m => m.responseTime);
        const memoryUsages = labelMetrics.map(m => m.memoryUsage.heapUsed / 1024 / 1024);

        return {
            count: labelMetrics.length,
            responseTime: {
                min: Math.min(...responseTimes),
                max: Math.max(...responseTimes),
                avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
                p95: this.percentile(responseTimes, 0.95),
                p99: this.percentile(responseTimes, 0.99),
            },
            memory: {
                min: Math.min(...memoryUsages),
                max: Math.max(...memoryUsages),
                avg: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
            },
            lastEventLoopDelay: labelMetrics[labelMetrics.length - 1].eventLoopDelay,
            lastActiveHandles: labelMetrics[labelMetrics.length - 1].activeHandles,
            lastActiveRequests: labelMetrics[labelMetrics.length - 1].activeRequests,
        };
    }

    /**
     * Get all performance statistics
     */
    getAllStatistics(): Record<string, any> {
        const stats: Record<string, any> = {};

        for (const [label] of this.metrics) {
            stats[label] = this.getStatistics(label);
        }

        // Add system-wide metrics
        stats._system = this.getSystemMetrics();

        return stats;
    }

    /**
     * Get system-wide performance metrics
     */
    getSystemMetrics(): any {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        return {
            uptime: process.uptime(),
            memory: {
                rss: memUsage.rss / 1024 / 1024,
                heapTotal: memUsage.heapTotal / 1024 / 1024,
                heapUsed: memUsage.heapUsed / 1024 / 1024,
                external: memUsage.external / 1024 / 1024,
            },
            cpu: {
                user: cpuUsage.user / 1000000, // Convert to seconds
                system: cpuUsage.system / 1000000,
            },
            eventLoopDelay: this.getEventLoopDelay(),
            activeHandles: (process as any)._getActiveHandles().length,
            activeRequests: (process as any)._getActiveRequests().length,
            loadAverage: os.loadavg(),
            freeMem: os.freemem() / 1024 / 1024,
            totalMem: os.totalmem() / 1024 / 1024,
        };
    }

    /**
     * Calculate percentile
     */
    private percentile(values: number[], p: number): number {
        const sorted = values.slice().sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * p) - 1;
        return sorted[index] || 0;
    }

    /**
     * Start event loop monitoring
     */
    private startEventLoopMonitoring(): void {
        let start = process.hrtime.bigint();

        this.eventLoopMonitor = setInterval(() => {
            const delta = process.hrtime.bigint() - start;
            const nanosec = Number(delta);
            const millisec = nanosec / 1000000;

            // Expected delay should be close to interval (100ms)
            const expectedDelay = 100;
            const actualDelay = millisec;
            const eventLoopDelay = Math.max(0, actualDelay - expectedDelay);

            if (eventLoopDelay > 50) {
                this.logger.warn(`Event loop delay: ${eventLoopDelay.toFixed(2)}ms`);
            }

            start = process.hrtime.bigint();
        }, 100);
    }

    /**
     * Get current event loop delay
     */
    private getEventLoopDelay(): number {
        // This is a simplified implementation
        // In production, you might want to use perf_hooks.monitorEventLoopDelay()
        return 0;
    }

    /**
     * Start periodic cleanup of old metrics
     */
    private startPeriodicCleanup(): void {
        setInterval(() => {
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours

            for (const [label, metrics] of this.metrics) {
                // Remove metrics older than maxAge
                const filtered = metrics.filter(m => {
                    // Assuming we add timestamp to metrics in the future
                    return true; // For now, keep all metrics
                });

                if (filtered.length !== metrics.length) {
                    this.metrics.set(label, filtered);
                    this.logger.debug(`Cleaned up ${metrics.length - filtered.length} old metrics for ${label}`);
                }
            }
        }, 60 * 60 * 1000); // Run every hour
    }

    /**
     * Enable cluster mode for better performance
     */
    static enableClusterMode(): void {
        const numCPUs = os.cpus().length;
        const maxWorkers = parseInt(process.env.CLUSTER_WORKERS || '0');
        const workers = maxWorkers > 0 ? Math.min(maxWorkers, numCPUs) : numCPUs;

        if (cluster.isMaster) {
            console.log(`Master ${process.pid} is running`);
            console.log(`Starting ${workers} workers`);

            // Fork workers
            for (let i = 0; i < workers; i++) {
                cluster.fork();
            }

            cluster.on('exit', (worker, code, signal) => {
                console.log(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
                console.log('Starting a new worker');
                cluster.fork();
            });

            // Graceful shutdown
            process.on('SIGTERM', () => {
                console.log('Master received SIGTERM, shutting down workers');

                for (const id in cluster.workers) {
                    cluster.workers[id]?.kill();
                }
            });

            return;
        }

        console.log(`Worker ${process.pid} started`);
    }

    /**
     * Optimize garbage collection
     */
    static optimizeGarbageCollection(): void {
        // Set GC flags for better performance
        if (process.env.NODE_ENV === 'production') {
            // These would typically be set via NODE_OPTIONS environment variable
            console.log('GC optimization flags should be set via NODE_OPTIONS:');
            console.log('--max-old-space-size=4096 --gc-interval=100');
        }

        // Monitor GC events
        if (global.gc) {
            const originalGC = global.gc;
            global.gc = function () {
                const start = process.hrtime.bigint();
                const result = originalGC();
                const duration = Number(process.hrtime.bigint() - start) / 1000000;

                if (duration > 100) {
                    console.warn(`Long GC pause: ${duration.toFixed(2)}ms`);
                }

                return result;
            };
        }
    }

    /**
     * Get performance recommendations
     */
    getPerformanceRecommendations(): string[] {
        const recommendations: string[] = [];
        const systemMetrics = this.getSystemMetrics();

        // Memory recommendations
        if (systemMetrics.memory.heapUsed > 1000) {
            recommendations.push('High heap usage detected. Consider optimizing memory usage or increasing heap size.');
        }

        // CPU recommendations
        const avgLoad = systemMetrics.loadAverage[0];
        if (avgLoad > os.cpus().length) {
            recommendations.push('High CPU load detected. Consider scaling horizontally or optimizing CPU-intensive operations.');
        }

        // Event loop recommendations
        if (systemMetrics.eventLoopDelay > 10) {
            recommendations.push('Event loop delay detected. Consider moving CPU-intensive operations to worker threads.');
        }

        // Active handles recommendations
        if (systemMetrics.activeHandles > 1000) {
            recommendations.push('High number of active handles. Check for potential memory leaks or unclosed resources.');
        }

        return recommendations;
    }

    /**
     * Clear all metrics
     */
    clearMetrics(): void {
        this.metrics.clear();
        this.logger.log('Performance metrics cleared');
    }

    /**
     * Cleanup resources
     */
    onModuleDestroy(): void {
        if (this.eventLoopMonitor) {
            clearInterval(this.eventLoopMonitor);
        }
    }
}
