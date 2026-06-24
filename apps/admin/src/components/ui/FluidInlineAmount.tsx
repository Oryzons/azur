import { useLayoutEffect, useRef, useState } from 'react';
import { AnimatedNumber } from '@/components/AnimatedNumber';

export function FluidInlineAmount(props: Readonly<{
  value: number;
  format: (n: number) => string;
  className?: string;
  textClassName?: string;
}>) {
  const { value, format, className, textClassName = 'text-2xl' } = props;
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const fit = () => {
      inner.style.transform = 'scale(1)';
      const available = outer.clientWidth;
      const needed = inner.scrollWidth;
      if (needed > available && available > 0) {
        setScale(Math.max(0.72, available / needed));
      } else {
        setScale(1);
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={outerRef} className={['w-full min-w-0 overflow-hidden', className].filter(Boolean).join(' ')}>
      <span
        ref={innerRef}
        className={[
          'inline-block origin-left whitespace-nowrap font-bold tabular-nums leading-none tracking-tight',
          textClassName,
        ].join(' ')}
        style={{ transform: `scale(${scale})` }}
      >
        <AnimatedNumber value={value} format={format} />
      </span>
    </div>
  );
}
