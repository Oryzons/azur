/** Met la photo de couverture en première position (sortOrder 0 en base). */
export function photosWithCoverFirst(urls: string[], coverPhotoIndex = 0): string[] {
  if (urls.length <= 1) return [...urls];
  const idx = Math.min(Math.max(0, coverPhotoIndex), urls.length - 1);
  if (idx === 0) return [...urls];
  const next = [...urls];
  const [cover] = next.splice(idx, 1);
  return [cover, ...next];
}

export function movePhotoToCover(urls: string[], index: number): string[] {
  return photosWithCoverFirst(urls, index);
}

export function coverPhotoUrl(urls: string[]): string | null {
  return urls[0] ?? null;
}

export const MAX_PRESENTATION_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 1_500_000;

function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.ceil((base64.length * 3) / 4);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(file);
  });
}

async function loadImageSource(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; dispose?: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      /* fallback Image */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode'));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function scaledDimensions(width: number, height: number, maxSide: number): { width: number; height: number } {
  if (width <= maxSide && height <= maxSide) return { width, height };
  const ratio = Math.min(maxSide / width, maxSide / height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/**
 * Réduit une image (JPEG) jusqu’à ~maxBytes. Les fichiers déjà légers sont conservés tels quels.
 */
export async function fileToCompressedDataUrl(file: File, maxBytes = MAX_PHOTO_BYTES): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('not_image');
  }
  if (file.size <= maxBytes) {
    const raw = await readFileAsDataUrl(file);
    if (raw && dataUrlByteLength(raw) <= maxBytes) return raw;
  }

  const { source, width, height, dispose } = await loadImageSource(file);
  try {
    let maxSide = Math.min(2560, Math.max(width, height));
    let quality = 0.9;
    let best = '';

    for (let attempt = 0; attempt < 24; attempt += 1) {
      const { width: w, height: h } = scaledDimensions(width, height, maxSide);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(source, 0, 0, w, h);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const bytes = dataUrlByteLength(dataUrl);
      if (!best || bytes < dataUrlByteLength(best)) best = dataUrl;
      if (bytes <= maxBytes) return dataUrl;

      if (quality > 0.45) {
        quality = Math.max(0.45, quality - 0.08);
      } else if (maxSide > 360) {
        maxSide = Math.round(maxSide * 0.82);
        quality = 0.82;
      } else {
        break;
      }
    }

    return best;
  } finally {
    dispose?.();
  }
}

export async function readImageFilesAsDataUrls(files: FileList | null): Promise<{ urls: string[]; error?: string }> {
  if (!files?.length) return { urls: [] };
  const next: string[] = [];
  for (const f of Array.from(files)) {
    if (!f.type.startsWith('image/')) continue;
    try {
      const dataUrl = await fileToCompressedDataUrl(f);
      if (dataUrl) next.push(dataUrl);
    } catch {
      return { urls: [], error: 'Impossible de traiter certaines images.' };
    }
  }
  return { urls: next };
}
