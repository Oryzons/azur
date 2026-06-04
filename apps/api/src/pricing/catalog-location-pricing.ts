import { PricingUnit } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

const HALF_DAY_MAX_MINUTES = 5 * 60;

type RateTriple = {
  demiJournee: number | null;
  journee: number | null;
  semaine: number | null;
};

function seasonCodeFromMonth(month: number): 'BASSE' | 'MOYENNE' | 'HAUTE' {
  if (month >= 5 && month <= 8) return 'HAUTE';
  if (month >= 2 && month <= 4) return 'MOYENNE';
  return 'BASSE';
}

function parseSlotBounds(dateIso: string, startTime: string, endTime: string): { start: Date; end: Date } | null {
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

function centsFromUnit(amountCents: number, unit: PricingUnit): RateTriple {
  const euros = amountCents / 100;
  if (unit === PricingUnit.DEMI_JOURNEE) return { demiJournee: euros, journee: null, semaine: null };
  if (unit === PricingUnit.JOURNEE) return { demiJournee: null, journee: euros, semaine: null };
  return { demiJournee: null, journee: null, semaine: euros };
}

function mergeRates(boat: RateTriple, fleet: RateTriple): RateTriple {
  const pick = (b: number | null, f: number | null) =>
    b != null && Number.isFinite(b) ? b : f != null && Number.isFinite(f) ? f : null;
  return {
    demiJournee: pick(boat.demiJournee, fleet.demiJournee),
    journee: pick(boat.journee, fleet.journee),
    semaine: pick(boat.semaine, fleet.semaine),
  };
}

export function computeCatalogLocationEurosFromRates(
  rates: RateTriple,
  dateIso: string,
  startTime: string,
  endTime: string,
): number | null {
  const bounds = parseSlotBounds(dateIso, startTime, endTime);
  if (!bounds) return null;

  const diffMs = bounds.end.getTime() - bounds.start.getTime();
  const diffMinutes = diffMs / 60000;
  const rentalDays = Math.max(1, Math.ceil(diffMs / 86400000));
  const { demiJournee: d, journee: j, semaine: s } = rates;

  if (rentalDays === 1 && diffMinutes <= HALF_DAY_MAX_MINUTES) {
    if (d == null || !Number.isFinite(d)) return null;
    return Math.round(d * 100) / 100;
  }
  if (rentalDays === 1) {
    if (j == null || !Number.isFinite(j)) return null;
    return Math.round(j * 100) / 100;
  }
  const weeks = Math.floor(rentalDays / 7);
  const rem = rentalDays % 7;
  if (weeks > 0 && s != null && Number.isFinite(s) && j != null && Number.isFinite(j)) {
    return Math.round((weeks * s + rem * j) * 100) / 100;
  }
  if (j != null && Number.isFinite(j)) {
    return Math.round(rentalDays * j * 100) / 100;
  }
  return null;
}

export async function computeBoatSlotCatalogEuros(
  prisma: PrismaService,
  boatId: string,
  dateIso: string,
  startTime: string,
  endTime: string,
): Promise<{ rentalEuros: number | null; depositEuros: number | null }> {
  const boat = await prisma.boat.findUnique({
    where: { id: boatId },
    include: {
      prices: { include: { period: true } },
      fleet: { include: { prices: { include: { period: true } } } },
    },
  });
  if (!boat) return { rentalEuros: null, depositEuros: null };

  const month = new Date(`${dateIso}T12:00:00.000`).getMonth();
  const seasonCode = seasonCodeFromMonth(month);

  const pickPeriodRates = (
    rows: { amountCents: number; unit: PricingUnit; period: { code: string | null } }[],
  ): RateTriple => {
    const filtered = rows.filter((r) => r.period.code === seasonCode);
    let rates: RateTriple = { demiJournee: null, journee: null, semaine: null };
    for (const row of filtered) {
      const part = centsFromUnit(row.amountCents, row.unit);
      rates = mergeRates(rates, part);
    }
    return rates;
  };

  const merged = mergeRates(pickPeriodRates(boat.prices), boat.fleet ? pickPeriodRates(boat.fleet.prices) : { demiJournee: null, journee: null, semaine: null });
  const rentalEuros = computeCatalogLocationEurosFromRates(merged, dateIso, startTime, endTime);

  return {
    rentalEuros,
    depositEuros: boat.depositAmountCents != null ? boat.depositAmountCents / 100 : null,
  };
}
