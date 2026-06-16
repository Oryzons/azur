import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import { reservationsForClient } from '@/lib/reservationsForClient';
import { resolveReservationStatus, statusBadgeClass, statusDisplayLabel } from '@/lib/reservationStatus';
import { deserializeReservation, useReservationsStore } from '@/stores/reservations';
import { useBoatsStore } from '@/stores/boats';

const PAGE_SIZE = 5;

function fmtPeriod(r: Reservation) {
  const sameDay =
    r.start.getFullYear() === r.end.getFullYear() &&
    r.start.getMonth() === r.end.getMonth() &&
    r.start.getDate() === r.end.getDate();
  const date = r.start.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  const t0 = r.start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const t1 = r.end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `${date} · ${t0} – ${t1}` : `${date} ${t0} → ${r.end.toLocaleDateString('fr-FR')}`;
}

export function ClientReservationHistory(props: Readonly<{
  memberId?: string | null;
  clientEmail?: string | null;
  excludeReservationId?: string | null;
  onOpenReservation?: (id: string) => void;
  pageSize?: number;
  compact?: boolean;
}>) {
  const {
    memberId,
    clientEmail,
    excludeReservationId,
    onOpenReservation,
    pageSize = PAGE_SIZE,
    compact = false,
  } = props;
  const rawItems = useReservationsStore((s) => s.items);
  const boats = useBoatsStore((s) => s.boats);
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const clientKey = `${memberId ?? ''}|${clientEmail ?? ''}|${excludeReservationId ?? ''}`;

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [clientKey, pageSize]);

  const allRows = useMemo(() => {
    const all = rawItems.map(deserializeReservation);
    return reservationsForClient(all, {
      memberId,
      email: clientEmail,
      excludeId: excludeReservationId,
    });
  }, [rawItems, memberId, clientEmail, excludeReservationId]);

  const rows = useMemo(() => allRows.slice(0, visibleCount), [allRows, visibleCount]);
  const hasMore = visibleCount < allRows.length;
  const remaining = allRows.length - visibleCount;
  const nextBatch = Math.min(pageSize, remaining);

  const memberIdTrim = memberId?.trim();
  const emailTrim = clientEmail?.trim();
  if (!memberIdTrim && !emailTrim) return null;

  if (allRows.length === 0) {
    return (
      <div className={compact ? 'mt-3' : 'mt-4'}>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Historique réservations</p>
        <p className="mt-2 text-sm text-zinc-500">Aucune autre réservation enregistrée pour ce client.</p>
      </div>
    );
  }

  return (
    <div className={compact ? 'mt-3' : 'mt-4'}>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Historique réservations
        <span className="ml-1.5 font-normal normal-case text-zinc-400">({allRows.length})</span>
      </p>
      <ul className={`space-y-1.5 ${compact ? 'mt-2' : 'mt-3'}`}>
        {rows.map((r) => {
          const boatName = boats.find((b) => b.id === r.boatId)?.name ?? r.boatId;
          const status = resolveReservationStatus(r.details);
          const content = (
            <>
              <span className="block font-semibold text-zinc-900">{r.title}</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                {fmtPeriod(r)} · {boatName}
              </span>
              {status !== 'reserved_paid' || !r.details?.paymentCapturedAt ? (
                <span
                  className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(status, r.details, { installmentPlan: r.installmentPlan })}`}
                >
                  {statusDisplayLabel(status, r.details, { installmentPlan: r.installmentPlan })}
                </span>
              ) : null}
            </>
          );
          const className = [
            'w-full rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-3 py-2.5 text-left text-sm transition-colors',
            onOpenReservation ? 'hover:bg-white hover:shadow-sm' : '',
          ].join(' ');

          return (
            <li key={r.id}>
              {onOpenReservation ? (
                <button type="button" className={className} onClick={() => onOpenReservation(r.id)}>
                  {content}
                </button>
              ) : (
                <div className={className}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      {hasMore ? (
        <button
          type="button"
          onClick={() => setVisibleCount((n) => n + pageSize)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm font-semibold text-[#416B9F] shadow-sm transition-colors hover:bg-zinc-50"
          aria-label={`Afficher ${nextBatch} réservation${nextBatch > 1 ? 's' : ''} de plus`}
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
          Afficher {nextBatch} réservation{nextBatch > 1 ? 's' : ''} suivante{nextBatch > 1 ? 's' : ''}
          <span className="text-xs font-normal text-zinc-500">
            ({visibleCount}/{allRows.length})
          </span>
        </button>
      ) : null}
    </div>
  );
}
