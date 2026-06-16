import { useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  isFinancesPeriodAnchorAtPresent,
  shiftFinancesPeriodAnchor,
  type FinancesPeriod,
} from './financesAnalytics';

const PERIOD_LABELS: Record<FinancesPeriod, string> = {
  day: 'Jour',
  week: 'Semaine',
  month: 'Mois',
  year: 'Année',
};

const PERIOD_OPTIONS: FinancesPeriod[] = ['day', 'week', 'month', 'year'];

export type RevenueDisplayMode = 'net' | 'gross';

const REVENUE_MODE_OPTIONS: RevenueDisplayMode[] = ['net', 'gross'];

const REVENUE_MODE_LABELS: Record<RevenueDisplayMode, string> = {
  net: 'Net',
  gross: 'Brut',
};

function SegmentBubblePicker<T extends string>(
  props: Readonly<{
    value: T;
    onChange: (value: T) => void;
    options: readonly T[];
    labels: Record<T, string>;
    dataAttr: string;
    compact?: boolean;
    'aria-label'?: string;
  }>,
) {
  const { value, onChange, options, labels, dataAttr, compact = false, 'aria-label': ariaLabel } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>(`[${dataAttr}="${value}"]`);
    if (!active) return;
    setIndicator({
      left: active.offsetLeft,
      width: active.offsetWidth,
      ready: true,
    });
  }, [dataAttr, value, compact, options]);

  return (
    <div
      ref={containerRef}
      className={[
        'relative inline-flex flex-wrap gap-0.5 rounded-xl bg-zinc-100/90 p-0.5',
        compact ? '' : 'gap-1 p-1',
      ].join(' ')}
      aria-label={ariaLabel}
    >
      <span
        aria-hidden
        className={[
          'pointer-events-none absolute rounded-lg bg-[#416B9F] shadow-sm',
          'transition-[left,width,opacity] duration-300 ease-[cubic-bezier(0.34,1.2,0.64,1)]',
          compact ? 'top-0.5 bottom-0.5' : 'top-1 bottom-1',
          indicator.ready ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        style={{ left: indicator.left, width: indicator.width }}
      />
      {options.map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            {...{ [dataAttr]: option }}
            onClick={() => onChange(option)}
            className={[
              'relative z-10 font-semibold transition-colors duration-200',
              compact ? 'rounded-lg px-2 py-0.5 text-[10px]' : 'rounded-lg px-3.5 py-1.5 text-sm',
              active ? 'text-white' : 'text-zinc-600 hover:text-zinc-900',
            ].join(' ')}
          >
            {labels[option]}
          </button>
        );
      })}
    </div>
  );
}

export function PeriodBubblePicker(
  props: Readonly<{
    value: FinancesPeriod;
    onChange: (period: FinancesPeriod) => void;
    compact?: boolean;
    'aria-label'?: string;
  }>,
) {
  return (
    <SegmentBubblePicker
      value={props.value}
      onChange={props.onChange}
      options={PERIOD_OPTIONS}
      labels={PERIOD_LABELS}
      dataAttr="data-period"
      compact={props.compact}
      aria-label={props['aria-label'] ?? 'Période'}
    />
  );
}

export function PeriodRangeNav(
  props: Readonly<{
    period: FinancesPeriod;
    anchor: Date;
    onAnchorChange: (anchor: Date) => void;
    compact?: boolean;
    'aria-label'?: string;
  }>,
) {
  const { period, anchor, onAnchorChange, compact = false, 'aria-label': ariaLabel } = props;
  const atPresent = isFinancesPeriodAnchorAtPresent(period, anchor);
  const btnCls = [
    'inline-flex items-center justify-center rounded-lg text-zinc-600 transition',
    'hover:bg-zinc-200/70 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-35',
    compact ? 'h-6 w-6' : 'h-8 w-8',
  ].join(' ');

  return (
    <div className="inline-flex items-center gap-0.5" aria-label={ariaLabel ?? 'Navigation période'}>
      <button
        type="button"
        className={btnCls}
        aria-label="Période précédente"
        onClick={() => onAnchorChange(shiftFinancesPeriodAnchor(period, anchor, -1))}
      >
        <ChevronLeft className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2.25} />
      </button>
      <button
        type="button"
        className={btnCls}
        aria-label="Période suivante"
        disabled={atPresent}
        onClick={() => onAnchorChange(shiftFinancesPeriodAnchor(period, anchor, 1))}
      >
        <ChevronRight className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2.25} />
      </button>
    </div>
  );
}

export function PeriodControls(
  props: Readonly<{
    period: FinancesPeriod;
    anchor: Date;
    onPeriodChange: (period: FinancesPeriod) => void;
    onAnchorChange: (anchor: Date) => void;
    compact?: boolean;
    'aria-label'?: string;
  }>,
) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <PeriodRangeNav
        period={props.period}
        anchor={props.anchor}
        onAnchorChange={props.onAnchorChange}
        compact={props.compact}
        aria-label={props['aria-label'] ? `${props['aria-label']} — navigation` : undefined}
      />
      <PeriodBubblePicker
        value={props.period}
        onChange={props.onPeriodChange}
        compact={props.compact}
        aria-label={props['aria-label']}
      />
    </div>
  );
}

export function RevenueModePicker(
  props: Readonly<{
    value: RevenueDisplayMode;
    onChange: (mode: RevenueDisplayMode) => void;
    compact?: boolean;
    'aria-label'?: string;
  }>,
) {
  return (
    <SegmentBubblePicker
      value={props.value}
      onChange={props.onChange}
      options={REVENUE_MODE_OPTIONS}
      labels={REVENUE_MODE_LABELS}
      dataAttr="data-revenue-mode"
      compact={props.compact ?? true}
      aria-label={props['aria-label'] ?? 'Affichage du CA'}
    />
  );
}
