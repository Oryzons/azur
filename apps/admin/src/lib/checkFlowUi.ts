import type { CheckFlowKind, CheckQuestionType } from '@/stores/checkFlow';

export const CHECK_FLOW_THEME: Record<
  CheckFlowKind,
  { pill: string; pillActive: string; ring: string; accent: string }
> = {
  CHECK_IN: {
    pill: 'border-teal-200 bg-teal-50 text-teal-900',
    pillActive: 'border-teal-500 bg-teal-600 text-white shadow-sm',
    ring: 'ring-teal-400',
    accent: 'text-teal-800',
  },
  CHECK_OUT: {
    pill: 'border-orange-200 bg-orange-50 text-orange-950',
    pillActive: 'border-orange-500 bg-orange-600 text-white shadow-sm',
    ring: 'ring-orange-400',
    accent: 'text-orange-900',
  },
};

export const QUESTION_TYPE_ORDER: CheckQuestionType[] = [
  'TEXT',
  'BOOLEAN',
  'SELECT',
  'PHOTO',
  'FUEL_GAUGE',
];

export function questionTypeShortLabel(t: CheckQuestionType): string {
  if (t === 'TEXT') return 'Texte';
  if (t === 'BOOLEAN') return 'Oui/Non';
  if (t === 'SELECT') return 'Liste';
  if (t === 'PHOTO') return 'Photo';
  return 'Essence';
}
