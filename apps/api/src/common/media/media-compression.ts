import { BadRequestException } from '@nestjs/common';
import {
  ALLOWED_PDF_MIME,
  MAX_INCOMING_MEDIA_BYTES,
  STORED_IMAGE_MAX_BYTES,
  STORED_PDF_MAX_BYTES,
} from '@bleu-calanque/shared';
import sharp from 'sharp';
import type { AllowedDocumentMime, AllowedImageMime } from '@bleu-calanque/shared';
import { detectImageMimeFromBuffer, detectPdfMimeFromBuffer } from './image-security';

const JPEG_MIME = 'image/jpeg' as const;

async function encodeJpeg(
  buffer: Buffer,
  maxEdge: number,
  quality: number,
): Promise<Buffer> {
  return sharp(buffer, { failOn: 'none', animated: false })
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

/** Réduit une image jusqu’à la taille cible, en conservant une lisibilité correcte. */
export async function compressImageForStorage(
  buffer: Buffer,
  targetBytes = STORED_IMAGE_MAX_BYTES,
): Promise<Buffer> {
  if (buffer.length <= targetBytes) return buffer;

  let maxEdge = 2560;
  let quality = 88;
  let best = buffer;

  for (let attempt = 0; attempt < 28; attempt += 1) {
    const out = await encodeJpeg(buffer, maxEdge, quality);
    if (!best || out.length < best.length) best = out;
    if (out.length <= targetBytes) return out;

    if (quality > 52) {
      quality = Math.max(52, quality - 8);
    } else if (maxEdge > 480) {
      maxEdge = Math.round(maxEdge * 0.82);
      quality = 86;
    } else {
      break;
    }
  }

  return best;
}

/** PDF volumineux : conversion JPEG multi-pages (sharp) puis compression. */
async function pdfToJpegBuffer(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { density: 144, failOn: 'none' })
    .rotate()
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

export async function compressPdfForStorage(
  buffer: Buffer,
  targetBytes = STORED_PDF_MAX_BYTES,
): Promise<{ buffer: Buffer; mimeType: typeof ALLOWED_PDF_MIME | typeof JPEG_MIME }> {
  if (buffer.length <= targetBytes) {
    return { buffer, mimeType: ALLOWED_PDF_MIME };
  }

  try {
    const jpeg = await compressImageForStorage(await pdfToJpegBuffer(buffer), targetBytes);
    return { buffer: jpeg, mimeType: JPEG_MIME };
  } catch {
    if (buffer.length <= MAX_INCOMING_MEDIA_BYTES) {
      return { buffer, mimeType: ALLOWED_PDF_MIME };
    }
    throw new BadRequestException(
      'Ce PDF n’a pas pu être optimisé automatiquement. Réessayez avec une photo (JPEG/PNG) ou un PDF plus léger.',
    );
  }
}

export function assertIncomingMediaSize(buffer: Buffer): void {
  if (buffer.length > MAX_INCOMING_MEDIA_BYTES) {
    throw new BadRequestException(
      'Fichier trop volumineux pour être envoyé. Utilisez une photo ou un scan plus court.',
    );
  }
}

export async function compressDocumentBuffer(
  buffer: Buffer,
  opts?: { imageTargetBytes?: number; pdfTargetBytes?: number },
): Promise<{ buffer: Buffer; mimeType: AllowedDocumentMime }> {
  assertIncomingMediaSize(buffer);

  const imageTarget = opts?.imageTargetBytes ?? STORED_IMAGE_MAX_BYTES;
  const pdfTarget = opts?.pdfTargetBytes ?? STORED_PDF_MAX_BYTES;

  if (detectPdfMimeFromBuffer(buffer)) {
    return compressPdfForStorage(buffer, pdfTarget);
  }

  const detected = detectImageMimeFromBuffer(buffer);
  if (!detected) {
    throw new BadRequestException('Type de fichier non reconnu.');
  }

  const compressed = await compressImageForStorage(buffer, imageTarget);
  const outMime = detectImageMimeFromBuffer(compressed) ?? JPEG_MIME;
  const mimeType: AllowedDocumentMime =
    outMime === JPEG_MIME || compressed.length < buffer.length ? JPEG_MIME : outMime;
  return { buffer: compressed, mimeType };
}
