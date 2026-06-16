import { MAX_INCOMING_MEDIA_BYTES, STORED_IMAGE_MAX_BYTES } from '@bleu-calanque/shared';
import { fileToCompressedDataUrl } from '@/lib/mediaPhotos';

export { STORED_IMAGE_MAX_BYTES as MAX_UPLOAD_IMAGE_BYTES };
export const MAX_UPLOAD_DOCUMENT_BYTES = MAX_INCOMING_MEDIA_BYTES;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(file);
  });
}

/** Image → compression JPEG ; PDF → data URL brute (compression serveur à l’enregistrement). */
export async function fileToUploadDataUrl(file: File): Promise<string> {
  if (file.type.startsWith('image/')) {
    return fileToCompressedDataUrl(file, STORED_IMAGE_MAX_BYTES);
  }
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    if (file.size > MAX_UPLOAD_DOCUMENT_BYTES) {
      throw new Error('pdf_too_large');
    }
    const url = await readFileAsDataUrl(file);
    if (!url.startsWith('data:application/pdf')) {
      throw new Error('pdf_invalid');
    }
    return url;
  }
  throw new Error('unsupported_type');
}

export function documentUploadErrorMessage(err: unknown): string {
  const code = err instanceof Error ? err.message : '';
  if (code === 'pdf_too_large') {
    return `PDF trop volumineux (max. ${Math.round(MAX_UPLOAD_DOCUMENT_BYTES / (1024 * 1024))} Mo).`;
  }
  if (code === 'unsupported_type') {
    return 'Format non pris en charge (JPEG, PNG, WebP ou PDF).';
  }
  if (code === 'not_image') {
    return 'Image invalide.';
  }
  return 'Impossible de traiter le fichier.';
}
