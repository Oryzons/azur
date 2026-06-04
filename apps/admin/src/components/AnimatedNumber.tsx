import { useEffect, useMemo, useRef, useState } from 'react';

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

function easeOutCubic(t: number) {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

function prefersReducedMotion() {
  if (globalThis.window === undefined) return true;
  return globalThis.window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

export function AnimatedNumber(
  props: Readonly<{
    value: number;
    durationMs?: number;
    format?: (n: number) => string;
    className?: string;
  }>,
) {
  const durationMs = props.durationMs ?? 420;
  const format = useMemo(() => props.format ?? String, [props.format]);

  const rafRef = useRef<number | null>(null);
  const fromRef = useRef<number>(props.value);
  const [display, setDisplay] = useState<number>(props.value);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const to = props.value;
    const from = fromRef.current;
    fromRef.current = to;

    if (prefersReducedMotion() || !Number.isFinite(from) || !Number.isFinite(to) || durationMs <= 0) {
      setDisplay(to);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / durationMs;
      const k = easeOutCubic(t);
      const v = from + (to - from) * k;
      setDisplay(v);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [durationMs, props.value]);

  return <span className={props.className}>{format(display)}</span>;
}

