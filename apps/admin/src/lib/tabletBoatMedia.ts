import { coverPhotoUrl } from '@/lib/mediaPhotos';
import type { TabletBoatRow } from '@/stores/checkFlow';

/** URL affichable (data URL, HTTPS, chemin absolu). */
export function resolveMediaSrc(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:') || trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  return trimmed;
}

export function boatPresentationPhotos(boat: TabletBoatRow): string[] {
  return (boat.presentationPhotos ?? []).map((u) => resolveMediaSrc(u)).filter(Boolean) as string[];
}

export function boatCoverPhotoSrc(boat: TabletBoatRow): string | null {
  return coverPhotoUrl(boatPresentationPhotos(boat));
}
