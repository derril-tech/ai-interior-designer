import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService as SharedStorageService, StorageConfig } from '@ai-interior-designer/shared';

@Injectable()
export class StorageService extends SharedStorageService {
    constructor(private configService: ConfigService) {
        const config: StorageConfig = {
            endpoint: configService.get('S3_ENDPOINT'),
            region: configService.get('S3_REGION', 'us-east-1'),
            accessKeyId: configService.get('S3_ACCESS_KEY_ID'),
            secretAccessKey: configService.get('S3_SECRET_ACCESS_KEY'),
            bucketName: configService.get('S3_BUCKET_NAME', 'ai-interior-designer'),
        };

        super(config);
    }

    /**
     * Generate upload URL for scan frames
     */
    async getScanUploadUrl(userId: string, roomId: string, scanId: string): Promise<string> {
        const key = SharedStorageService.generateKeys.scanFrames(userId, roomId, scanId);
        return this.getUploadUrl(`${key}frames.zip`, 'application/zip');
    }

    /**
     * Generate download URL for processed mesh
     */
    async getMeshDownloadUrl(userId: string, roomId: string, scanId: string, format: 'gltf' | 'usdz'): Promise<string> {
        const key = SharedStorageService.generateKeys.mesh(userId, roomId, scanId, format);
        return this.getDownloadUrl(key);
    }

    /**
     * Generate upload URL for layout export
     */
    async getExportUploadUrl(userId: string, projectId: string, type: 'pdf' | 'bom' | 'ar'): Promise<{ key: string; url: string }> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const key = SharedStorageService.generateKeys.export(userId, projectId, type, timestamp);
        const url = await this.getUploadUrl(key, this.getContentType(type));

        return { key, url };
    }

    private getContentType(type: string): string {
        const contentTypes: Record<string, string> = {
            pdf: 'application/pdf',
            bom: 'application/json',
            ar: 'model/vnd.usdz+zip',
            gltf: 'model/gltf+json',
            usdz: 'model/vnd.usdz+zip',
            zip: 'application/zip',
        };

        return contentTypes[type] || 'application/octet-stream';
    }
}
