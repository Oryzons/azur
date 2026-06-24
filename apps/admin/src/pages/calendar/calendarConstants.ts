import type { Reservation } from '@/pages/calendar/reservationTypes';

export const PRIMARY = '#416B9F';

/** MIME pour le réordonnancement des lignes bateau (évite le conflit avec `text/reservationId`). */
export const CALENDAR_BOAT_ROW_DRAG_MIME = 'application/x-bleu-calanque-calendar-boat-row';

export const BOAT_COL_W = 220;
export const ROW_H = 64;
export const PILL_MIN_H = 28;
export const PILL_LANE_GAP = 3;
export const DAY_COL_W = 62;
export const SLOT_COL_W = 22;

export type ViewMode = 'month' | 'week' | 'day';

export function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export function formatTime(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Date locale au format `YYYY-MM-DD` (sans décalage UTC). */
export function dayToIso(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseDayIso(iso: string) {
  return startOfDay(new Date(`${iso}T12:00:00.000`));
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Libellé période pour la barre calendrier (ex. « 01–07 janvier 2026 »). */
export function formatCalendarToolbarPeriod(
  view: ViewMode,
  periodStart: Date,
  periodEndExclusive: Date,
  cursorDate?: Date,
): string {
  const start = startOfDay(periodStart);
  const endInclusive = addDays(startOfDay(periodEndExclusive), -1);

  if (view === 'day') {
    const d = cursorDate ? startOfDay(cursorDate) : start;
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  if (view === 'month') {
    const d = startOfMonth(cursorDate ?? periodStart);
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  const sameMonth =
    start.getMonth() === endInclusive.getMonth() && start.getFullYear() === endInclusive.getFullYear();

  if (sameMonth) {
    const monthYear = start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return `${pad2(start.getDate())}–${pad2(endInclusive.getDate())} ${monthYear}`;
  }

  const startPart = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const endPart = endInclusive.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${startPart} – ${endPart}`;
}

export function isTodayInCalendarPeriod(periodStart: Date, periodEndExclusive: Date): boolean {
  const today = startOfDay(new Date());
  return today >= startOfDay(periodStart) && today < startOfDay(periodEndExclusive);
}

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function startOfWeekMonday(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0=dim
  const diff = (day + 6) % 7; // monday=0
  return addDays(x, -diff);
}

export function endOfWeekSunday(d: Date) {
  const start = startOfWeekMonday(d);
  return addDays(start, 6);
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

export function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function assignLanes<T>(
  items: T[],
  getStart: (t: T) => number,
  /** Fin exclusive (colonne / jour suivant non occupé). */
  getEndExclusive: (t: T) => number,
): { lanes: number; laneByIndex: number[] } {
  const laneEnds: number[] = [];
  const laneByIndex: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const s = getStart(item);
    let lane = 0;
    while (lane < laneEnds.length) {
      const laneEnd = laneEnds[lane];
      if (laneEnd === undefined) break;
      if (s >= laneEnd) break;
      lane++;
    }
    const e = getEndExclusive(item);
    if (lane === laneEnds.length) laneEnds.push(e);
    else laneEnds[lane] = e;
    laneByIndex[i] = lane;
  }
  return { lanes: laneEnds.length, laneByIndex };
}

/** Hauteur de ligne et hauteur de pillule selon le nombre de couloirs empilés. */
export function planningRowMetrics(laneCount: number) {
  const lanes = Math.max(1, laneCount);
  const barH = Math.max(PILL_MIN_H, Math.floor((ROW_H - (lanes - 1) * PILL_LANE_GAP) / lanes));
  const rowHeight = Math.max(ROW_H, lanes * barH + (lanes - 1) * PILL_LANE_GAP);
  return { barH, rowHeight, laneCount: lanes };
}

export function segmentLabel(r: Reservation, mode: ViewMode) {
  const sameDay = startOfDay(r.start).getTime() === startOfDay(r.end).getTime();
  if (mode === 'month' || mode === 'week') {
    if (sameDay) return r.title;
    return `${r.title} · ${formatTime(r.start)} → ${formatTime(r.end)}`;
  }
  return `${formatTime(r.start)}–${formatTime(r.end)} · ${r.title}`;
}

/** Libellé minimal pour l’espace propriétaire (date + horaires uniquement). */
export function ownerSegmentLabel(r: Reservation, mode: ViewMode) {
  const sameDay = startOfDay(r.start).getTime() === startOfDay(r.end).getTime();
  if (mode === 'day') {
    return `${formatTime(r.start)}–${formatTime(r.end)}`;
  }
  if (sameDay) return `${formatTime(r.start)}–${formatTime(r.end)}`;
  const startDay = r.start.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const endDay = r.end.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  return `${startDay} ${formatTime(r.start)} → ${endDay} ${formatTime(r.end)}`;
}

export function dayHeaderLabel(d: Date) {
  const wd = ['L', 'M', 'M', 'J', 'V', 'S', 'D'][(d.getDay() + 6) % 7];
  return `${wd} ${d.getDate()}`;
}

export function weekdayShort(d: Date) {
  return ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'][(d.getDay() + 6) % 7];
}

export function isWeekendDay(d: Date) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function monthTitle(d: Date) {
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export function minutesSince(start: Date, d: Date) {
  return Math.round((d.getTime() - start.getTime()) / 60000);
}

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function minutesToHHmmFrom(base: Date, minutesFromBase: number) {
  const t = new Date(base.getTime() + minutesFromBase * 60000);
  return `${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
}
