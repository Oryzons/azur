import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedNumber } from '@/components/AnimatedNumber';

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
  /** Montant central animé (prioritaire sur centerValue si défini). */
  centerAmount?: number;
  formatValue?: (value: number) => string;
  /** Change pour relancer l’animation des arcs (ex. période du bloc). */
  animKey?: string;
}>;

type ArcSegment = DonutSegment & { startAngle: number; endAngle: number; path: string };

function defaultFormatValue(value: number) {
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const sweep = endAngle - startAngle;
  if (sweep >= 359.99) {
    const mid = polarPoint(cx, cy, r, startAngle + 180);
    const start = polarPoint(cx, cy, r, startAngle);
    return `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${mid.x} ${mid.y} A ${r} ${r} 0 1 1 ${start.x} ${start.y}`;
  }
  const start = polarPoint(cx, cy, r, startAngle);
  const end = polarPoint(cx, cy, r, endAngle);
  const large = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

function arcLength(r: number, sweepDeg: number) {
  return (Math.max(sweepDeg, 0) / 360) * 2 * Math.PI * r;
}

export function DonutChart({
  segments,
  size = 168,
  strokeWidth = 26,
  centerLabel,
  centerValue,
  centerAmount,
  formatValue = defaultFormatValue,
  animKey = 'default',
}: DonutChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ segment: DonutSegment; x: number; y: number } | null>(null);
  const [arcsRevealed, setArcsRevealed] = useState(false);

  useEffect(() => {
    setArcsRevealed(false);
    const id = requestAnimationFrame(() => setArcsRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [animKey, segments]);

  const filtered = segments.filter((s) => Number.isFinite(s.value) && s.value > 0);
  const total = filtered.reduce((sum, s) => sum + s.value, 0);
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const hitWidth = strokeWidth + 14;

  const arcs: ArcSegment[] = useMemo(() => {
    if (total <= 0) return [];
    let angle = 0;
    return filtered.map((s) => {
      const sweep = (s.value / total) * 360;
      const startAngle = angle;
      const endAngle = angle + sweep;
      angle += sweep;
      return {
        ...s,
        startAngle,
        endAngle,
        path: arcPath(cx, cy, r, startAngle, endAngle),
      };
    });
  }, [cx, cy, filtered, r, total]);

  function showTip(segment: DonutSegment, clientX: number, clientY: number) {
    const box = chartRef.current?.getBoundingClientRect();
    if (!box) return;
    setHighlightedId(segment.id);
    setTooltip({
      segment,
      x: clientX - box.left,
      y: clientY - box.top,
    });
  }

  function clearHover() {
    setHighlightedId(null);
    setTooltip(null);
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div ref={chartRef} className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f4f4f5" strokeWidth={strokeWidth} />
          {arcs.map((a, i) => {
            const len = arcLength(r, a.endAngle - a.startAngle);
            const delayMs = i * 55;
            return (
              <g key={a.id}>
                <path
                  d={a.path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={hitWidth}
                  strokeLinecap="butt"
                  className="cursor-pointer"
                  onMouseEnter={(e) => showTip(a, e.clientX, e.clientY)}
                  onMouseMove={(e) => showTip(a, e.clientX, e.clientY)}
                  onMouseLeave={clearHover}
                  aria-label={`${a.label} : ${formatValue(a.value)}`}
                />
                <path
                  d={a.path}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="butt"
                  pointerEvents="none"
                  pathLength={len}
                  strokeDasharray={len}
                  strokeDashoffset={arcsRevealed ? 0 : len}
                  className={[
                    'bc-donut-arc transition-[stroke-dashoffset,opacity,filter]',
                    highlightedId === a.id ? 'opacity-100' : 'opacity-95',
                  ].join(' ')}
                  style={{
                    transitionDuration: '620ms',
                    transitionTimingFunction: 'cubic-bezier(0.34, 1.15, 0.64, 1)',
                    transitionDelay: `${delayMs}ms`,
                    filter: highlightedId === a.id ? 'brightness(1.08)' : undefined,
                  }}
                />
              </g>
            );
          })}
        </svg>

        {tooltip ? (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y - 8 }}
            role="tooltip"
          >
            <span className="text-zinc-300">{tooltip.segment.label}</span>
            <span className="mx-1.5 text-zinc-600">·</span>
            <span className="tabular-nums">{formatValue(tooltip.segment.value)}</span>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
          {centerAmount != null ? (
            <p className="text-sm font-bold tabular-nums text-zinc-900">
              <AnimatedNumber value={centerAmount} format={(n) => `${formatValue(n)}`} />
            </p>
          ) : centerValue ? (
            <p className="text-sm font-bold tabular-nums text-zinc-900">{centerValue}</p>
          ) : null}
          {centerLabel ? <p className="text-[10px] font-medium text-zinc-500">{centerLabel}</p> : null}
        </div>
      </div>
      <ul key={animKey} className="min-w-0 flex-1 space-y-2">
        {segments.map((s, i) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          const amountLabel = s.value > 0 ? formatValue(s.value) : 'Aucun montant';
          const active = highlightedId === s.id;
          return (
            <li
              key={s.id}
              className={[
                'bc-donut-legend-item flex items-center gap-2 rounded-md px-1 py-0.5 text-xs transition-colors',
                active ? 'bg-zinc-100' : '',
              ].join(' ')}
              style={{ animationDelay: `${120 + i * 40}ms` }}
              onMouseEnter={() => s.value > 0 && setHighlightedId(s.id)}
              onMouseLeave={() => setHighlightedId(null)}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 cursor-help rounded-full ring-offset-1 transition hover:ring-2 hover:ring-zinc-300"
                style={{ backgroundColor: s.color }}
                title={amountLabel}
                aria-label={`${s.label} : ${amountLabel}`}
              />
              <span className="min-w-0 flex-1 truncate font-medium text-zinc-700" title={amountLabel}>
                {s.label}
              </span>
              <span className="shrink-0 tabular-nums text-zinc-500" title={amountLabel}>
                {pct > 0 ? `${pct} %` : '—'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
