import type { Reservation } from '@/pages/calendar/reservationTypes';
import {
  reservationPillColor,
  reservationPillTextColor,
  reservationTerminalVisualStatus,
  resolveReservationStatus,
} from '@/lib/reservationStatus';

export function ReservationPill(props: Readonly<{
  reservation: Reservation;
  label: string;
  height?: number;
  minHeight?: number;
  className: string;
  style?: React.CSSProperties;
  draggable?: boolean;
  onClick?: () => void;
}>) {
  const { reservation, label, height, minHeight, className, style, draggable = true, onClick } = props;
  const bg = reservationPillColor(reservation);
  const color = reservationPillTextColor(reservation.details);
  const terminalStatus = reservationTerminalVisualStatus(reservation);
  const ended =
    !terminalStatus &&
    (reservation.checkOutDone || reservation.end.getTime() < Date.now());
  const visualClass = terminalStatus
    ? 'opacity-95 ring-1 ring-inset ring-white/25'
    : ended
      ? 'opacity-55 grayscale'
      : '';
  return (
    <button
      type="button"
      data-reservation-pill
      data-reservation-status={terminalStatus ?? resolveReservationStatus(reservation.details)}
      className={[className, visualClass].filter(Boolean).join(' ')}
      style={{ background: bg, color, height, minHeight, ...style }}
      title={label}
      draggable={draggable}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onDragStart={(e) => {
        if (!draggable) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData('text/reservationId', reservation.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}
