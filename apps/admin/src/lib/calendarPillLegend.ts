import { Baby, Coins, FileText, type LucideIcon } from 'lucide-react';
import { resolveExtraIcon, type ExtraIconKey } from '@bleu-calanque/shared';
import { EXTRA_ICON_LABELS, extraIconComponent } from '@/lib/extraIcons';
import { CALENDAR_STATUS_COLORS } from '@/lib/reservationStatus';
import type { Extra } from '@/stores/extras';

export type CalendarPillLegendItem = {
  key: string;
  label: string;
  Icon: LucideIcon;
  color: string;
};

const FIXED_LEGEND: CalendarPillLegendItem[] = [
  { key: 'installments', label: 'Paiement 2 fois', Icon: Coins, color: '#416B9F' },
  { key: 'children', label: 'Enfants', Icon: Baby, color: '#EC4899' },
  { key: 'internal-note', label: 'Note interne', Icon: FileText, color: '#64748B' },
];

/** Légende des icônes sous les blocs réservation (extras catalogue + indicateurs fixes). */
export function buildCalendarPillLegend(extrasCatalog: readonly Extra[]): CalendarPillLegendItem[] {
  const byIcon = new Map<ExtraIconKey, string>();
  for (const extra of extrasCatalog) {
    if (!extra.enabled) continue;
    const iconKey = resolveExtraIcon(extra.icon);
    if (!byIcon.has(iconKey)) {
      byIcon.set(iconKey, EXTRA_ICON_LABELS[iconKey]);
    }
  }

  const extraItems: CalendarPillLegendItem[] = [...byIcon.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'fr'))
    .map(([iconKey, label]) => ({
      key: `extra-${iconKey}`,
      label,
      Icon: extraIconComponent(iconKey),
      color: CALENDAR_STATUS_COLORS.reserved,
    }));

  return [...FIXED_LEGEND, ...extraItems];
}
