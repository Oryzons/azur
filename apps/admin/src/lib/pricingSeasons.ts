/** Codes des 3 périodes saisonnières (tarifs). */
export type PricingSeasonCode = 'BASSE' | 'MOYENNE' | 'HAUTE';

export const PRICING_SEASON_CODES: PricingSeasonCode[] = ['BASSE', 'MOYENNE', 'HAUTE'];

export const PRICING_MONTH_LABELS = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Août',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
] as const;

export const PRICING_SEASON_UI: Record<
  PricingSeasonCode,
  { title: string; shortLabel: string; subtitle: string; monthsHint: string }
> = {
  BASSE: {
    title: 'Basse saison',
    shortLabel: 'Basse',
    subtitle: 'Janvier, février, novembre et décembre, plus les mois non couverts par les autres saisons.',
    monthsHint: 'Janv. · Fév. · Nov. · Déc.',
  },
  MOYENNE: {
    title: 'Moyenne saison',
    shortLabel: 'Moyenne',
    subtitle: 'Inter-saison : mars à mai, et octobre.',
    monthsHint: 'Mars · Avr. · Mai · Oct.',
  },
  HAUTE: {
    title: 'Haute saison',
    shortLabel: 'Haute',
    subtitle: 'Plein été : juin à septembre.',
    monthsHint: 'Juin · Juil. · Août · Sep.',
  },
};

export const PRICING_SEASON_THEME: Record<
  PricingSeasonCode,
  { pill: string; pillActive: string; month: string; monthActive: string; ring: string; dot: string }
> = {
  BASSE: {
    pill: 'border-sky-200 bg-sky-50 text-sky-900',
    pillActive: 'border-sky-500 bg-sky-600 text-white shadow-sm',
    month: 'bg-sky-100 text-sky-800 border-sky-200',
    monthActive: 'bg-sky-600 text-white border-sky-600 ring-2 ring-sky-300',
    ring: 'ring-sky-400',
    dot: 'bg-sky-500',
  },
  MOYENNE: {
    pill: 'border-amber-200 bg-amber-50 text-amber-950',
    pillActive: 'border-amber-500 bg-amber-600 text-white shadow-sm',
    month: 'bg-amber-100 text-amber-900 border-amber-200',
    monthActive: 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-300',
    ring: 'ring-amber-400',
    dot: 'bg-amber-500',
  },
  HAUTE: {
    pill: 'border-rose-200 bg-rose-50 text-rose-950',
    pillActive: 'border-rose-500 bg-rose-600 text-white shadow-sm',
    month: 'bg-rose-100 text-rose-900 border-rose-200',
    monthActive: 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-300',
    ring: 'ring-rose-400',
    dot: 'bg-rose-500',
  },
};

/**
 * Résout la période tarifaire à partir du mois calendaire (0 = janvier).
 * Priorité : haute (juin–sept.) > moyenne (mars–mai, oct.) > basse.
 */
export function resolvePricingSeasonCode(jsMonth: number): PricingSeasonCode {
  const m = jsMonth + 1;
  if (m >= 6 && m <= 9) return 'HAUTE';
  if (m === 3 || m === 4 || m === 5 || m === 10) return 'MOYENNE';
  return 'BASSE';
}
