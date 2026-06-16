import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ValidatedImage } from './image-security';
import { bufferToDataUrl } from './image-security';

/** Résultat après stockage (inline ou S3/R2). */
export type StoredImage = {
  mediaId: string;
  storageKey: string;
  mimeType: ValidatedImage['mimeType'];
  sizeBytes: number;
  /** URL consommée par le frontend (data URL ou URL publique). */
  publicUrl: string;
  provider: 'inline' | 's3';
};

export interface UploadStorageProvider {
  readonly name: 'inline' | 's3';
  store(image: ValidatedImage): Promise<StoredImage>;
}

/** MVP : data URL normalisée en base (champ `url` Prisma). */
export class InlineDataUrlStorage implements UploadStorageProvider {
  readonly name = 'inline' as const;

  async store(image: ValidatedImage): Promise<StoredImage> {
    return {
      mediaId: image.mediaId,
      storageKey: image.storageKey,
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      publicUrl: bufferToDataUrl(image.buffer, image.mimeType),
      provider: 'inline',
    };
  }
}

/** Cloudflare R2 / S3-compatible object storage. */
export class S3ObjectStorage implements UploadStorageProvider {
  readonly name = 's3' as const;
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor() {
    const bucket = process.env.S3_BUCKET?.trim();
    const accessKey = process.env.S3_ACCESS_KEY?.trim();
    const secretKey = process.env.S3_SECRET_KEY?.trim();
    const publicBase = process.env.S3_PUBLIC_BASE_URL?.trim();

    if (!bucket || !accessKey || !secretKey || !publicBase) {
      throw new Error(
        'Stockage S3/R2 : définir S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY et S3_PUBLIC_BASE_URL.',
      );
    }

    this.bucket = bucket;
    this.publicBaseUrl = publicBase.replace(/\/$/, '');
    const endpoint = process.env.S3_ENDPOINT?.trim();
    const region = process.env.S3_REGION?.trim() || 'auto';

    this.client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: Boolean(endpoint),
    });
  }

  async store(image: ValidatedImage): Promise<StoredImage> {
    const key = `uploads/${image.storageKey}.${image.extension}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: image.buffer,
        ContentType: image.mimeType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return {
      mediaId: image.mediaId,
      storageKey: image.storageKey,
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      publicUrl: `${this.publicBaseUrl}/${key}`,
      provider: 's3',
    };
  }
}

export function createUploadStorageProvider(): UploadStorageProvider {
  const driver = (process.env.UPLOAD_STORAGE_DRIVER ?? 'inline').toLowerCase();
  if (driver === 's3' || driver === 'r2') {
    return new S3ObjectStorage();
  }
  return new InlineDataUrlStorage();
}
