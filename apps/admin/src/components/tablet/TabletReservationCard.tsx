import { fmtTabletTime } from '@/lib/tablet';
import { TB } from '@/lib/tabletTheme';
import { tabletFlowAccessForReservation } from '@/lib/checkFlowTabletAccess';
import { TabletCheckFlowActionButton } from '@/components/tablet/TabletCheckFlowActions';
import type { TabletReservationRow } from '@/stores/checkFlow';

type Props = {
  reservation: TabletReservationRow;
  compact?: boolean;
};

export function TabletReservationCard({ reservation: r, compact }: Props) {
  const inAccess = tabletFlowAccessForReservation(r, 'CHECK_IN');
  const outAccess = tabletFlowAccessForReservation(r, 'CHECK_OUT');
  const pending = inAccess.mode === 'submit' || outAccess.mode === 'submit';

  return (
    <li className={[TB.card, pending ? TB.cardHighlight : ''].filter(Boolean).join(' ')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-snug text-zinc-900">{r.title}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {r.boat.brand} {r.boat.name}
          </p>
          {!compact ? (
            <p className="mt-1.5 text-sm font-semibold text-zinc-700">
              {fmtTabletTime(r.startAt)} — {fmtTabletTime(r.endAt)}
            </p>
          ) : null}
        </div>
        {pending ? (
          <span className={TB.badgePending}>À compléter</span>
        ) : (
          <span className={TB.badgeDone}>Terminé</span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2">
        <TabletCheckFlowActionButton reservation={r} kind="CHECK_IN" />
        <TabletCheckFlowActionButton reservation={r} kind="CHECK_OUT" />
      </div>
    </li>
  );
}
