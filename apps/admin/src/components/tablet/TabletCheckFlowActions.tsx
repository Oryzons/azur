import { Link } from 'react-router-dom';
import { Eye, LogIn, LogOut } from 'lucide-react';
import {
  CHECK_FLOW_SUBMIT_GRACE_DAYS,
  tabletFlowAccessForReservation,
} from '@/lib/checkFlowTabletAccess';
import type { CheckFlowKind, TabletReservationRow } from '@/stores/checkFlow';

const KIND_LABEL: Record<CheckFlowKind, string> = {
  CHECK_IN: 'Check-in',
  CHECK_OUT: 'Check-out',
};

const KIND_ICON: Record<CheckFlowKind, typeof LogIn> = {
  CHECK_IN: LogIn,
  CHECK_OUT: LogOut,
};

type Props = {
  reservation: TabletReservationRow;
  kind: CheckFlowKind;
};

export function TabletCheckFlowActionButton({ reservation, kind }: Props) {
  const access = tabletFlowAccessForReservation(reservation, kind);
  const Icon = KIND_ICON[kind];
  const path = kind === 'CHECK_IN' ? `/tablette/check-in/${reservation.id}` : `/tablette/check-out/${reservation.id}`;

  if (access.mode === 'expired') {
    return (
      <span
        className="inline-flex min-h-[3rem] cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-zinc-200/90 bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-400"
        title={`Délai dépassé (${CHECK_FLOW_SUBMIT_GRACE_DAYS} jours après le ${kind === 'CHECK_IN' ? 'départ' : 'retour'})`}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden />
        {KIND_LABEL[kind]} — expiré
      </span>
    );
  }

  const isDone = access.mode === 'view' || access.mode === 'done_today';

  return (
    <Link
      to={path}
      className={[
        'inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold touch-manipulation',
        isDone
          ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 active:scale-[0.98]'
          : kind === 'CHECK_IN'
            ? 'bg-[#416B9F] text-white shadow-sm shadow-[#416B9F]/20 active:scale-[0.98]'
            : 'border border-zinc-200/90 bg-white text-zinc-800 shadow-sm active:scale-[0.98]',
      ].join(' ')}
    >
      {isDone ? <Eye className="h-5 w-5 shrink-0" aria-hidden /> : <Icon className="h-5 w-5 shrink-0" aria-hidden />}
      {access.mode === 'done_today'
        ? `${KIND_LABEL[kind]} ✓`
        : isDone
          ? `Voir ${KIND_LABEL[kind].toLowerCase()}`
          : KIND_LABEL[kind]}
    </Link>
  );
}
