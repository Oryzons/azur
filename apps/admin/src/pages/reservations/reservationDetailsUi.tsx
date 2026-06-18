import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Portal } from '@/components/Portal';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';

export function SectionCard(props: Readonly<{
  icon: LucideIcon;
  title: string;
  accent?: 'default' | 'sky' | 'emerald' | 'amber' | 'red';
  children: ReactNode;
  /** Affiche une flèche pour replier / déplier le contenu. */
  collapsible?: boolean;
  defaultOpen?: boolean;
}>) {
  const { icon: Icon, title, accent = 'default', children, collapsible = false, defaultOpen = true } = props;
  const [open, setOpen] = useState(defaultOpen);
  const accentClass =
    accent === 'sky'
      ? 'bg-sky-50 text-sky-700'
      : accent === 'emerald'
        ? 'bg-emerald-50 text-emerald-700'
        : accent === 'amber'
          ? 'bg-amber-50 text-amber-800'
          : accent === 'red'
            ? 'bg-red-50 text-red-700'
            : 'bg-zinc-100 text-zinc-600';

  const headerInner = (
    <>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${accentClass}`}>
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
      </span>
      <h3 className="min-w-0 flex-1 text-xs font-bold uppercase tracking-wide text-zinc-700">{title}</h3>
    </>
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5 text-left transition-colors hover:bg-zinc-100/80"
          aria-expanded={open}
        >
          {headerInner}
          <ChevronDown
            className={['h-4 w-4 shrink-0 text-zinc-500 transition-transform', open ? 'rotate-180' : ''].join(' ')}
            aria-hidden
          />
        </button>
      ) : (
        <div className="flex items-center gap-2.5 border-b border-zinc-100 bg-zinc-50/80 px-4 py-2.5">
          {headerInner}
        </div>
      )}
      {open || !collapsible ? <div className="px-4 py-3">{children}</div> : null}
    </section>
  );
}

export function InfoRow(props: Readonly<{
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  highlight?: boolean;
}>) {
  const { icon: Icon, label, value, highlight } = props;
  return (
    <div className={`flex gap-3 py-2 ${highlight ? 'rounded-xl bg-zinc-50 px-2 -mx-2' : ''}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" strokeWidth={1.9} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
        <div className="mt-0.5 text-sm font-medium text-zinc-900">{value}</div>
      </div>
    </div>
  );
}

export function StatusBanner(props: Readonly<{
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  icon: LucideIcon;
  title: string;
  detail?: string;
  trailingIcon?: LucideIcon;
}>) {
  const { tone, icon: Icon, title, detail, trailingIcon: TrailingIcon } = props;
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200/90 bg-emerald-50 text-emerald-900'
      : tone === 'warning'
        ? 'border-amber-200/90 bg-amber-50 text-amber-950'
        : tone === 'danger'
          ? 'border-red-200/90 bg-red-50 text-red-900'
          : 'border-zinc-200/90 bg-zinc-50 text-zinc-800';

  const iconClass =
    tone === 'success'
      ? 'text-emerald-600'
      : tone === 'warning'
        ? 'text-amber-600'
        : tone === 'danger'
          ? 'text-red-600'
          : 'text-zinc-500';

  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${toneClass}`}>
      <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {detail ? <p className="mt-0.5 text-xs leading-relaxed opacity-90">{detail}</p> : null}
      </div>
      {TrailingIcon ? (
        <TrailingIcon className={`h-4 w-4 shrink-0 ${iconClass}`} strokeWidth={2.5} aria-hidden />
      ) : null}
    </div>
  );
}

export type ActionTone = 'default' | 'active' | 'success' | 'warning' | 'danger' | 'muted';

export type TooltipAlign = 'center' | 'start' | 'end';

type TipCoords = { top: number; left: number; transform: string };

function computeTipCoords(
  rect: DOMRect,
  align: TooltipAlign,
  placement: 'above' | 'below',
): TipCoords {
  const gap = 8;
  let left = rect.left + rect.width / 2;
  let transform = 'translateX(-50%)';
  if (align === 'end') {
    left = rect.right;
    transform = 'translateX(-100%)';
  } else if (align === 'start') {
    left = rect.left;
    transform = 'translateX(0)';
  }
  if (placement === 'below') {
    return { top: rect.bottom + gap, left, transform };
  }
  return { top: rect.top - gap, left, transform: `${transform} translateY(-100%)` };
}

export function IconActionButton(props: Readonly<{
  label: string;
  onClick: () => void;
  tone?: ActionTone;
  disabled?: boolean;
  tooltipAlign?: TooltipAlign;
  tooltipPlacement?: 'above' | 'below';
  children: ReactNode;
}>) {
  const {
    label,
    onClick,
    tone = 'default',
    disabled,
    tooltipAlign = 'end',
    tooltipPlacement = 'below',
    children,
  } = props;
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [tip, setTip] = useState<TipCoords | null>(null);

  const toneClass: Record<ActionTone, string> = {
    default: 'border-zinc-200/90 bg-white text-zinc-600 hover:bg-zinc-50',
    active: 'border-[#416B9F]/40 bg-[#416B9F]/10 text-[#416B9F] hover:bg-[#416B9F]/15',
    success: 'border-emerald-200/90 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    warning: 'border-amber-200/90 bg-amber-50 text-amber-800 hover:bg-amber-100',
    danger: 'border-red-200/90 bg-white text-red-600 hover:bg-red-50',
    muted: 'border-zinc-100 bg-zinc-50 text-zinc-400',
  };

  const showTip = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    setTip(computeTipCoords(el.getBoundingClientRect(), tooltipAlign, tooltipPlacement));
  }, [tooltipAlign, tooltipPlacement]);

  const hideTip = useCallback(() => setTip(null), []);

  return (
    <>
      <span
        ref={wrapRef}
        className="inline-flex shrink-0"
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
        onFocusCapture={showTip}
        onBlurCapture={hideTip}
      >
        <button
          type="button"
          onClick={disabled ? undefined : onClick}
          disabled={disabled}
          aria-label={label}
          title={label}
          className={[
            'flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-colors',
            toneClass[tone],
            disabled ? 'pointer-events-none cursor-not-allowed opacity-50' : '',
          ].join(' ')}
        >
          {children}
        </button>
      </span>
      {tip ? (
        <Portal>
          <span
            role="tooltip"
            style={{
              position: 'fixed',
              top: tip.top,
              left: tip.left,
              transform: tip.transform,
              zIndex: 9999,
            }}
            className="pointer-events-none max-w-[min(20rem,calc(100vw-1.5rem))] rounded-lg bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white shadow-xl"
          >
            {label}
          </span>
        </Portal>
      ) : null}
    </>
  );
}
