import type { Boat, BoatType } from '@/stores/boats';
import { BOAT_TYPES_UI } from '@/stores/boats';

export function boatTypeLabel(type: BoatType): string {
  return BOAT_TYPES_UI.find((t) => t.value === type)?.label ?? type;
}

export function boatSearchHaystack(
  b: Boat,
  fleetName: string,
  ownerLabel: string,
): string {
  const typeLabel = boatTypeLabel(b.boatType);
  return `${b.name} ${b.brand} ${b.model} ${typeLabel} ${fleetName} ${ownerLabel} ${b.details.generales.emplacement}`.toLowerCase();
}

export function formatDepositEuros(depositEuros: number): string {
  if (!Number.isFinite(depositEuros) || depositEuros <= 0) return '—';
  return `${depositEuros.toLocaleString('fr-FR')} €`;
}
