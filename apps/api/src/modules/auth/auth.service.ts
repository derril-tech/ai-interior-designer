import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';

export interface JwtPayload {
    sub: string;
    email: string;
    role: string;
    permissions: string[];
    iat?: number;
    exp?: number;
}

export interface AuthResult {
    access_token: string;
    refresh_token: string;
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
        permissions: string[];
    };
}

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) { }

    async register(registerDto: RegisterDto): Promise<AuthResult> {
        const { email, password, name } = registerDto;

        // Check if user already exists
        const existingUser = await this.prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            throw new ForbiddenException('User with this email already exists');
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create user with default role
        const user = await this.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: 'USER',
                isActive: true,
                emailVerified: false,
            },
        });

        // Generate tokens
        const tokens = await this.generateTokens(user);

        return {
            ...tokens,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                permissions: this.getRolePermissions(user.role),
            },
        };
    }

    async login(loginDto: LoginDto): Promise<AuthResult> {
        const { email, password } = loginDto;

        // Find user
        const user = await this.prisma.user.findUnique({
            where: { email },
        });

        if (!user || !user.isActive) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Update last login
        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        // Generate tokens
        const tokens = await this.generateTokens(user);

        return {
            ...tokens,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                permissions: this.getRolePermissions(user.role),
            },
        };
    }

    async refreshToken(refreshToken: string): Promise<AuthResult> {
        try {
            const payload = this.jwtService.verify(refreshToken, {
                secret: process.env.JWT_REFRESH_SECRET,
            });

            const user = await this.prisma.user.findUnique({
                where: { id: payload.sub },
            });

            if (!user || !user.isActive) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            // Generate new tokens
            const tokens = await this.generateTokens(user);

            return {
                ...tokens,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    permissions: this.getRolePermissions(user.role),
                },
            };
        } catch (error) {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    async validateUser(payload: JwtPayload): Promise<any> {
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
        });

        if (!user || !user.isActive) {
            throw new UnauthorizedException('User not found or inactive');
        }

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            permissions: this.getRolePermissions(user.role),
        };
    }

    async logout(userId: string): Promise<void> {
        // In a production app, you might want to blacklist the token
        // or store refresh tokens in the database and remove them
        await this.prisma.user.update({
            where: { id: userId },
            data: { lastLogoutAt: new Date() },
        });
    }

    private async generateTokens(user: any): Promise<{ access_token: string; refresh_token: string }> {
        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            permissions: this.getRolePermissions(user.role),
        };

        const [access_token, refresh_token] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: process.env.JWT_SECRET,
                expiresIn: '15m',
            }),
            this.jwtService.signAsync(payload, {
                secret: process.env.JWT_REFRESH_SECRET,
                expiresIn: '7d',
            }),
        ]);

        return { access_token, refresh_token };
    }

    private getRolePermissions(role: string): string[] {
        const rolePermissions = {
            ADMIN: [
                'users:read',
                'users:write',
                'users:delete',
                'projects:read',
                'projects:write',
                'projects:delete',
                'projects:share',
                'layouts:read',
                'layouts:write',
                'layouts:delete',
                'exports:read',
                'exports:write',
                'analytics:read',
                'system:admin',
            ],
            DESIGNER: [
                'projects:read',
                'projects:write',
                'projects:share',
                'layouts:read',
                'layouts:write',
                'exports:read',
                'exports:write',
                'analytics:read',
            ],
            USER: [
                'projects:read',
                'projects:write',
                'layouts:read',
                'layouts:write',
                'exports:read',
            ],
            VIEWER: [
                'projects:read',
                'layouts:read',
            ],
        };

        return rolePermissions[role] || rolePermissions.VIEWER;
    }

    // Role-Based Access Control helpers
    hasPermission(userPermissions: string[], requiredPermission: string): boolean {
        return userPermissions.includes(requiredPermission);
    }

    hasAnyPermission(userPermissions: string[], requiredPermissions: string[]): boolean {
        return requiredPermissions.some(permission => userPermissions.includes(permission));
    }

    hasAllPermissions(userPermissions: string[], requiredPermissions: string[]): boolean {
        return requiredPermissions.every(permission => userPermissions.includes(permission));
    }

    // OAuth providers (Apple/Google)
    async handleOAuthLogin(provider: 'apple' | 'google', profile: any): Promise<AuthResult> {
        const { id, email, name } = profile;

        // Find or create user
        let user = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    {
                        oauthProviders: {
                            some: {
                                provider,
                                providerId: id,
                            },
                        },
                    },
                ],
            },
            include: {
                oauthProviders: true,
            },
        });

        if (!user) {
            // Create new user
            user = await this.prisma.user.create({
                data: {
                    email,
                    name,
                    role: 'USER',
                    isActive: true,
                    emailVerified: true, // OAuth emails are pre-verified
                    oauthProviders: {
                        create: {
                            provider,
                            providerId: id,
                        },
                    },
                },
                include: {
                    oauthProviders: true,
                },
            });
        } else {
            // Update existing user
            const hasProvider = user.oauthProviders.some(
                p => p.provider === provider && p.providerId === id
            );

            if (!hasProvider) {
                await this.prisma.oAuthProvider.create({
                    data: {
                        userId: user.id,
                        provider,
                        providerId: id,
                    },
                });
            }

            // Update last login
            await this.prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() },
            });
        }

        // Generate tokens
        const tokens = await this.generateTokens(user);

        return {
            ...tokens,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                permissions: this.getRolePermissions(user.role),
            },
        };
    }
}