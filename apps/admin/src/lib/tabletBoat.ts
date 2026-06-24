import { boatCoverPhotoSrc } from '@/lib/tabletBoatMedia';
import type { TabletReservationRow } from '@/stores/checkFlow';

type BoatDetailsSlice = {
  dimensions?: { longueur?: string };
  motorisation?: { totalPowerCv?: string };
};

export function parseBoatDetailsJson(json: string | null | undefined): BoatDetailsSlice {
  if (!json?.trim()) return {};
  try {
    return JSON.parse(json) as BoatDetailsSlice;
  } catch {
    return {};
  }
}

export function boatCoverPhoto(reservation: TabletReservationRow): string | null {
  return boatCoverPhotoSrc(reservation.boat);
}

export function formatBoatSpecsLine(boat: TabletReservationRow['boat']): string {
  const details = parseBoatDetailsJson(boat.detailsJson);
  const parts: string[] = [];
  const length = details.dimensions?.longueur?.trim();
  const power = details.motorisation?.totalPowerCv?.trim();
  if (length) parts.push(`${length} m`);
  if (power) parts.push(`${power} cv`);
  if (boat.maxPassengers) parts.push(`${boat.maxPassengers} pers.`);
  return parts.join(' • ');
}

export function formatBoatDisplayName(boat: TabletReservationRow['boat']): string {
  const base = [boat.brand, boat.name].filter(Boolean).join(' ').trim();
  return base || boat.name || 'Bateau';
}
