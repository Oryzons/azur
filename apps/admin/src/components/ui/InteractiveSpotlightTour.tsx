import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Portal } from '@/components/Portal';

export type InteractiveTourStep = {
  title: string;
  body: ReactNode;
  /** Sélecteur CSS (ex. `[data-tour="owner-nav-calendar"]`). */
  target?: string;
  /** Naviguer vers cette route avant d’afficher l’étape. */
  route?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  spotlightPadding?: number;
  /** Scroll de la cible avant mesure (ex. `end` pour le pied du menu). */
  scrollBlock?: ScrollLogicalPosition;
};

type Rect = { top: number; left: number; width: number; height: number };

type Props = Readonly<{
  steps: InteractiveTourStep[];
  stepIndex: number;
  onStepIndexChange: (index: number) => void;
  onFinish: () => void;
  active: boolean;
}>;

const TOOLTIP_MAX_W = 360;
const ARROW = 10;
const STEP_LEAVE_MS = 200;
const ROUTE_SETTLE_MS = 320;
const SPOTLIGHT_TRANSITION =
  'top 520ms cubic-bezier(0.4, 0, 0.2, 1), left 520ms cubic-bezier(0.4, 0, 0.2, 1), width 520ms cubic-bezier(0.4, 0, 0.2, 1), height 520ms cubic-bezier(0.4, 0, 0.2, 1), opacity 380ms ease, border-radius 400ms ease';
const TOOLTIP_TRANSITION =
  'top 520ms cubic-bezier(0.4, 0, 0.2, 1), left 520ms cubic-bezier(0.4, 0, 0.2, 1), opacity 280ms ease, transform 420ms cubic-bezier(0.16, 1, 0.3, 1)';

