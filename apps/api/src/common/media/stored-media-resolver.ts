import { BadRequestException } from '@nestjs/common';
import { parseDataUrl } from './image-security';

export type ResolvedStoredMedia = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
};

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

function extensionFromMime(mime: string): string {
  return MIME_EXT[mime.toLowerCase()] ?? 'bin';
}

function assertAllowedHttpsUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException('URL média invalide.');
  }
  if (parsed.protocol !== 'https:') {
    throw new BadRequestException('Seules les URLs HTTPS sont autorisées.');
  }
  if (/\.(php|phtml|phar|jsp|asp|svg|html)(\?|#|$)/i.test(parsed.pathname)) {
    throw new BadRequestException('Extension interdite.');
  }
  return parsed;
}

/** Décode une data URL ou récupère un fichier HTTPS stocké (S3/R2). */
export async function resolveStoredMediaUrl(url: string): Promise<ResolvedStoredMedia> {
  const trimmed = url.trim();
  if (!trimmed) throw new BadRequestException('Fichier introuvable.');

  if (trimmed.startsWith('data:')) {
    const parsed = parseDataUrl(trimmed);
    return {
      buffer: parsed.buffer,
      mimeType: parsed.declaredMime,
      extension: extensionFromMime(parsed.declaredMime),
    };
  }

  if (trimmed.startsWith('https://')) {
    assertAllowedHttpsUrl(trimmed);
    const res = await fetch(trimmed);
    if (!res.ok) throw new BadRequestException('Fichier stocké inaccessible.');
    const buffer = Buffer.from(await res.arrayBuffer());
    const mimeType = (res.headers.get('content-type') ?? 'application/octet-stream').split(';')[0]!.trim();
    return {
      buffer,
      mimeType,
      extension: extensionFromMime(mimeType),
    };
  }

  throw new BadRequestException('Schéma URL non autorisé.');
}

export function legalDocDownloadFilename(docKey: string, extension: string): string {
  const slug = docKey.replaceAll(/([A-Z])/g, '-$1').toLowerCase();
  return `bateau-${slug}.${extension}`;
}
