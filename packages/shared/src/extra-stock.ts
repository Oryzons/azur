/** Disponibilité d'un extra sur un créneau (stock journalier − réservations du même jour). */
export type ExtraAvailability = {
  stock: number | null;
  /** Quantité déjà réservée sur le jour le plus chargé du créneau. */
  reserved: number;
  /** `null` = stock illimité. */
  remaining: number | null;
};

export function formatExtraRemainingLabel(remaining: number): string {
  return remaining <= 1 ? `${remaining} restant ce jour` : `${remaining} restants ce jour`;
}

export function startOfCalendarDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfCalendarDay(d: Date): Date {
  const x = startOfCalendarDay(d);
  x.setDate(x.getDate() + 1);
  return x;
}

/** Jours civils couverts par un créneau [start, end) (fin exclusive). */
export function calendarDaysInRange(startAt: Date, endAt: Date): Date[] {
  const days: Date[] = [];
  let cur = startOfCalendarDay(startAt);
  const last = startOfCalendarDay(endAt);
  while (cur.getTime() <= last.getTime()) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export function reservationOverlapsCalendarDay(
  reservationStart: Date,
  reservationEnd: Date,
  day: Date,
): boolean {
  const dayStart = startOfCalendarDay(day);
  const dayEnd = endOfCalendarDay(day);
  return reservationStart < dayEnd && reservationEnd > dayStart;
}

type ExtraStockLine = { extraId: string; quantity: number };

export type ExtraStockSlot = {
  startAt: Date;
  endAt: Date;
  lines: ExtraStockLine[];
};

type ReservationForDailyStock = {
  startAt: Date;
  endAt: Date;
  extras: ExtraStockLine[];
};

/**
 * Quantité maximale d'un extra déjà consommée sur un même jour civil
 * (réservations + locations d'extras seules).
 */
export function maxDailyExtraReservedFromSlots(input: {
  days: Date[];
  slots: ExtraStockSlot[];
  extraId: string;
}): number {
  let max = 0;
  for (const day of input.days) {
    let sum = 0;
    for (const slot of input.slots) {
      if (!reservationOverlapsCalendarDay(slot.startAt, slot.endAt, day)) continue;
      for (const line of slot.lines) {
        if (line.extraId !== input.extraId) continue;
        sum += line.quantity > 0 ? line.quantity : 1;
      }
    }
    if (sum > max) max = sum;
  }
  return max;
}

/**
 * Quantité maximale d'un extra déjà réservée sur un même jour civil
 * (parmi les jours couverts par le créneau demandé).
 */
export function maxDailyExtraReserved(input: {
  days: Date[];
  reservations: ReservationForDailyStock[];
  extraId: string;
}): number {
  return maxDailyExtraReservedFromSlots({
    days: input.days,
    slots: input.reservations.map((r) => ({
      startAt: r.startAt,
      endAt: r.endAt,
      lines: r.extras,
    })),
    extraId: input.extraId,
  });
}
