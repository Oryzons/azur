export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fmtTabletTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function fmtTabletDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function isSameCalendarDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}
