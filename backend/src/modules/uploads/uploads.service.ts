import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';

/**
 * Cloudinary storage (no card required, 25GB free). Private "authenticated"
 * assets — only reachable via signed URLs. Env:
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *
 * Flow: backend returns a signed upload payload → the app uploads the file
 * DIRECTLY to Cloudinary (no file passes through our server). We store only the
 * returned public_id in the DB.
 */
@Injectable()
export class UploadsService {
  private configured = false;

  private ensure() {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const key = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud || !key || !secret) {
      throw new InternalServerErrorException(
        'File storage is not configured (Cloudinary env vars missing).',
      );
    }
    if (!this.configured) {
      cloudinary.config({
        cloud_name: cloud,
        api_key: key,
        api_secret: secret,
        secure: true,
      });
      this.configured = true;
    }
  }

  isConfigured(): boolean {
    return !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  }

  /** public_id embeds hostel/student so access can be checked by prefix. */
  buildPublicId(hostelId: string, studentId: string, kind: string): string {
    return `${hostelId}/${studentId}/${kind}-${randomUUID()}`;
  }

  /** Signed params the app posts to Cloudinary's upload endpoint. */
  signUpload(publicId: string) {
    this.ensure();
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign: Record<string, any> = {
      public_id: publicId,
      timestamp,
      access_mode: 'authenticated',
    };
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET as string,
    );
    return {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      timestamp,
      publicId,
      accessMode: 'authenticated',
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    };
  }

  /** Permanently delete stored images by public_id (best-effort). */
  async deleteImages(keys: (string | null | undefined)[]): Promise<void> {
    const ids = keys.filter((k): k is string => !!k);
    if (ids.length === 0 || !this.isConfigured()) return;
    this.ensure();
    await Promise.allSettled(
      ids.map((id) =>
        cloudinary.uploader.destroy(id, {
          resource_type: 'image',
          type: 'authenticated',
          invalidate: true,
        }),
      ),
    );
  }

  /** Signed delivery URL for a private asset.
   *  Assets uploaded with access_mode=authenticated are delivered via the
   *  standard `upload` type but REQUIRE a signature — so sign_url:true only. */
  signedViewUrl(publicId: string): string {
    this.ensure();
    return cloudinary.url(publicId, {
      resource_type: 'image',
      secure: true,
      sign_url: true,
    });
  }
}
