import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';

@Injectable()
export class SecurityService {
    private readonly logger = new Logger(SecurityService.name);
    private readonly encryptionKey: string;
    private readonly algorithm = 'aes-256-gcm';

    constructor(private configService: ConfigService) {
        this.encryptionKey = this.configService.get<string>('ENCRYPTION_KEY') ||
            crypto.randomBytes(32).toString('hex');
    }

    /**
     * Hash password with bcrypt
     */
    async hashPassword(password: string): Promise<string> {
        const saltRounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
        return bcrypt.hash(password, saltRounds);
    }

    /**
     * Verify password against hash
     */
    async verifyPassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    /**
     * Encrypt sensitive data
     */
    encrypt(text: string): { encrypted: string; iv: string; tag: string } {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
        cipher.setAAD(Buffer.from('ai-interior-designer', 'utf8'));

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const tag = cipher.getAuthTag();

        return {
            encrypted,
            iv: iv.toString('hex'),
            tag: tag.toString('hex'),
        };
    }

    /**
     * Decrypt sensitive data
     */
    decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
        const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
        decipher.setAAD(Buffer.from('ai-interior-designer', 'utf8'));
        decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));

        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Generate secure random token
     */
    generateSecureToken(length: number = 32): string {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Generate CSRF token
     */
    generateCSRFToken(): string {
        return crypto.randomBytes(32).toString('base64');
    }

    /**
     * Validate CSRF token
     */
    validateCSRFToken(token: string, sessionToken: string): boolean {
        return crypto.timingSafeEqual(
            Buffer.from(token, 'base64'),
            Buffer.from(sessionToken, 'base64')
        );
    }

    /**
     * Sanitize user input
     */
    sanitizeInput(input: string): string {
        if (!input || typeof input !== 'string') {
            return '';
        }

        return input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+\s*=/gi, '') // Remove event handlers
            .replace(/[<>]/g, '') // Remove < and >
            .trim();
    }

    /**
     * Validate file upload
     */
    validateFileUpload(file: Express.Multer.File): {
        isValid: boolean;
        error?: string;
    } {
        const allowedTypes = this.configService
            .get<string>('ALLOWED_FILE_TYPES', 'jpg,jpeg,png,heic,mov,mp4')
            .split(',');

        const maxSize = this.configService.get<number>('MAX_FILE_SIZE_MB', 50) * 1024 * 1024;

        // Check file size
        if (file.size > maxSize) {
            return {
                isValid: false,
                error: `File size exceeds ${maxSize / 1024 / 1024}MB limit`,
            };
        }

        // Check file type
        const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
        if (!fileExtension || !allowedTypes.includes(fileExtension)) {
            return {
                isValid: false,
                error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
            };
        }

        // Check MIME type
        const allowedMimeTypes = [
            'image/jpeg',
            'image/png',
            'image/heic',
            'video/quicktime',
            'video/mp4',
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
            return {
                isValid: false,
                error: 'Invalid file MIME type',
            };
        }

        return { isValid: true };
    }

    /**
     * Get client IP address
     */
    getClientIP(request: Request): string {
        const forwarded = request.headers['x-forwarded-for'] as string;
        const realIP = request.headers['x-real-ip'] as string;
        const clientIP = request.connection.remoteAddress;

        return forwarded?.split(',')[0] || realIP || clientIP || 'unknown';
    }

    /**
     * Log security event
     */
    logSecurityEvent(event: string, details: any, request?: Request): void {
        const logData = {
            event,
            timestamp: new Date().toISOString(),
            ip: request ? this.getClientIP(request) : 'unknown',
            userAgent: request?.headers['user-agent'] || 'unknown',
            details,
        };

        this.logger.warn(`Security Event: ${event}`, logData);
    }

    /**
     * Check for suspicious patterns
     */
    detectSuspiciousActivity(request: Request): {
        isSuspicious: boolean;
        reasons: string[];
    } {
        const reasons: string[] = [];
        const userAgent = request.headers['user-agent'] || '';
        const url = request.url;

        // Check for common attack patterns
        const suspiciousPatterns = [
            /\.\.\//g, // Directory traversal
            /<script/gi, // XSS attempts
            /union.*select/gi, // SQL injection
            /exec\s*\(/gi, // Code execution attempts
            /eval\s*\(/gi, // Eval attempts
        ];

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(url) || pattern.test(JSON.stringify(request.body))) {
                reasons.push(`Suspicious pattern detected: ${pattern.source}`);
            }
        }

        // Check for bot-like behavior
        const botPatterns = [
            /bot/gi,
            /crawler/gi,
            /spider/gi,
            /scraper/gi,
        ];

        for (const pattern of botPatterns) {
            if (pattern.test(userAgent)) {
                reasons.push('Bot-like user agent detected');
                break;
            }
        }

        // Check for missing or suspicious headers
        if (!request.headers['user-agent']) {
            reasons.push('Missing User-Agent header');
        }

        if (!request.headers['accept']) {
            reasons.push('Missing Accept header');
        }

        return {
            isSuspicious: reasons.length > 0,
            reasons,
        };
    }

    /**
     * Generate secure session ID
     */
    generateSessionId(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Validate session integrity
     */
    validateSessionIntegrity(sessionData: any): boolean {
        // Check for required session fields
        const requiredFields = ['userId', 'createdAt', 'lastActivity'];

        for (const field of requiredFields) {
            if (!sessionData[field]) {
                return false;
            }
        }

        // Check session age
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        const sessionAge = Date.now() - new Date(sessionData.createdAt).getTime();

        if (sessionAge > maxAge) {
            return false;
        }

        // Check last activity
        const maxInactivity = 2 * 60 * 60 * 1000; // 2 hours
        const inactivityTime = Date.now() - new Date(sessionData.lastActivity).getTime();

        if (inactivityTime > maxInactivity) {
            return false;
        }

        return true;
    }
}
