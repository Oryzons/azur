import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Portal } from '@/components/Portal';
import {
  addDays,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeekMonday,
} from '@/pages/calendar/calendarConstants';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
const PICKER_W = 288;

type MonthAnim = 'left' | 'right' | null;

export function CalendarDatePickerPopover(props: Readonly<{
  open: boolean;
  onClose: () => void;
  selected: Date;
  onSelect: (date: Date) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}>) {
  const { open, onClose, selected, onSelect, anchorRef } = props;
  const menuRef = useRef<HTMLDivElement>(null);
  const gridId = useId();
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected));
  const [monthAnim, setMonthAnim] = useState<MonthAnim>(null);
  const [mounted, setMounted] = useState(open);
  const [exiting, setExiting] = useState(false);

  const today = startOfDay(new Date());

  useEffect(() => {
    if (open) {
      setMounted(true);
      setExiting(false);
      setViewMonth(startOfMonth(selected));
    } else if (mounted) {
      setExiting(true);
      const t = window.setTimeout(() => {
        setMounted(false);
        setExiting(false);
      }, 140);
      return () => window.clearTimeout(t);
    }
  }, [open, mounted, selected]);

  useLayoutEffect(() => {
    if (!mounted || !anchorRef.current) {
      setMenuStyle(null);
      return;
    }
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.min(
        Math.max(8, rect.left),
        window.innerWidth - PICKER_W - 8,
      );
      setMenuStyle({
        top: rect.bottom + 8,
        left,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [mounted, anchorRef]);

  useEffect(() => {
    if (!mounted || exiting) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [mounted, exiting, onClose, anchorRef]);

  const days = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const start = startOfWeekMonday(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [viewMonth]);

  const monthLabel = viewMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  function shiftMonth(delta: -1 | 1) {
    setMonthAnim(delta === -1 ? 'right' : 'left');
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  function pick(day: Date) {
    onSelect(startOfDay(day));
    onClose();
  }

  function monthGridAnimClass() {
    if (monthAnim === 'left') return 'bc-cal-period-from-left';
    if (monthAnim === 'right') return 'bc-cal-period-from-right';
    return '';
  }

  if (!mounted || !menuStyle) return null;

  return (
    <Portal>
      <div
        ref={menuRef}
        id={gridId}
        role="dialog"
        aria-modal="false"
        aria-label="Choisir une date"
        className={[
          'fixed z-[250] overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-xl shadow-zinc-400/20',
          exiting ? 'bc-menu-exit' : 'bc-cal-picker-enter',
        ].join(' ')}
        style={{ top: menuStyle.top, left: menuStyle.left, width: PICKER_W }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2.5">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="bc-interactive flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-sm font-bold capitalize tracking-tight text-zinc-900">
            {monthLabel}
          </p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="bc-interactive flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <div className="px-3 pt-2">
          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((wd, i) => (
              <div
                key={`${wd}-${i}`}
                className="flex h-7 items-center justify-center text-[10px] font-bold uppercase tracking-wide text-zinc-400"
              >
                {wd}
              </div>
            ))}
          </div>

          <div
            key={`${viewMonth.getFullYear()}-${viewMonth.getMonth()}`}
            className={['grid grid-cols-7 gap-0.5 pb-2', monthGridAnimClass()].filter(Boolean).join(' ')}
          >
            {days.map((day) => {
              const inMonth = day.getMonth() === viewMonth.getMonth();
              const isSelected = isSameDay(day, selected);
              const isToday = isSameDay(day, today);
              const weekend = (day.getDay() + 6) % 7 >= 5;

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => pick(day)}
                  className={[
                    'bc-interactive relative flex h-9 w-full items-center justify-center rounded-xl text-sm font-semibold',
                    isSelected
                      ? 'bg-[#416B9F] text-white shadow-sm shadow-[#416B9F]/30'
                      : inMonth
                        ? weekend
                          ? 'text-zinc-500 hover:bg-zinc-100'
                          : 'text-zinc-800 hover:bg-zinc-100'
                        : 'text-zinc-300 hover:bg-zinc-50',
                    isToday && !isSelected ? 'ring-2 ring-inset ring-[#416B9F]/35' : '',
                  ].join(' ')}
                  aria-label={day.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  aria-pressed={isSelected}
                >
                  {day.getDate()}
                  {isToday && !isSelected ? (
                    <span
                      className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#416B9F]"
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-center border-t border-zinc-100 px-3 py-2">
          <button
            type="button"
            onClick={() => pick(today)}
            className="bc-interactive rounded-lg px-3 py-1.5 text-xs font-semibold text-[#416B9F] hover:bg-[#416B9F]/8"
          >
            Aujourd’hui
          </button>
        </div>
      </div>
    </Portal>
  );
}
