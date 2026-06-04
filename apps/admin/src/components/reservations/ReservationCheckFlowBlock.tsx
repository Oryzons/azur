import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';
import { useCheckFlowStore, type CheckFlowSubmissionSummary } from '@/stores/checkFlow';

function StatusCard(props: {
  label: string;
  done: boolean;
  submission: CheckFlowSubmissionSummary | null;
}) {
  return (
    <div className="rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-3">
      <div className="flex items-center gap-2">
        {props.done ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
        ) : (
          <Circle className="h-5 w-5 text-zinc-300" aria-hidden />
        )}
        <span className="text-sm font-semibold text-zinc-900">{props.label}</span>
        <span className={`ml-auto text-xs font-medium ${props.done ? 'text-emerald-700' : 'text-zinc-400'}`}>
          {props.done ? 'Effectué' : 'En attente'}
        </span>
      </div>
      {props.done && props.submission?.id ? (
        <Link
          to={`/check-flow/historique?id=${props.submission.id}`}
          className="mt-3 block w-full rounded-lg border border-[#416B9F]/30 bg-white px-3 py-2 text-center text-sm font-semibold text-[#416B9F] transition hover:bg-[#416B9F]/5"
        >
          Voir le détail
        </Link>
      ) : null}
    </div>
  );
}

export function ReservationCheckFlowBlock(props: Readonly<{ reservationId: string }>) {
  const fetchStatus = useCheckFlowStore((s) => s.fetchReservationStatus);
  const [checkIn, setCheckIn] = useState<CheckFlowSubmissionSummary | null>(null);
  const [checkOut, setCheckOut] = useState<CheckFlowSubmissionSummary | null>(null);

  useEffect(() => {
    void fetchStatus(props.reservationId).then(({ checkIn: ci, checkOut: co }) => {
      setCheckIn(ci);
      setCheckOut(co);
    });
  }, [props.reservationId, fetchStatus]);

  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Check-in / Check-out</p>
      <div className="mt-3 space-y-2">
        <StatusCard label="Check-in" done={Boolean(checkIn)} submission={checkIn} />
        <StatusCard label="Check-out" done={Boolean(checkOut)} submission={checkOut} />
      </div>
    </div>
  );
}
