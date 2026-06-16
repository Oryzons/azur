import type { BoatUnavailability } from '@/stores/unavailabilities';

const UNAVAIL_BG = '#71717a';
const UNAVAIL_FG = '#ffffff';

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
      style={{ background: UNAVAIL_BG, color: UNAVAIL_FG, height, minHeight, ...style }}
      title={item.note ? `${label} — ${item.note}` : label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <span className="block w-full min-w-0 truncate text-left">{label}</span>
    </button>
  );
}
