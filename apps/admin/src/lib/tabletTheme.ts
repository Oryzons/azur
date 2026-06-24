/** Classes Tailwind partagées — espace agent (téléphone), DA moderne type fintech. */
export const TB = {
  /** Hauteur viewport fixe : le défilement se fait dans `main`, pas sur le body (sinon blocage iOS). */
  shell: 'flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-white text-zinc-900',
  header:
    'flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200/60 bg-white/90 px-4 py-3 backdrop-blur-md pt-[max(0.75rem,env(safe-area-inset-top))]',
  headerTitle: 'text-lg font-bold tracking-tight text-zinc-900',
  headerSub: 'truncate text-sm text-zinc-500',
  main: 'min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y',
  /** Ancienne barre pleine largeur — conservée pour check-in / check-out */
  nav: 'fixed bottom-0 left-0 right-0 z-40 flex border-t border-zinc-200/90 bg-white/95 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md pb-[env(safe-area-inset-bottom)]',
  navLink:
    'flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold touch-manipulation',
  navActive: 'text-[#416B9F]',
  navIdle: 'text-zinc-500',
  floatingNavWrap:
    'pointer-events-none fixed bottom-0 left-0 right-0 z-40 flex justify-center px-5 pb-[max(1rem,env(safe-area-inset-bottom))]',
  floatingNav:
    'pointer-events-auto relative flex w-full max-w-sm items-stretch gap-0 rounded-full bg-zinc-900 px-3 py-2.5 shadow-[0_16px_48px_rgba(0,0,0,0.28)]',
  floatingNavItem:
    'relative z-10 flex flex-1 items-center justify-center rounded-full touch-manipulation outline-none transition-[transform,color] duration-200 ease-out active:scale-95',
  floatingNavItemActive: 'text-zinc-900',
  floatingNavItemIdle: 'text-white/40',
  page:
    'mx-auto w-full max-w-lg px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[calc(6.5rem+env(safe-area-inset-bottom))]',
  homePage:
    'mx-auto w-full max-w-lg px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[calc(6.5rem+env(safe-area-inset-bottom))]',
  h1: 'text-[1.65rem] font-bold leading-tight tracking-tight text-zinc-900',
  h1Hero: 'mt-6 text-[1.75rem] font-bold leading-[1.15] tracking-tight text-zinc-900',
  subtitle: 'mt-1 text-sm capitalize text-zinc-500',
  card: 'rounded-3xl border border-zinc-200/50 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]',
  cardHighlight:
    'rounded-3xl border border-zinc-900/10 bg-zinc-50 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-zinc-900/5',
  cardHero:
    'overflow-hidden rounded-[1.75rem] border border-zinc-200/40 bg-zinc-900 text-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]',
  avatar:
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-bold text-white',
  iconBtn:
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-200/80 bg-white text-zinc-600 shadow-sm touch-manipulation active:bg-zinc-50',
  iconBtnRound:
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-200/70 bg-white text-zinc-600 shadow-sm touch-manipulation transition active:scale-95 active:bg-zinc-50',
  chip:
    'inline-flex shrink-0 items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold touch-manipulation transition-all duration-200 active:scale-[0.98]',
  chipActive: 'bg-blue-500 text-white shadow-md shadow-blue-500/25',
  chipIdle: 'border border-zinc-200 bg-white text-zinc-700',
  sectionTitle: 'text-lg font-bold text-zinc-900',
  btnPrimary:
    'min-h-[3rem] rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-zinc-900/15 touch-manipulation active:scale-[0.98] disabled:opacity-50',
  btnSecondary:
    'min-h-[3rem] rounded-full border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 touch-manipulation active:scale-[0.98]',
  btnGhost:
    'min-h-[3rem] rounded-full border border-zinc-200 bg-zinc-50 px-5 py-3 text-sm font-semibold text-zinc-700 touch-manipulation active:bg-zinc-100',
  linkBack: 'inline-flex items-center gap-2 text-sm font-semibold text-zinc-700 hover:underline',
  error: 'rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700',
  info: 'rounded-2xl border border-zinc-200/60 bg-zinc-50 px-4 py-3 text-sm text-zinc-600',
  empty: 'text-center text-sm text-zinc-500',
  label: 'text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400',
  input:
    'mt-2 w-full min-h-[3rem] rounded-2xl border border-zinc-200/80 bg-zinc-50/60 px-4 py-3 text-base text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-4 focus:ring-zinc-900/[0.04]',
  badgePending:
    'rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200/80',
  badgeDone:
    'rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200/80',
} as const;
