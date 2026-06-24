import { Ban } from 'lucide-react';
import type { BoatUnavailability } from '@/stores/unavailabilities';
import { CALENDAR_UNAVAILABILITY_COLORS } from '@/lib/reservationStatus';

export function UnavailabilityPill(props: Readonly<{
  item: BoatUnavailability;
  label: string;
  height?: number;
  minHeight?: number;
  className: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}>) {
  const { item, label, height, minHeight, className, style, onClick } = props;
  return (
    <button
      type="button"
      data-unavailability-pill
      className={className}
      style={{
        background: CALENDAR_UNAVAILABILITY_COLORS.background,
        color: CALENDAR_UNAVAILABILITY_COLORS.text,
        height,
        minHeight,
        ...style,
      }}
      title={item.note ? `${label} — ${item.note}` : label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <span className="flex min-w-0 items-center gap-1 truncate text-left">
        <Ban className="h-3 w-3 shrink-0 opacity-80" strokeWidth={2.25} aria-hidden />
        <span className="truncate">{label}</span>
      </span>
    </button>
  );
}
