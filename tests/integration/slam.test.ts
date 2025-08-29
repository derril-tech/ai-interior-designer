import { describe, test, expect, beforeAll, afterAll } from '@jest/test';
import { RealSLAMPipeline } from '../../workers/scan-worker/slam_pipeline';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('SLAM Pipeline Integration Tests', () => {
    let slamPipeline: RealSLAMPipeline;
    let testFrames: string[];

    beforeAll(async () => {
        slamPipeline = new RealSLAMPipeline();

        // Create test frame data
        testFrames = [
            'test_frame_001.jpg',
            'test_frame_002.jpg',
            'test_frame_003.jpg',
            'test_frame_004.jpg',
            'test_frame_005.jpg',
        ];
    });

    afterAll(async () => {
        // Cleanup test data
    });

    describe('Frame Processing', () => {
        test('should process minimum frame sequence', async () => {
            const minFrames = testFrames.slice(0, 2);

            const result = await slamPipeline.process_frame_sequence(minFrames);

            expect(result).toBeDefined();
            expect(result[0]).toHaveLength(2); // Camera trajectory
            expect(result[1]).toBeInstanceOf(Array); // Sparse points
        });

        test('should handle full frame sequence', async () => {
            const result = await slamPipeline.process_frame_sequence(testFrames);

            expect(result[0]).toHaveLength(testFrames.length); // All poses
            expect(result[1].length).toBeGreaterThan(0); // Some 3D points
        });

        test('should reject insufficient frames', async () => {
            const singleFrame = [testFrames[0]];

            await expect(
                slamPipeline.process_frame_sequence(singleFrame)
            ).rejects.toThrow('Need at least 2 frames');
        });
    });

    describe('Pose Estimation', () => {
        test('should maintain reasonable scale', async () => {
            const result = await slamPipeline.process_frame_sequence(testFrames);
            const poses = result[0];

            // Check that poses don't drift too much
            let totalDistance = 0;
            for (let i = 1; i < poses.length; i++) {
                const prev = poses[i - 1];
                const curr = poses[i];

                const distance = Math.sqrt(
                    Math.pow(curr.position.x - prev.position.x, 2) +
                    Math.pow(curr.position.y - prev.position.y, 2) +
                    Math.pow(curr.position.z - prev.position.z, 2)
                );

                totalDistance += distance;
            }

            // Total trajectory should be reasonable (not too small or large)
            expect(totalDistance).toBeGreaterThan(0.1); // At least 10cm
            expect(totalDistance).toBeLessThan(10.0);   // Less than 10m
        });

        test('should have high confidence poses', async () => {
            const result = await slamPipeline.process_frame_sequence(testFrames);
            const poses = result[0];

            poses.forEach((pose, index) => {
                expect(pose.confidence).toBeGreaterThan(0.5);
                expect(pose.frame_id).toBe(index);
                expect(pose.timestamp).toBeGreaterThanOrEqual(0);
            });
        });
    });

    describe('3D Reconstruction', () => {
        test('should generate reasonable number of 3D points', async () => {
            const result = await slamPipeline.process_frame_sequence(testFrames);
            const points = result[1];

            // Should have some 3D points but not too many
            expect(points.length).toBeGreaterThan(10);
            expect(points.length).toBeLessThan(10000);
        });

        test('should have valid 3D point properties', async () => {
            const result = await slamPipeline.process_frame_sequence(testFrames);
            const points = result[1];

            points.forEach(point => {
                expect(point.id).toBeDefined();
                expect(point.position).toBeDefined();
                expect(point.position.x).toBeTypeOf('number');
                expect(point.position.y).toBeTypeOf('number');
                expect(point.position.z).toBeTypeOf('number');
                expect(point.confidence).toBeGreaterThan(0);
                expect(point.observations).toBeGreaterThan(0);
            });
        });
    });

    describe('Performance', () => {
        test('should process frames within time limit', async () => {
            const startTime = Date.now();

            await slamPipeline.process_frame_sequence(testFrames);

            const processingTime = Date.now() - startTime;

            // Should process 5 frames in under 10 seconds
            expect(processingTime).toBeLessThan(10000);
        });

        test('should handle concurrent processing', async () => {
            const promises = [
                slamPipeline.process_frame_sequence(testFrames.slice(0, 3)),
                slamPipeline.process_frame_sequence(testFrames.slice(2, 5)),
            ];

            const results = await Promise.all(promises);

            expect(results).toHaveLength(2);
            expect(results[0][0]).toHaveLength(3); // First sequence
            expect(results[1][0]).toHaveLength(3); // Second sequence
        });
    });

    describe('Error Handling', () => {
        test('should handle corrupted frame data', async () => {
            const corruptedFrames = ['invalid_frame.jpg'];

            // Should not crash, but may return empty results
            const result = await slamPipeline.process_frame_sequence(corruptedFrames);
            expect(result).toBeDefined();
        });

        test('should handle empty frame list gracefully', async () => {
            await expect(
                slamPipeline.process_frame_sequence([])
            ).rejects.toThrow();
        });
    });
});
