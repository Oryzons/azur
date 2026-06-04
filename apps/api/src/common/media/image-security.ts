import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AllowedDocumentMime, AllowedImageMime, AllowedPdfMime } from '@bleu-calanque/shared';
import { ALLOWED_IMAGE_MIME_TYPES, ALLOWED_PDF_MIME } from '@bleu-calanque/shared';
import { assertIncomingMediaSize, compressDocumentBuffer, compressImageForStorage } from './media-compression';

const DANGEROUS_CONTENT = [
  Buffer.from('<?php'),
  Buffer.from('<%'),
  Buffer.from('<script'),
  Buffer.from('javascript:'),
  Buffer.from('#!/'),
];

const BLOCKED_EXTENSIONS = /\.(php|phtml|phar|jsp|asp|aspx|cgi|svg|html|htm|exe|sh|bat)(\?|#|$)/i;

export type ParsedDataUrl = {
  declaredMime: string;
  buffer: Buffer;
};

export type ValidatedImage = {
  mediaId: string;
  mimeType: AllowedDocumentMime;
  sizeBytes: number;
  buffer: Buffer;
  storageKey: string;
  extension: string;
};

const MIME_TO_EXT: Record<AllowedDocumentMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  [ALLOWED_PDF_MIME]: 'pdf',
};

export function detectPdfMimeFromBuffer(buffer: Buffer): AllowedPdfMime | null {
  if (buffer.length < 5) return null;
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') return null;
  return ALLOWED_PDF_MIME;
}

export function parseDataUrl(dataUrl: string): ParsedDataUrl {
  const trimmed = dataUrl.trim();
  const match = /^data:([^;,]+)?(?:;[^,]*)?;base64,(.+)$/i.exec(trimmed);
  if (!match?.[2]) {
    throw new BadRequestException('Data URL invalide.');
  }
  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[2], 'base64');
  } catch {
    throw new BadRequestException('Contenu base64 invalide.');
  }
  if (!buffer.length) {
    throw new BadRequestException('Fichier vide.');
  }
  return { declaredMime: (match[1] ?? '').toLowerCase(), buffer };
}

export function detectImageMimeFromBuffer(buffer: Buffer): AllowedImageMime | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return 'image/gif';
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

function normalizeDeclaredMime(mime: string): AllowedImageMime | null {
  const m = mime.toLowerCase();
  if (m === 'image/jpg' || m === 'image/jpeg') return 'image/jpeg';
  if (m === 'image/png') return 'image/png';
  if (m === 'image/webp') return 'image/webp';
  if (m === 'image/gif') return 'image/gif';
  return null;
}

export function assertNoDangerousContent(buffer: Buffer, original: string): void {
  if (BLOCKED_EXTENSIONS.test(original)) {
    throw new BadRequestException('Extension de fichier interdite.');
  }
  const sample = buffer.subarray(0, Math.min(buffer.length, 64_000));
  const lower = sample.toString('latin1').toLowerCase();
  if (lower.includes('<?php') || lower.includes('<script') || lower.includes('javascript:')) {
    throw new BadRequestException('Contenu de fichier interdit.');
  }
  for (const sig of DANGEROUS_CONTENT) {
    if (sample.includes(sig)) {
      throw new BadRequestException('Contenu de fichier interdit.');
    }
  }
}

function buildValidatedImage(buffer: Buffer, mimeType: AllowedDocumentMime): ValidatedImage {
  const mediaId = randomUUID();
  const extension = MIME_TO_EXT[mimeType];
  const storageKey = `media/${mediaId}.${extension}`;
  return {
    mediaId,
    mimeType,
    sizeBytes: buffer.length,
    buffer,
    storageKey,
    extension,
  };
}

export function validatePdfBuffer(buffer: Buffer, declaredMimeRaw: string, original: string): ValidatedImage {
  const detected = detectPdfMimeFromBuffer(buffer);
  if (!detected) {
    assertNoDangerousContent(buffer, original);
    throw new BadRequestException('Fichier PDF invalide ou corrompu.');
  }
  const declared = declaredMimeRaw.toLowerCase() === ALLOWED_PDF_MIME ? ALLOWED_PDF_MIME : null;
  if (declared && declared !== detected) {
    throw new BadRequestException('Le type déclaré ne correspond pas au contenu réel du fichier.');
  }
  return buildValidatedImage(buffer, detected);
}

/** Image ou PDF (justificatifs contrat) — compression puis validation. */
export async function prepareDocumentBuffer(
  buffer: Buffer,
  _declaredMimeRaw: string,
  original: string,
): Promise<ValidatedImage> {
  const { buffer: compressed, mimeType } = await compressDocumentBuffer(buffer);
  if (mimeType === ALLOWED_PDF_MIME) {
    return validatePdfBuffer(compressed, ALLOWED_PDF_MIME, original);
  }
  const detected = detectImageMimeFromBuffer(compressed) ?? 'image/jpeg';
  return validateImageBuffer(compressed, detected, original);
}

/** Image — compression puis validation. */
export async function prepareImageBuffer(
  buffer: Buffer,
  declaredMimeRaw: string,
  original: string,
): Promise<ValidatedImage> {
  assertIncomingMediaSize(buffer);
  const detected = detectImageMimeFromBuffer(buffer);
  if (!detected) {
    assertNoDangerousContent(buffer, original);
    throw new BadRequestException('Type MIME réel non reconnu ou fichier corrompu.');
  }
  const compressed = await compressImageForStorage(buffer);
  const outMime = detectImageMimeFromBuffer(compressed) ?? 'image/jpeg';
  return validateImageBuffer(compressed, outMime, original);
}

export function validateImageBuffer(buffer: Buffer, declaredMimeRaw: string, original: string): ValidatedImage {
  const detected = detectImageMimeFromBuffer(buffer);
  if (!detected) {
    // Ne pas scanner le binaire des images reconnues : faux positifs fréquents (PNG/JPEG).
    assertNoDangerousContent(buffer, original);
    throw new BadRequestException('Type MIME réel non reconnu ou fichier corrompu.');
  }

  const declared = normalizeDeclaredMime(declaredMimeRaw);
  if (declared && declared !== detected) {
    throw new BadRequestException('Le type déclaré ne correspond pas au contenu réel du fichier.');
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(detected)) {
    throw new BadRequestException('Format image non autorisé.');
  }

  return buildValidatedImage(buffer, detected);
}

export function bufferToDataUrl(buffer: Buffer, mimeType: AllowedDocumentMime): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}
