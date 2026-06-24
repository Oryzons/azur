/** Direction artistique check-in / check-out — sobre, type fintech (Revolut). */
export const CF = {
  screen:
    'relative min-h-full bg-gradient-to-b from-zinc-100/90 via-zinc-50 to-white pb-[calc(6.5rem+env(safe-area-inset-bottom))]',
  inner: 'mx-auto w-full max-w-lg px-5 pt-2',
  card: 'rounded-3xl border border-zinc-200/50 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]',
  cardSoft: 'rounded-3xl bg-zinc-100/70 p-4',
  hero: 'overflow-hidden rounded-3xl border border-zinc-200/40 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]',
  title: 'text-[1.65rem] font-bold leading-tight tracking-tight text-zinc-900',
  subtitle: 'mt-2 text-sm leading-relaxed text-zinc-500',
  label: 'text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400',
  stepMeta: 'text-xs font-medium tabular-nums text-zinc-500',
  btnPrimary:
    'inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full bg-zinc-900 px-6 text-sm font-semibold text-white shadow-lg shadow-zinc-900/15 touch-manipulation transition-transform duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
  btnSecondary:
    'inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-6 text-sm font-semibold text-zinc-800 touch-manipulation transition-transform duration-200 active:scale-[0.98] disabled:opacity-40',
  btnGhost:
    'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold text-zinc-600 touch-manipulation transition active:scale-[0.98]',
  input:
    'w-full rounded-2xl border border-zinc-200/80 bg-zinc-50/60 px-4 py-3.5 text-base text-zinc-900 outline-none transition duration-200 focus:border-zinc-400 focus:bg-white focus:ring-4 focus:ring-zinc-900/[0.04]',
  select:
    'w-full min-h-[3.25rem] appearance-none rounded-2xl border border-zinc-200/80 bg-zinc-50/60 px-4 py-3 pr-11 text-base text-zinc-900 outline-none transition duration-200 focus:border-zinc-400 focus:bg-white focus:ring-4 focus:ring-zinc-900/[0.04]',
  optionBase:
    'relative min-h-[3.5rem] rounded-2xl px-4 py-3.5 text-base font-semibold touch-manipulation transition-all duration-200 active:scale-[0.98]',
  optionSelected: 'border-2 border-zinc-900 bg-zinc-900 text-white shadow-md shadow-zinc-900/15',
  optionIdle: 'border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300',
  progressTrack: 'h-1 overflow-hidden rounded-full bg-zinc-200/70',
  progressFill:
    'h-full rounded-full bg-zinc-900 transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
  footer:
    'fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200/60 bg-white/85 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-2xl',
  error: 'rounded-2xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-700',
  badge: 'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200/80',
} as const;

export type CfStepDirection = 'forward' | 'back';
