import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { TabletBoatCoverImage } from '@/components/tablet/TabletBoatCoverImage';
import { formatBoatDisplayName, formatBoatSpecsLine } from '@/lib/tabletBoat';
import {
  checkKindHeroBadgeClass,
  checkKindHeroDotClass,
} from '@/lib/tabletCheckKindTheme';
import type { CheckFlowKind, TabletReservationRow } from '@/stores/checkFlow';

const KIND_LABEL: Record<CheckFlowKind, string> = {
  CHECK_IN: 'Check-in',
  CHECK_OUT: 'Check-out',
};

type Props = {
  reservation: TabletReservationRow;
  kind: CheckFlowKind;
};

export function TabletBoatActionCard({ reservation, kind }: Props) {
  const specs = formatBoatSpecsLine(reservation.boat);
  const name = formatBoatDisplayName(reservation.boat);

  return (
    <Link
      to={`/tablette/reservation/${reservation.id}`}
      className="group relative block overflow-hidden rounded-[1.75rem] touch-manipulation transition-transform duration-300 active:scale-[0.98]"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <TabletBoatCoverImage
          boat={reservation.boat}
          imgClassName="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-active:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-white">{name}</p>
            {specs ? <p className="mt-0.5 truncate text-sm text-white/75">{specs}</p> : null}
            <span
              className={[
                'mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm ring-1',
                checkKindHeroBadgeClass(kind),
              ].join(' ')}
            >
              <span className={['h-1.5 w-1.5 rounded-full', checkKindHeroDotClass(kind)].join(' ')} aria-hidden />
              {KIND_LABEL[kind]}
            </span>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-zinc-900 shadow-lg transition-transform duration-300 group-active:scale-95">
            <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
