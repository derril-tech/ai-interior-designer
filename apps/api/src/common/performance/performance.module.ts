import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bull';
import { PerformanceService } from './performance.service';
import { CacheService } from './cache.service';
import { CompressionMiddleware } from './middleware/compression.middleware';
import { ResponseTimeMiddleware } from './middleware/response-time.middleware';
import * as redisStore from 'cache-manager-redis-store';

@Module({
    imports: [
        // Redis Cache Configuration
        CacheModule.register({
            store: redisStore,
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: 0,
            ttl: 3600, // 1 hour default TTL
            max: 1000, // Maximum number of items in cache
            isGlobal: true,
        }),

        // Bull Queue for Background Jobs
        BullModule.forRoot({
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD,
                db: 1, // Use different DB for queues
            },
            defaultJobOptions: {
                removeOnComplete: 100,
                removeOnFail: 50,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
            },
        }),
    ],
    providers: [
        PerformanceService,
        CacheService,
        CompressionMiddleware,
        ResponseTimeMiddleware,
    ],
    exports: [
        PerformanceService,
        CacheService,
        CompressionMiddleware,
        ResponseTimeMiddleware,
        CacheModule,
        BullModule,
    ],
})
export class PerformanceModule { }
