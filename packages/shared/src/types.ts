import { z } from 'zod';

// Common types used across the application

export const UserSchema = z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    locale: z.string().optional(),
    timezone: z.string().optional(),
    createdAt: z.date(),
});

export const ProjectSchema = z.object({
    id: z.string(),
    userId: z.string(),
    title: z.string(),
    address: z.string().optional(),
    currency: z.string().default('USD'),
    stylePrefs: z.array(z.string()).default([]),
    budgetCents: z.number().optional(),
    createdAt: z.date(),
});

export const RoomSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    areaSqm: z.number().optional(),
    heightCm: z.number().optional(),
    floorplan: z.record(z.any()).optional(),
    meshS3: z.string().optional(),
    lighting: z.record(z.any()).optional(),
    createdAt: z.date(),
});

export const ProductSchema = z.object({
    id: z.string(),
    vendor: z.string(),
    sku: z.string(),
    name: z.string(),
    category: z.string(),
    dimsCm: z.record(z.number()),
    finishes: z.array(z.string()).default([]),
    priceCents: z.number(),
    currency: z.string().default('USD'),
    url: z.string().optional(),
    assetGltf: z.string().optional(),
    assetUsdz: z.string().optional(),
    stock: z.record(z.any()).optional(),
    leadTimeDays: z.number().optional(),
    policy: z.record(z.any()).optional(),
});

export const LayoutSchema = z.object({
    id: z.string(),
    roomId: z.string(),
    name: z.string(),
    placements: z.array(z.object({
        itemId: z.string(),
        x: z.number(),
        y: z.number(),
        rotation: z.number(),
        scale: z.number().default(1),
    })),
    rationale: z.string().optional(),
    violations: z.array(z.string()).default([]),
    score: z.number().optional(),
    createdAt: z.date(),
});

export const JobSchema = z.object({
    id: z.string(),
    type: z.enum(['scan', 'layout', 'render', 'export', 'rag']),
    status: z.enum(['pending', 'processing', 'completed', 'failed']),
    input: z.record(z.any()),
    output: z.record(z.any()).optional(),
    error: z.string().optional(),
    progress: z.number().min(0).max(1).default(0),
    createdAt: z.date(),
});

// Export inferred types
export type User = z.infer<typeof UserSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type Layout = z.infer<typeof LayoutSchema>;
export type Job = z.infer<typeof JobSchema>;

// API Response types
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// Job progress types
export interface JobProgress {
    jobId: string;
    progress: number;
    message: string;
    timestamp: number;
}
