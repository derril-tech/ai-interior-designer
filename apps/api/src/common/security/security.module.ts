import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { SecurityService } from './security.service';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { SecurityHeadersMiddleware } from './middleware/security-headers.middleware';
import { InputSanitizationPipe } from './pipes/input-sanitization.pipe';

@Module({
    imports: [
        ThrottlerModule.forRoot([
            {
                name: 'short',
                ttl: 1000, // 1 second
                limit: 10, // 10 requests per second
            },
            {
                name: 'medium',
                ttl: 60000, // 1 minute
                limit: 100, // 100 requests per minute
            },
            {
                name: 'long',
                ttl: 900000, // 15 minutes
                limit: 1000, // 1000 requests per 15 minutes
            },
        ]),
    ],
    providers: [
        SecurityService,
        RateLimitGuard,
        SecurityHeadersMiddleware,
        InputSanitizationPipe,
    ],
    exports: [
        SecurityService,
        RateLimitGuard,
        SecurityHeadersMiddleware,
        InputSanitizationPipe,
    ],
})
export class SecurityModule { }
