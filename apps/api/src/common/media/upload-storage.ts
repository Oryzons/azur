import type { ValidatedImage } from './image-security';
import { bufferToDataUrl } from './image-security';

/** Résultat après stockage (inline aujourd’hui, S3/R2 demain). */
export type StoredImage = {
  mediaId: string;
  storageKey: string;
  mimeType: ValidatedImage['mimeType'];
  sizeBytes: number;
  /** URL consommée par le frontend (data URL ou URL signée). */
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

/**
 * Préparation Cloudflare R2 / S3 — non branché tant que les variables ne sont pas définies.
 * Variables futures : S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_PUBLIC_BASE_URL
 */
export class S3ObjectStorage implements UploadStorageProvider {
  readonly name = 's3' as const;

  async store(_image: ValidatedImage): Promise<StoredImage> {
    throw new Error('Stockage S3/R2 non configuré. Définir S3_BUCKET et credentials.');
  }
}

export function createUploadStorageProvider(): UploadStorageProvider {
  const driver = (process.env.UPLOAD_STORAGE_DRIVER ?? 'inline').toLowerCase();
  if (driver === 's3' || driver === 'r2') {
    return new S3ObjectStorage();
  }
  return new InlineDataUrlStorage();
}
