import { Baby, Coins, FileText, type LucideIcon } from 'lucide-react';
import { resolveExtraIcon } from '@bleu-calanque/shared';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import { extraIconComponent } from '@/lib/extraIcons';
import { reservationPaymentContext } from '@/lib/reservationOfflineDue';
import {
  reservationPillColor,
  reservationPillTextColor,
  reservationTerminalVisualStatus,
  resolveReservationStatus,
} from '@/lib/reservationStatus';
import { useExtrasStore } from '@/stores/extras';
import { formatTime, startOfDay } from '@/pages/calendar/calendarConstants';

type PillIcon = { key: string; Icon: LucideIcon; title: string };

function sameDayTimes(reservation: Reservation) {
  const sameDay = startOfDay(reservation.start).getTime() === startOfDay(reservation.end).getTime();
  if (!sameDay) return '';
  return `${formatTime(reservation.start)}–${formatTime(reservation.end)}`;
}

function buildReservationPillIcons(
  reservation: Reservation,
  extrasCatalog: ReturnType<typeof useExtrasStore.getState>['extras'],
): PillIcon[] {
  const d = reservation.details;
  if (!d) return [];

  const icons: PillIcon[] = [];

  if (d.installments === 2) {
    icons.push({ key: 'installments', Icon: Coins, title: 'Paiement en 2 fois' });
  }
  if (d.hasChildren) {
    icons.push({ key: 'children', Icon: Baby, title: 'Enfants à bord' });
  }
  if (d.internalNote?.trim()) {
    icons.push({ key: 'internal-note', Icon: FileText, title: 'Note interne' });
  }

  const selectedIds = new Set(
    Object.entries(d.extras ?? {})
      .filter(([, on]) => Boolean(on))
      .map(([id]) => id),
  );
  const seenIconKeys = new Set<string>();
  for (const extra of extrasCatalog) {
    if (!selectedIds.has(extra.id)) continue;
    const iconKey = resolveExtraIcon(extra.icon);
    if (seenIconKeys.has(iconKey)) continue;
    seenIconKeys.add(iconKey);
    icons.push({
      key: `extra-${extra.id}`,
      Icon: extraIconComponent(extra.icon),
      title: extra.name,
    });
  }

  return icons;
}

function ReservationPillIcons(props: Readonly<{ icons: PillIcon[]; compact?: boolean; inline?: boolean }>) {
  const { icons, compact, inline } = props;
  if (icons.length === 0) return null;

  const iconClass = compact ? 'h-2.5 w-2.5' : 'h-3 w-3';
  const visible = compact ? icons.slice(0, inline ? 2 : 4) : icons;
  const overflow = icons.length - visible.length;

  return (
    <span className={['flex shrink-0 items-center gap-0.5', inline ? '' : 'min-w-0 opacity-90'].join(' ')}>
      {visible.map((item) => (
        <span key={item.key} title={item.title} className="inline-flex shrink-0">
          <item.Icon className={iconClass} strokeWidth={2.25} aria-hidden />
        </span>
      ))}
      {overflow > 0 ? (
        <span className={compact ? 'text-[8px] font-bold' : 'text-[9px] font-bold'} title={icons.map((i) => i.title).join(' · ')}>
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}

export function ReservationPill(props: Readonly<{
  reservation: Reservation;
  label: string;
  height?: number;
  minHeight?: number;
  className: string;
  style?: React.CSSProperties;
  draggable?: boolean;
  onClick?: () => void;
  /** Masque skipper / extras / paiement (espace propriétaire). */
  minimal?: boolean;
  /** Couleur neutre sans statut client (espace propriétaire). */
  neutralStyle?: boolean;
}>) {
  const {
    reservation,
    label,
    height,
    minHeight,
    className,
    style,
    draggable = true,
    onClick,
    minimal = false,
    neutralStyle = false,
  } = props;
  const extrasCatalog = useExtrasStore((s) => s.extras);
  const paymentCtx = reservationPaymentContext(reservation, extrasCatalog);
  const pillIcons = minimal ? [] : buildReservationPillIcons(reservation, extrasCatalog);
  const bg = neutralStyle
    ? '#64748B'
    : reservationPillColor({
        ...reservation,
        offlineDueCents: paymentCtx.offlineDueCents,
      });
  const color = neutralStyle ? '#fff' : reservationPillTextColor(reservation.details);
  const terminalStatus = neutralStyle ? null : reservationTerminalVisualStatus(reservation);
  const ended =
    !neutralStyle &&
    !terminalStatus &&
    (reservation.checkOutDone || reservation.end.getTime() < Date.now());
  const visualClass = terminalStatus
    ? 'opacity-95 ring-1 ring-inset ring-white/25'
    : ended
      ? 'opacity-55 grayscale'
      : '';
  const compact = height != null && height <= 34;
  const inlineIcons = compact;
  return (
    <button
      type="button"
      data-reservation-pill
      data-reservation-status={terminalStatus ?? resolveReservationStatus(reservation.details)}
      className={[
        className,
        inlineIcons ? 'flex-row items-center gap-1 px-1.5' : 'flex-col justify-center gap-0.5 py-0.5',
        'overflow-hidden',
        visualClass,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ background: bg, color, height, minHeight, ...style }}
      title={[
        label,
        sameDayTimes(reservation),
        ...pillIcons.map((i) => i.title),
      ]
        .filter(Boolean)
        .join(' · ')}
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
      <span
        className={[
          'min-w-0 leading-tight',
          inlineIcons ? 'flex-1 truncate text-[10px]' : 'w-full truncate',
          compact && !inlineIcons ? 'text-[9px]' : '',
        ].join(' ')}
      >
        {label}
      </span>
      {!minimal ? (
        <ReservationPillIcons icons={pillIcons} compact={compact || inlineIcons} inline={inlineIcons} />
      ) : null}
    </button>
  );
}
