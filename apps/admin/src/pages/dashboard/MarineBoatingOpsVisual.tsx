import type { DayBoatingOps } from './marineBoatingOps';

export function boatingBandEmoji(band: DayBoatingOps['band']): string {
  switch (band) {
    case 'green':
      return '🟢';
    case 'orange':
      return '🟠';
    case 'red':
      return '🔴';
    default:
      return '⚪';
  }
}

function heroShellClass(band: DayBoatingOps['band']): string {
  switch (band) {
    case 'green':
      return 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-white to-white';
    case 'orange':
      return 'border-orange-200/80 bg-gradient-to-br from-orange-50/90 via-white to-white';
    case 'red':
      return 'border-red-200/80 bg-gradient-to-br from-red-50/90 via-white to-white';
    default:
      return 'border-zinc-200/80 bg-zinc-50/80';
  }
}

function statusPillClass(band: DayBoatingOps['band']): string {
  switch (band) {
    case 'green':
      return 'bg-emerald-600/10 text-emerald-900 ring-emerald-600/20';
    case 'orange':
      return 'bg-orange-500/10 text-orange-950 ring-orange-500/25';
    case 'red':
      return 'bg-red-600/10 text-red-950 ring-red-600/25';
    default:
      return 'bg-zinc-100 text-zinc-800 ring-zinc-300/40';
  }
}

function scoreBarClass(band: DayBoatingOps['band']): string {
  switch (band) {
    case 'green':
      return 'bg-emerald-500';
    case 'orange':
      return 'bg-amber-500';
    case 'red':
      return 'bg-red-500';
    default:
      return 'bg-zinc-400';
  }
}

export function MarineBoatingScoreHero(props: Readonly<{ ops: DayBoatingOps | null; loading: boolean }>) {
  const { ops, loading } = props;

  if (loading || !ops) {
    return (
      <div className="mt-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 shadow-sm">
        <div className="flex gap-3">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-zinc-200/70" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <div className="h-2.5 w-20 animate-pulse rounded bg-zinc-200/70" />
            <div className="h-8 w-24 animate-pulse rounded-md bg-zinc-200/60" />
            <div className="h-1.5 w-full animate-pulse rounded-full bg-zinc-200/50" />
          </div>
        </div>
      </div>
    );
  }

  const emoji = boatingBandEmoji(ops.band);

  return (
    <div
      className={`mt-3 rounded-xl border p-3.5 shadow-sm shadow-zinc-200/40 ${heroShellClass(ops.band)}`}
      aria-label={`Indice mer ${ops.score} sur 100, ${ops.labelFr}`}
    >
      <div className="flex gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm ring-1 ring-zinc-200/60"
          aria-hidden
        >
          <span className="text-xl leading-none">{emoji}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Indice mer</p>
            <span
              className={`max-w-[min(100%,12rem)] truncate rounded-full px-2.5 py-0.5 text-center text-[10px] font-semibold leading-tight ring-1 ring-inset ${statusPillClass(ops.band)}`}
            >
              {ops.labelFr}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums tracking-tight text-zinc-900">{ops.score}</span>
            <span className="text-sm font-medium text-zinc-400">/ 100</span>
          </div>

          <div
            className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/50 ring-1 ring-inset ring-zinc-200/40"
            aria-hidden
          >
            <div
              className={`h-full rounded-full ${scoreBarClass(ops.band)}`}
              style={{ width: `${Math.min(100, Math.max(0, ops.score))}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
