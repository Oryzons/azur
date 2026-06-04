/** Ouvre un PDF blob dans un nouvel onglet (aperçu navigateur). */
export function openPdfBlobInNewTab(data: BlobPart, mimeType = 'application/pdf') {
  const url = URL.createObjectURL(new Blob([data], { type: mimeType }));
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    URL.revokeObjectURL(url);
    return false;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return true;
}

export function downloadPdfBlob(data: BlobPart, filename: string) {
  const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function filenameFromContentDisposition(disposition: string | undefined, fallback: string) {
  if (!disposition) return fallback;
  const match = /filename="([^"]+)"/.exec(disposition);
  return match?.[1] ?? fallback;
}
