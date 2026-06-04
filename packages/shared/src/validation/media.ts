import { z } from 'zod';

/** Taille cible après compression serveur (images stockées). */
export const STORED_IMAGE_MAX_BYTES = 1_572_864;

/** @deprecated Utiliser STORED_IMAGE_MAX_BYTES */
export const MAX_UPLOAD_IMAGE_BYTES = STORED_IMAGE_MAX_BYTES;

/** Taille cible après compression serveur (PDF stockés). */
export const STORED_PDF_MAX_BYTES = 2_097_152;

/** @deprecated Utiliser STORED_PDF_MAX_BYTES */
export const MAX_UPLOAD_PDF_BYTES = STORED_PDF_MAX_BYTES;

/** Limite d’envoi brut (le serveur compresse avant stockage). */
export const MAX_INCOMING_MEDIA_BYTES = 20 * 1024 * 1024;

export const MAX_INCOMING_MEDIA_DATA_URL_LENGTH =
  Math.ceil(MAX_INCOMING_MEDIA_BYTES * (4 / 3)) + 512;

/** Taille max chaîne data URL après compression (réponse / relecture). */
export const MAX_PHOTO_DATA_URL_LENGTH =
  Math.ceil(STORED_IMAGE_MAX_BYTES * (4 / 3)) + 256;

export const MAX_PRESENTATION_PHOTOS = 8;

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const ALLOWED_PDF_MIME = 'application/pdf' as const;
export type AllowedPdfMime = typeof ALLOWED_PDF_MIME;
export type AllowedDocumentMime = AllowedImageMime | AllowedPdfMime;

const IMAGE_DATA_URL_PREFIX = /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i;
const DOCUMENT_DATA_URL_PREFIX =
  /^data:(image\/(jpeg|jpg|png|webp|gif)|application\/pdf);base64,/i;

const BLOCKED_EXTENSIONS = /\.(php|phtml|phar|jsp|asp|aspx|cgi|svg|html|htm|exe|sh|bat)(\?|$)/i;

/** Signature canvas (PNG) — taille réduite. */
export const MAX_SIGNATURE_DATA_URL_LENGTH = 400_000;

export const signatureDataUrlSchema = z
  .string()
  .max(MAX_SIGNATURE_DATA_URL_LENGTH, 'Signature trop volumineuse')
  .refine((s) => /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(s), 'Signature invalide');

export const photoDataUrlSchema = z
  .string()
  .max(MAX_INCOMING_MEDIA_DATA_URL_LENGTH, 'Fichier invalide')
  .refine((s) => IMAGE_DATA_URL_PREFIX.test(s), 'Format image invalide (jpeg, png, webp, gif)')
  .refine((s) => !BLOCKED_EXTENSIONS.test(s), 'Extension de fichier interdite');

export const presentationPhotosSchema = z
  .array(photoDataUrlSchema)
  .max(MAX_PRESENTATION_PHOTOS, `Maximum ${MAX_PRESENTATION_PHOTOS} photos`)
  .optional();

export const coverPhotoIndexSchema = z.number().int().min(0).max(MAX_PRESENTATION_PHOTOS - 1).optional();

/** Avatar / pièce d’identité : data URL validée côté serveur ou HTTPS externe. */
export const optionalImageUrlSchema = z
  .union([
    z
      .string()
      .url()
      .max(2048)
      .refine((u) => u.startsWith('https://'), 'Seules les URLs HTTPS sont autorisées')
      .refine((u) => !BLOCKED_EXTENSIONS.test(u), 'Extension interdite'),
    photoDataUrlSchema,
    z.null(),
  ])
  .optional();

/** Justificatifs contrat (CNI, permis, badge) : image ou PDF. */
export const documentDataUrlSchema = z
  .string()
  .max(MAX_INCOMING_MEDIA_DATA_URL_LENGTH, 'Fichier invalide')
  .refine((s) => DOCUMENT_DATA_URL_PREFIX.test(s), 'Format invalide (jpeg, png, webp, gif ou pdf)')
  .refine((s) => !BLOCKED_EXTENSIONS.test(s), 'Extension de fichier interdite');

export const optionalDocumentUrlSchema = z
  .union([
    z
      .string()
      .url()
      .max(2048)
      .refine((u) => u.startsWith('https://'), 'Seules les URLs HTTPS sont autorisées')
      .refine((u) => !BLOCKED_EXTENSIONS.test(u), 'Extension interdite'),
    documentDataUrlSchema,
    z.null(),
  ])
  .optional();
