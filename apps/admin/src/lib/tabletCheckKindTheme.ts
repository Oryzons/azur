import type { CheckFlowKind } from '@/stores/checkFlow';

/** Badge sur carte photo (fond sombre). */
export function checkKindHeroBadgeClass(kind: CheckFlowKind): string {
  if (kind === 'CHECK_OUT') {
    return 'text-red-300 ring-red-400/35';
  }
  return 'text-emerald-300 ring-emerald-400/30';
}

export function checkKindHeroDotClass(kind: CheckFlowKind): string {
  return kind === 'CHECK_OUT' ? 'bg-red-400' : 'bg-emerald-400';
}

/** Bouton pill principal (fiche / liste). */
export function checkKindPrimaryBtnClass(kind: CheckFlowKind, active = true): string {
  if (!active) {
    return 'border border-zinc-200 bg-white text-zinc-800';
  }
  if (kind === 'CHECK_OUT') {
    return 'bg-red-600 text-white shadow-md shadow-red-600/20';
  }
  return 'bg-zinc-900 text-white shadow-md shadow-zinc-900/15';
}

/** Bouton action dans carte sombre. */
export function checkKindFeaturedBtnClass(kind: CheckFlowKind, isDone: boolean): string {
  if (isDone) return 'bg-white/15 text-white ring-1 ring-white/25';
  if (kind === 'CHECK_OUT') return 'bg-red-500 text-white shadow-lg shadow-red-900/30';
  return 'bg-white text-zinc-900 shadow-lg shadow-black/20';
}

/** Bouton liste standard. */
export function checkKindListBtnClass(kind: CheckFlowKind, isDone: boolean): string {
  if (isDone) return 'border border-emerald-200 bg-emerald-50 text-emerald-800';
  if (kind === 'CHECK_OUT') {
    return 'border border-red-200 bg-red-600 text-white shadow-md shadow-red-600/15';
  }
  return 'bg-zinc-900 text-white shadow-md shadow-zinc-900/15';
}

export function checkKindStatusDotClass(kind: CheckFlowKind, ok: boolean): string {
  if (ok) return 'bg-emerald-500';
  if (kind === 'CHECK_OUT') return 'bg-red-500';
  return 'bg-amber-500';
}
