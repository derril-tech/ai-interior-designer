import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageConfig {
    endpoint?: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
}

export class StorageService {
    private s3Client: S3Client;
    private bucketName: string;

    constructor(config: StorageConfig) {
        this.bucketName = config.bucketName;

        this.s3Client = new S3Client({
            endpoint: config.endpoint,
            region: config.region,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
            forcePathStyle: !!config.endpoint, // Required for MinIO/R2
        });
    }

    /**
     * Generate a signed URL for uploading a file
     */
    async getUploadUrl(
        key: string,
        contentType: string,
        expiresIn: number = 3600
    ): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            ContentType: contentType,
        });

        return getSignedUrl(this.s3Client, command, { expiresIn });
    }

    /**
     * Generate a signed URL for downloading a file
     */
    async getDownloadUrl(
        key: string,
        expiresIn: number = 3600
    ): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        return getSignedUrl(this.s3Client, command, { expiresIn });
    }

    /**
     * Generate a public URL for a file (if bucket allows public access)
     */
    getPublicUrl(key: string): string {
        if (this.s3Client.config.endpoint) {
            // For MinIO/R2 with custom endpoint
            return `${this.s3Client.config.endpoint}/${this.bucketName}/${key}`;
        }

        // For AWS S3
        const region = this.s3Client.config.region;
        return `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
    }

    /**
     * Generate storage keys for different file types
     */
    static generateKeys = {
        scanFrames: (userId: string, roomId: string, scanId: string) =>
            `scans/${userId}/${roomId}/${scanId}/frames/`,

        mesh: (userId: string, roomId: string, scanId: string, format: 'gltf' | 'usdz') =>
            `meshes/${userId}/${roomId}/${scanId}.${format}`,

        layout: (userId: string, projectId: string, layoutId: string) =>
            `layouts/${userId}/${projectId}/${layoutId}.json`,

        export: (userId: string, projectId: string, type: 'pdf' | 'bom' | 'ar', timestamp: string) =>
            `exports/${userId}/${projectId}/${timestamp}.${type}`,

        productAsset: (vendor: string, sku: string, format: 'gltf' | 'usdz' | 'jpg') =>
            `products/${vendor}/${sku}.${format}`,
    };
}
