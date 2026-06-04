import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAX_PRESENTATION_PHOTOS } from '@bleu-calanque/shared';
import { photosWithCoverFirst } from '../../catalog/photo-order';
import { scanBufferWithClamAv } from './clamav.scanner';
import { parseDataUrl, prepareDocumentBuffer, prepareImageBuffer } from './image-security';
import { assertIncomingMediaSize } from './media-compression';
import { createUploadStorageProvider, type StoredImage, type UploadStorageProvider } from './upload-storage';

@Injectable()
export class SecureMediaService {
  private readonly logger = new Logger(SecureMediaService.name);
  private readonly storage: UploadStorageProvider;
  private readonly clamavEnabled: boolean;
  private readonly clamavBinary: string;

  constructor(config: ConfigService) {
    this.storage = createUploadStorageProvider();
    this.clamavEnabled = config.get<string>('CLAMAV_ENABLED', 'false') === 'true';
    this.clamavBinary = config.get<string>('CLAMAV_BINARY', 'clamdscan');
    if (this.storage.name === 's3') {
      this.logger.log('Stockage uploads : S3/R2');
    } else {
      this.logger.log('Stockage uploads : inline (data URL validée)');
    }
  }

  /** Traite une data URL : MIME réel, taille, antivirus, nom unique, stockage. */
  async processDataUrl(dataUrl: string): Promise<StoredImage> {
    const parsed = parseDataUrl(dataUrl);
    assertIncomingMediaSize(parsed.buffer);
    const validated = await prepareImageBuffer(parsed.buffer, parsed.declaredMime, dataUrl);

    try {
      await scanBufferWithClamAv(validated.buffer, {
        enabled: this.clamavEnabled,
        binary: this.clamavBinary,
      });
    } catch {
      throw new BadRequestException('Fichier rejeté par l’analyse antivirus.');
    }

    return this.storage.store(validated);
  }

  /** Photos de présentation bateau / annonce. */
  async processPresentationPhotos(
    urls: string[],
    coverPhotoIndex = 0,
    options?: { retainUrls?: Iterable<string> },
  ): Promise<string[]> {
    if (urls.length > MAX_PRESENTATION_PHOTOS) {
      throw new BadRequestException(`Maximum ${MAX_PRESENTATION_PHOTOS} photos.`);
    }
    const retain = new Set(options?.retainUrls ?? []);
    const ordered = photosWithCoverFirst(urls, coverPhotoIndex);
    const stored: string[] = [];
    for (const url of ordered) {
      const trimmed = url.trim();
      if (!trimmed) continue;
      if (retain.has(trimmed) || trimmed.startsWith('https://')) {
        const kept = await this.assertRetainedPresentationUrl(trimmed);
        stored.push(kept);
        continue;
      }
      const item = await this.processDataUrl(trimmed);
      stored.push(item.publicUrl);
    }
    return stored;
  }

  /** URL déjà en base ou HTTPS externe — pas de re-scan complet à l’enregistrement. */
  private async assertRetainedPresentationUrl(url: string): Promise<string> {
    if (url.startsWith('https://')) {
      const kept = await this.processOptionalImageUrl(url);
      if (!kept) throw new BadRequestException('URL image invalide.');
      return kept;
    }
    if (!/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(url)) {
      throw new BadRequestException('Format image invalide (jpeg, png, webp, gif).');
    }
    return url;
  }

  /** Justificatifs (CNI, permis, badge) — image ou PDF. */
  async processOptionalDocumentUrl(url: string | null | undefined): Promise<string | null> {
    if (url == null || url === '') return null;
    const trimmed = url.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:application/pdf')) {
      const parsed = parseDataUrl(trimmed);
      const validated = await prepareDocumentBuffer(parsed.buffer, parsed.declaredMime, trimmed);
      try {
        await scanBufferWithClamAv(validated.buffer, {
          enabled: this.clamavEnabled,
          binary: this.clamavBinary,
        });
      } catch {
        throw new BadRequestException('Fichier rejeté par l’analyse antivirus.');
      }
      return (await this.storage.store(validated)).publicUrl;
    }

    if (trimmed.startsWith('https://')) {
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'https:') {
          throw new BadRequestException('Seules les URLs HTTPS sont autorisées.');
        }
        if (/\.(php|phtml|phar|jsp|asp|svg|html)(\?|#|$)/i.test(parsed.pathname)) {
          throw new BadRequestException('Extension interdite dans l’URL.');
        }
        return trimmed;
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
        throw new BadRequestException('URL de fichier invalide.');
      }
    }

    throw new BadRequestException('Schéma URL non autorisé (https ou data image/pdf uniquement).');
  }

  /** Avatar, CNI, permis — data URL sécurisée ou HTTPS externe. */
  async processOptionalImageUrl(url: string | null | undefined): Promise<string | null> {
    if (url == null || url === '') return null;
    const trimmed = url.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('data:image/')) {
      return (await this.processDataUrl(trimmed)).publicUrl;
    }

    if (trimmed.startsWith('https://')) {
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'https:') {
          throw new BadRequestException('Seules les URLs HTTPS sont autorisées.');
        }
        if (/\.(php|phtml|phar|jsp|asp|svg|html)(\?|#|$)/i.test(parsed.pathname)) {
          throw new BadRequestException('Extension interdite dans l’URL.');
        }
        return trimmed;
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
        throw new BadRequestException('URL image invalide.');
      }
    }

    throw new BadRequestException('Schéma URL non autorisé (https ou data image uniquement).');
  }
}
