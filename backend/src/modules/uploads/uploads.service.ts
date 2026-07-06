import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

/**
 * Cloudflare R2 (S3-compatible) storage. Private bucket — access only via
 * short-lived presigned URLs. Env:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 */
@Injectable()
export class UploadsService {
  private client: S3Client | null = null;
  private bucket = process.env.R2_BUCKET ?? '';

  private getClient(): S3Client {
    if (this.client) return this.client;
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!accountId || !accessKeyId || !secretAccessKey || !this.bucket) {
      throw new InternalServerErrorException(
        'File storage is not configured (R2 env vars missing).',
      );
    }
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    return this.client;
  }

  isConfigured(): boolean {
    return !!(
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
    );
  }

  private extFor(contentType: string): string {
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('webp')) return 'webp';
    if (contentType.includes('pdf')) return 'pdf';
    return 'jpg';
  }

  /** Build an object key scoped to hostel/student so access can be checked. */
  buildKey(
    hostelId: string,
    studentId: string,
    kind: string,
    contentType: string,
  ): string {
    return `${hostelId}/${studentId}/${kind}-${randomUUID()}.${this.extFor(contentType)}`;
  }

  async presignPut(key: string, contentType: string): Promise<string> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.getClient(), cmd, { expiresIn: 300 });
  }

  async presignGet(key: string): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.getClient(), cmd, { expiresIn: 300 });
  }
}