function measureTarget(
  selector: string | undefined,
  scrollIntoView: boolean,
  scrollBlock: ScrollLogicalPosition = 'nearest',
): Rect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  if (scrollIntoView) {
    el.scrollIntoView({ block: scrollBlock, inline: 'nearest', behavior: 'smooth' });
  }
  const r = el.getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function tooltipPosition(
  rect: Rect | null,
  placement: InteractiveTourStep['placement'],
  tooltipH: number,
): { top: number; left: number; arrowSide: 'top' | 'bottom' | 'left' | 'right' | 'none' } {
  if (!rect || placement === 'center') {
    return {
      top: Math.max(16, (window.innerHeight - tooltipH) / 2),
      left: Math.max(16, (window.innerWidth - TOOLTIP_MAX_W) / 2),
      arrowSide: 'none',
    };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 14 + ARROW;

  if (placement === 'right') {
    const left = rect.left + rect.width + gap;
    const top = clamp(rect.top + rect.height / 2 - tooltipH / 2, 12, vh - tooltipH - 12);
    return { top, left: clamp(left, 12, vw - TOOLTIP_MAX_W - 12), arrowSide: 'left' };
  }
  if (placement === 'left') {
    const left = rect.left - gap - TOOLTIP_MAX_W;
    const top = clamp(rect.top + rect.height / 2 - tooltipH / 2, 12, vh - tooltipH - 12);
    return { top, left: clamp(left, 12, vw - TOOLTIP_MAX_W - 12), arrowSide: 'right' };
  }
  if (placement === 'bottom') {
    const top = rect.top + rect.height + gap;
    const left = clamp(rect.left + rect.width / 2 - TOOLTIP_MAX_W / 2, 12, vw - TOOLTIP_MAX_W - 12);
    return { top: clamp(top, 12, vh - tooltipH - 12), left, arrowSide: 'top' };
  }
  const top = rect.top - gap - tooltipH;
  const left = clamp(rect.left + rect.width / 2 - TOOLTIP_MAX_W / 2, 12, vw - TOOLTIP_MAX_W - 12);
  return { top: clamp(top, 12, vh - tooltipH - 12), left, arrowSide: 'bottom' };
}

export function InteractiveSpotlightTour({
  steps,
  stepIndex,
  onStepIndexChange,
  onFinish,
  active,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const step = steps[stepIndex];
  const stepIndexRef = useRef(stepIndex);
  stepIndexRef.current = stepIndex;
  const mountedRef = useRef(false);

  const [displayRect, setDisplayRect] = useState<Rect | null>(null);
  const [tooltipH, setTooltipH] = useState(220);
  const [ready, setReady] = useState(true);
  const [contentVisible, setContentVisible] = useState(true);
  const [backdropVisible, setBackdropVisible] = useState(true);

  const remeasure = useCallback(
    (scrollIntoView: boolean) => {
      if (!step?.target) {
        setDisplayRect(null);
        setReady(true);
        return true;
      }
      const r = measureTarget(step.target, scrollIntoView, step?.scrollBlock ?? 'nearest');
      setDisplayRect(r);
      setReady(Boolean(r));
      return Boolean(r);
    },
    [step?.scrollBlock, step?.target],
  );

  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  useEffect(() => {
    if (!active || !step?.route) return;
    if (location.pathname !== step.route) {
      navigate(step.route);
    }
  }, [active, step?.route, location.pathname, navigate, step]);

  useEffect(() => {
    if (!active) return;

    const firstPaint = !mountedRef.current;
    mountedRef.current = true;
    if (!firstPaint) setContentVisible(false);
    const needsRoute = Boolean(step?.route && location.pathname !== step.route);
    const settleMs = firstPaint ? 0 : needsRoute ? ROUTE_SETTLE_MS : STEP_LEAVE_MS;

    const leaveTimer = window.setTimeout(() => {
      let tries = 0;
      const tryMeasure = () => {
        if (stepIndexRef.current !== stepIndex) return;
        const ok = remeasure(tries === 0);
        tries += 1;
        if (!ok && step?.target && tries < 16) {
          window.setTimeout(tryMeasure, 70);
          return;
        }
        const isCenter = !step?.target;
        setBackdropVisible(isCenter || !ok);
        window.setTimeout(() => {
          if (stepIndexRef.current === stepIndex) setContentVisible(true);
        }, 40);
      };
      tryMeasure();
    }, settleMs);

    return () => window.clearTimeout(leaveTimer);
  }, [active, stepIndex, step?.target, step?.route, location.pathname, remeasure, step]);

  useEffect(() => {
    if (!active) return;
    const onResize = () => remeasure(false);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [active, remeasure]);

  if (!active || !step) return null;

  const pad = step.spotlightPadding ?? 10;
  const placement = step.placement ?? (step.target ? 'right' : 'center');
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const pos = tooltipPosition(displayRect, placement, tooltipH);
  const showHole = Boolean(displayRect && ready && step.target);

  const holeStyle = showHole && displayRect
    ? {
        top: displayRect.top - pad,
        left: displayRect.left - pad,
        width: displayRect.width + pad * 2,
        height: displayRect.height + pad * 2,
        opacity: contentVisible ? 1 : 0.35,
        transition: SPOTLIGHT_TRANSITION,
      }
    : {
        top: '50%',
        left: '50%',
        width: 0,
        height: 0,
        opacity: 0,
        transition: SPOTLIGHT_TRANSITION,
      };

  return (
    <Portal>
      <div className="fixed inset-0 z-[220]" role="dialog" aria-modal="true" aria-labelledby="spotlight-tour-title">
        <div
          className="pointer-events-none fixed inset-0 z-[221] bg-slate-900/68 transition-opacity duration-500 ease-out"
          style={{ opacity: backdropVisible && !showHole ? 1 : 0 }}
          aria-hidden
        />

        <div
          className={`bc-tour-spotlight pointer-events-none fixed z-[221] rounded-xl${showHole && contentVisible ? ' bc-tour-spotlight-pulse' : ''}`}
          style={{
            ...holeStyle,
            boxShadow: showHole ? '0 0 0 9999px rgba(15, 23, 42, 0.68)' : 'none',
            outline: showHole ? '3px solid rgba(65, 107, 159, 0.95)' : 'none',
            outlineOffset: 2,
          }}
          aria-hidden
        />

        <div
          className="pointer-events-auto fixed z-[222] rounded-2xl border border-zinc-200/90 bg-white shadow-2xl shadow-zinc-900/20"
          style={{
            top: pos.top,
            left: pos.left,
            width: TOOLTIP_MAX_W,
            maxWidth: 'calc(100vw - 24px)',
            opacity: contentVisible ? 1 : 0,
            transform: contentVisible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
            transition: TOOLTIP_TRANSITION,
          }}
          ref={(node) => {
            if (node) {
              const h = node.offsetHeight;
              if (h !== tooltipH) setTooltipH(h);
            }
          }}
        >
          {pos.arrowSide !== 'none' && displayRect && contentVisible ? (
            <span
              className="absolute h-0 w-0 border-[10px] border-transparent transition-opacity duration-300"
              style={
                pos.arrowSide === 'left'
                  ? {
                      left: -ARROW * 2,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      borderRightColor: '#fff',
                    }
                  : pos.arrowSide === 'right'
                    ? {
                        right: -ARROW * 2,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        borderLeftColor: '#fff',
                      }
                    : pos.arrowSide === 'top'
                      ? {
                          top: -ARROW * 2,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          borderBottomColor: '#fff',
                        }
                      : {
                          bottom: -ARROW * 2,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          borderTopColor: '#fff',
                        }
              }
              aria-hidden
            />
          ) : null}

          <div key={stepIndex} className="bc-tour-step-content">
            <div className="border-b border-zinc-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Étape {stepIndex + 1} sur {steps.length}
              </p>
              <h2 id="spotlight-tour-title" className="text-base font-bold text-zinc-900">
                {step.title}
              </h2>
            </div>
            <div className="px-4 py-3">
              <div className="text-sm leading-relaxed text-zinc-600">{step.body}</div>
              {!ready && step.target && contentVisible ? (
                <p className="mt-2 text-xs text-amber-700">Chargement de la zone…</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-4 py-3">
            <button
              type="button"
              onClick={onFinish}
              className="text-sm font-semibold text-zinc-500 transition-colors hover:text-zinc-800"
            >
              Ignorer
            </button>
            <div className="flex gap-2">
              {!isFirst ? (
                <button
                  type="button"
                  onClick={() => onStepIndexChange(stepIndex - 1)}
                  className="rounded-xl border border-zinc-200/90 px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  Précédent
                </button>
              ) : null}
              <button
                type="button"
                disabled={Boolean(step.target) && !ready && contentVisible}
                onClick={() => {
                  if (isLast) onFinish();
                  else onStepIndexChange(stepIndex + 1);
                }}
                className="rounded-xl bg-[#416B9F] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#365b87] disabled:opacity-50"
              >
                {isLast ? 'Terminer' : 'Suivant'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
