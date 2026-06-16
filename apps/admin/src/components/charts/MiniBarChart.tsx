import { useMemo } from 'react';

type BarPoint = { label: string; value: number };

const BAR_AREA_PX = 128;
const BAR_STAGGER_MS = 48;
const LABEL_DELAY_OFFSET_MS = 280;
const AXIS_DELAY_MS = 420;

function chartAnimKey(points: BarPoint[]): string {
  return points.map((p) => `${p.label}:${p.value}`).join('|');
}

export function MiniBarChart({ points, formatValue }: Readonly<{ points: BarPoint[]; formatValue?: (n: number) => string }>) {
  const max = Math.max(...points.map((p) => p.value), 1);
  const fmt = formatValue ?? ((n: number) => String(Math.round(n)));
  const animKey = useMemo(() => chartAnimKey(points), [points]);

  if (points.length === 0) {
    return <p className="py-8 text-center text-xs text-zinc-500">Aucune donnée sur la période.</p>;
  }

  return (
    <div key={animKey} className="bc-mini-chart-enter flex flex-col gap-2">
      <div className="flex items-end gap-1 sm:gap-1.5" style={{ height: BAR_AREA_PX + 20 }}>
        {points.map((p, i) => {
          const barPx = p.value > 0 ? Math.max(6, Math.round((p.value / max) * BAR_AREA_PX)) : 0;
          const barDelay = i * BAR_STAGGER_MS;
          const labelDelay = barDelay + LABEL_DELAY_OFFSET_MS;

          return (
            <div key={p.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span
                className="bc-mini-bar-label text-[9px] font-semibold tabular-nums text-zinc-600 sm:text-[10px]"
                style={{ animationDelay: `${labelDelay}ms` }}
              >
                {p.value > 0 ? fmt(p.value) : ''}
              </span>
              <div
                className={[
                  'bc-mini-bar w-full max-w-11 rounded-t-md bg-linear-to-t from-[#2d5280] to-[#416B9F] shadow-sm',
                  p.value > 0 ? '' : 'opacity-0',
                ].join(' ')}
                style={{
                  height: barPx,
                  animationDelay: `${barDelay}ms`,
                }}
                title={`${p.label} : ${fmt(p.value)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 border-t border-zinc-100 pt-2 sm:gap-1.5">
        {points.map((p, i) => (
          <span
            key={`${p.label}-axis`}
            className="bc-mini-chart-axis min-w-0 flex-1 truncate text-center text-[9px] font-medium text-zinc-500 sm:text-[10px]"
            style={{ animationDelay: `${AXIS_DELAY_MS + i * 28}ms` }}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
