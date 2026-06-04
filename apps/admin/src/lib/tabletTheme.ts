/** Classes Tailwind partagées — espace agent (téléphone), DA alignée sur le back-office. */
export const TB = {
  /** Hauteur viewport fixe : le défilement se fait dans `main`, pas sur le body (sinon blocage iOS). */
  shell: 'flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-zinc-100 text-zinc-900',
  header:
    'flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200/90 bg-white px-4 py-3 shadow-sm shadow-zinc-200/30 pt-[max(0.75rem,env(safe-area-inset-top))]',
  headerTitle: 'text-lg font-bold tracking-tight text-zinc-900',
  headerSub: 'truncate text-sm text-zinc-500',
  main: 'min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y',
  nav: 'fixed bottom-0 left-0 right-0 z-40 flex border-t border-zinc-200/90 bg-white/95 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md pb-[env(safe-area-inset-bottom)]',
  navLink:
    'flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold touch-manipulation',
  navActive: 'text-[#416B9F]',
  navIdle: 'text-zinc-500',
  page: 'mx-auto w-full max-w-lg px-4 py-5 pb-[max(2rem,env(safe-area-inset-bottom))]',
  h1: 'text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl',
  subtitle: 'mt-1 text-sm capitalize text-zinc-500',
  card: 'rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm shadow-zinc-200/40',
  cardHighlight: 'rounded-2xl border border-[#416B9F]/20 bg-[#416B9F]/5 p-4 shadow-sm ring-2 ring-[#416B9F]/10',
  iconBtn:
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-200/90 bg-white text-zinc-600 shadow-sm touch-manipulation active:bg-zinc-50',
  btnPrimary:
    'min-h-[3rem] rounded-2xl bg-[#416B9F] px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-[#416B9F]/25 touch-manipulation active:scale-[0.98] disabled:opacity-50',
  btnSecondary:
    'min-h-[3rem] rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 shadow-sm touch-manipulation active:bg-zinc-50',
  btnGhost:
    'min-h-[3rem] rounded-2xl border border-zinc-200/90 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 touch-manipulation active:bg-zinc-100',
  linkBack: 'inline-flex items-center gap-2 text-sm font-semibold text-[#416B9F] hover:underline',
  error: 'rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700',
  info: 'rounded-xl border border-[#416B9F]/15 bg-[#416B9F]/8 px-4 py-3 text-sm text-zinc-700',
  empty: 'text-center text-sm text-zinc-500',
  label: 'text-xs font-semibold uppercase tracking-wide text-zinc-500',
  input:
    'mt-2 w-full min-h-[3rem] rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15',
  badgePending: 'rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200/80',
  badgeDone: 'rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200/80',
} as const;
