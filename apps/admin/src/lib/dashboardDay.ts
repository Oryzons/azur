import { addDays, startOfDay } from '@/pages/calendar/calendarConstants';

export type DashboardDayView = 'today' | 'tomorrow';

export function dayToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function resolveDashboardFocusDay(view: DashboardDayView, anchor = new Date()): Date {
  const today = startOfDay(anchor);
  return view === 'today' ? today : addDays(today, 1);
}

export function formatDashboardDayTitle(d: Date, view: DashboardDayView): string {
  if (view === 'today') {
    return "Aujourd'hui";
  }
  const tomorrow = addDays(startOfDay(new Date()), 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();
  if (isTomorrow) return 'Demain';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
