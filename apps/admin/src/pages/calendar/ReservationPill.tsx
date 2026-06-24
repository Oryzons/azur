import { useMemo, useRef } from 'react';
import { Baby, Coins, FileText, type LucideIcon } from 'lucide-react';
import { resolveExtraIcon } from '@bleu-calanque/shared';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import {
  allowReservationDragOver,
  setReservationDragData,
} from '@/pages/calendar/calendarReservationDrag';
import { extraIconComponent } from '@/lib/extraIcons';
import { buildReservationPaymentContext } from '@/lib/reservationOfflineDue';
import {
  CALENDAR_STATUS_COLORS,
  calendarPillTextColor,
  reservationPillColor,
  reservationTerminalVisualStatus,
  resolveReservationStatus,
} from '@/lib/reservationStatus';
import { useExtrasStore } from '@/stores/extras';
import { useCouponsStore } from '@/stores/coupons';
import { deserializeReservation, useReservationsStore } from '@/stores/reservations';
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

function ReservationPillIcons(props: Readonly<{ icons: PillIcon[]; compact?: boolean }>) {
  const { icons, compact } = props;
  if (icons.length === 0) return null;

  const iconClass = compact ? 'h-2.5 w-2.5' : 'h-3 w-3';
  const visible = compact ? icons.slice(0, 4) : icons;
  const overflow = icons.length - visible.length;

  return (
    <span className="flex min-w-0 items-center justify-center gap-0.5 opacity-90">
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
  /** Cible de dépôt pour déplacer une autre réservation sur ce créneau. */
  onMoveDrop?: (e: React.DragEvent<HTMLElement>) => void;
  /** Masque skipper / extras / paiement (espace propriétaire). */
  minimal?: boolean;
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
    onMoveDrop,
    minimal = false,
  } = props;
  const suppressClickRef = useRef(false);
  const extrasCatalog = useExtrasStore((s) => s.extras);
  const couponsCatalog = useCouponsStore((s) => s.coupons);
  const reservationItems = useReservationsStore((s) => s.items);
  const allReservations = useMemo(
    () => reservationItems.map((s) => deserializeReservation(s)),
    [reservationItems],
  );
  const paymentCtx = buildReservationPaymentContext(
    reservation,
    extrasCatalog,
    couponsCatalog,
    allReservations,
  );
  const pillIcons = minimal ? [] : buildReservationPillIcons(reservation, extrasCatalog);
  const bg = minimal
    ? CALENDAR_STATUS_COLORS.reserved
    : reservationPillColor({
        ...reservation,
        offlineDueCents: paymentCtx.offlineDueCents,
        offlinePaidCents: paymentCtx.offlinePaidCents,
        outstandingOnlineDueCents: paymentCtx.outstandingOnlineDueCents,
        paymentLinkUrl: paymentCtx.paymentLinkUrl ?? reservation.paymentLinkUrl,
        remainingTotalCents: paymentCtx.remainingTotalCents,
      });
  const color = calendarPillTextColor(bg);
  const terminalStatus = minimal ? null : reservationTerminalVisualStatus(reservation);
  const visualClass = terminalStatus ? 'opacity-95 ring-1 ring-inset ring-white/25' : '';
  const compact = height != null && height < 32;
  const canDrag = draggable;

  return (
    <div
      role="button"
      tabIndex={0}
      data-reservation-pill
      data-reservation-status={terminalStatus ?? resolveReservationStatus(reservation.details)}
      className={[
        className,
        'flex-col justify-center gap-0.5 overflow-hidden py-0.5 select-none',
        canDrag ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-pointer',
        visualClass,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ background: bg, color, height, minHeight, ...style }}
      title={[
        label,
        sameDayTimes(reservation),
        ...pillIcons.map((i) => i.title),
        canDrag ? 'Glisser-déposer pour déplacer' : undefined,
      ]
        .filter(Boolean)
        .join(' · ')}
      draggable={canDrag}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        onClick?.();
      }}
      onDragStart={(e) => {
        if (!canDrag) {
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        setReservationDragData(e.dataTransfer, reservation.id);
        if (e.currentTarget instanceof HTMLElement) {
          e.dataTransfer.setDragImage(e.currentTarget, e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        }
      }}
      onDragEnd={() => {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }}
      onDragOver={(e) => {
        if (!onMoveDrop) return;
        allowReservationDragOver(e);
        e.stopPropagation();
      }}
      onDrop={(e) => {
        if (!onMoveDrop) return;
        e.preventDefault();
        e.stopPropagation();
        onMoveDrop(e);
      }}
    >
      <span className={['w-full min-w-0 truncate leading-tight', compact ? 'text-[9px]' : ''].join(' ')}>
        {label}
      </span>
      {!minimal ? <ReservationPillIcons icons={pillIcons} compact={compact} /> : null}
    </div>
  );
}
