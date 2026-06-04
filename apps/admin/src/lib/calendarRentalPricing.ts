import type { BoatPriceRow, FleetPriceRow } from '@/stores/boatPricing';
import { resolvePricingSeasonCode, type PricingSeasonCode } from '@/lib/pricingSeasons';

/** Montants effectifs par unité (bateau prioritaire sur flotille). */
export type RateTriple = {
  demiJournee: number | null;
  journee: number | null;
  semaine: number | null;
};

/** Priorité : tarif bateau si défini, sinon tarif flotille. */
export function mergeBoatFleetRates(
  boat: Pick<BoatPriceRow, 'demiJournee' | 'journee' | 'semaine'> | undefined,
  fleet: Pick<FleetPriceRow, 'demiJournee' | 'journee' | 'semaine'> | undefined,
): RateTriple {
  const pick = (b: number | null | undefined, f: number | null | undefined) =>
    b != null && Number.isFinite(b) ? b : f != null && Number.isFinite(f) ? f : null;
  return {
    demiJournee: pick(boat?.demiJournee, fleet?.demiJournee),
    journee: pick(boat?.journee, fleet?.journee),
    semaine: pick(boat?.semaine, fleet?.semaine),
  };
}

/** Au-delà de cette durée sur une même journée facturée au jour, on utilise le tarif « journée ». */
const HALF_DAY_MAX_MINUTES = 5 * 60;

export type CatalogPriceBreakdown = {
  euros: number;
  /** Texte court pour l’UI (ex. « Haute saison · demi-journée »). */
  note: string;
  season: PricingSeasonCode;
};

function parseSlotBounds(dateIso: string, startTime: string, endTime: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso.trim())) return null;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (![sh, sm, eh, em].every((n) => Number.isFinite(n))) return null;
  const baseDay = new Date(`${dateIso}T00:00:00.000`);
  const start = new Date(baseDay);
  start.setHours(sh, sm, 0, 0);
  const end = new Date(baseDay);
  end.setHours(eh, em, 0, 0);
  if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1);
  return { start, end };
}

/**
 * Calcule le montant location (€) à partir des tarifs effectifs (bateau ± flotille)
 * et du créneau horaire.
 */
export function computeCatalogLocationEuros(
  rates: RateTriple | null | undefined,
  dateIso: string,
  startTime: string,
  endTime: string,
): CatalogPriceBreakdown | null {
  if (!rates) return null;

  const bounds = parseSlotBounds(dateIso, startTime, endTime);
  if (!bounds) return null;

  const { start, end } = bounds;
  const diffMs = end.getTime() - start.getTime();
  const diffMinutes = diffMs / 60000;
  const rentalDays = Math.max(1, Math.ceil(diffMs / 86400000));

  const d = rates.demiJournee;
  const j = rates.journee;
  const s = rates.semaine;

  const month = new Date(`${dateIso}T12:00:00.000`).getMonth();
  const season = resolvePricingSeasonCode(month);

  const seasonLabel =
    season === 'HAUTE' ? 'Haute saison'
    : season === 'MOYENNE' ? 'Moyenne saison'
    : 'Basse saison';

  if (rentalDays === 1 && diffMinutes <= HALF_DAY_MAX_MINUTES) {
    if (d == null || !Number.isFinite(d)) return null;
    return { euros: Math.round(d * 100) / 100, note: `${seasonLabel} · demi-journée`, season };
  }

  if (rentalDays === 1) {
    if (j == null || !Number.isFinite(j)) return null;
    return { euros: Math.round(j * 100) / 100, note: `${seasonLabel} · journée`, season };
  }

  const weeks = Math.floor(rentalDays / 7);
  const rem = rentalDays % 7;

  if (weeks > 0 && s != null && Number.isFinite(s) && j != null && Number.isFinite(j)) {
    const euros = weeks * s + rem * j;
    return {
      euros: Math.round(euros * 100) / 100,
      note: `${seasonLabel} · ${weeks} sem. + ${rem} j.`,
      season,
    };
  }

  if (j != null && Number.isFinite(j)) {
    const euros = rentalDays * j;
    return {
      euros: Math.round(euros * 100) / 100,
      note: `${seasonLabel} · ${rentalDays} × journée`,
      season,
    };
  }

  return null;
}
