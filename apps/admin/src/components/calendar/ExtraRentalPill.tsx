import { resolveExtraIcon } from '@bleu-calanque/shared';
import { extraIconComponent } from '@/lib/extraIcons';
import { CALENDAR_EXTRA_RENTAL_COLOR } from '@/lib/reservationStatus';
import type { ExtraRental } from '@/stores/extraRentals';

export function ExtraRentalPill(props: Readonly<{
  item: ExtraRental;
  label: string;
  height?: number;
  minHeight?: number;
  className: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}>) {
  const { item, label, height, minHeight, className, style, onClick } = props;
  const Icon = extraIconComponent(resolveExtraIcon(item.extra?.icon));
  return (
    <button
      type="button"
      data-extra-rental-pill
      className={className}
      style={{
        background: CALENDAR_EXTRA_RENTAL_COLOR,
        color: '#FFFFFF',
        height,
        minHeight,
        ...style,
      }}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <span className="flex min-w-0 items-center gap-1 truncate text-left">
        <Icon className="h-3 w-3 shrink-0 opacity-90" strokeWidth={2.25} />
        <span className="truncate">{label}</span>
      </span>
    </button>
  );
}
