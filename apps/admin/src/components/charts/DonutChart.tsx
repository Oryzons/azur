import { useMemo } from 'react';

export type DonutSegment = {
  id: string;
  label: string;
  value: number;
  color: string;
};

type DonutChartProps = Readonly<{
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}>;

export function DonutChart({
  segments,
  size = 168,
  strokeWidth = 26,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const filtered = segments.filter((s) => Number.isFinite(s.value) && s.value > 0);
  const total = filtered.reduce((sum, s) => sum + s.value, 0);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;

  const arcs = useMemo(() => {
    if (total <= 0) return [];
    let cumulative = 0;
    return filtered.map((s) => {
      const pct = s.value / total;
      const len = pct * c;
      const offset = c * (1 - cumulative);
      cumulative += pct;
      return { ...s, len, gap: c - len, offset };
    });
  }, [c, filtered, total]);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#f4f4f5"
            strokeWidth={strokeWidth}
          />
          {arcs.map((a) => (
            <circle
              key={a.id}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${a.len} ${a.gap}`}
              strokeDashoffset={a.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
          {centerValue ? <p className="text-sm font-bold tabular-nums text-zinc-900">{centerValue}</p> : null}
          {centerLabel ? <p className="text-[10px] font-medium text-zinc-500">{centerLabel}</p> : null}
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {segments.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <li key={s.id} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="min-w-0 flex-1 truncate font-medium text-zinc-700">{s.label}</span>
              <span className="shrink-0 tabular-nums text-zinc-500">{pct > 0 ? `${pct} %` : '—'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
