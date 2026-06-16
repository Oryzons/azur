import { isPdfDataUrl } from '@/components/contract/DocumentFilePreview';
import { api } from '@/lib/api';

export type BoatLegalDocKey = 'assurance' | 'contratGestion' | 'carteCirculation' | 'annexe240';

function extensionFromUrl(url: string): string {
  if (isPdfDataUrl(url)) return 'pdf';
  const lower = url.toLowerCase();
  if (lower.includes('.pdf')) return 'pdf';
  if (lower.includes('.png')) return 'png';
  if (lower.includes('.webp')) return 'webp';
  if (lower.includes('.gif')) return 'gif';
  return 'jpg';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

/** Télécharge via l’API authentifiée (évite fetch cross-origin). */
export async function downloadBoatLegalDocument(
  boatId: string,
  docKey: BoatLegalDocKey,
  baseFilename: string,
): Promise<void> {
  const res = await api.get(`/boats/${boatId}/legal-docs/${docKey}/download`, {
    responseType: 'blob',
  });
  const disposition = res.headers['content-disposition'] as string | undefined;
  const fromHeader = disposition ? /filename="([^"]+)"/.exec(disposition)?.[1] : undefined;
  const ext = fromHeader?.includes('.') ? fromHeader.split('.').pop()! : 'pdf';
  const filename = baseFilename.includes('.') ? baseFilename : `${baseFilename}.${ext}`;
  downloadBlob(res.data as Blob, fromHeader ?? filename);
}

/** Télécharge depuis une data URL locale (avant enregistrement). */
export async function downloadFileFromUrl(url: string, baseFilename: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) return;

  const ext = extensionFromUrl(trimmed);
  const filename = baseFilename.includes('.') ? baseFilename : `${baseFilename}.${ext}`;

  if (trimmed.startsWith('data:')) {
    const a = document.createElement('a');
    a.href = trimmed;
    a.download = filename;
    a.click();
    return;
  }

  throw new Error('external_url');
}

export function isPersistedBoatId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
