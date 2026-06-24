import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { TabletDayPicker } from '@/components/tablet/TabletDayPicker';
import { TabletReservationCard } from '@/components/tablet/TabletReservationCard';
import { fmtTabletDate, todayIso } from '@/lib/tablet';
import { TB } from '@/lib/tabletTheme';
import { useTabletDayReservations } from '@/pages/tablet/useTabletDayReservations';

export function TabletReservationsPage() {
  const [day, setDay] = useState(todayIso);
  const { rows, loading, error, reload } = useTabletDayReservations(day);

  return (
    <div className={TB.page}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className={TB.h1}>Réservations</h1>
          <p className={TB.subtitle}>{fmtTabletDate(`${day}T12:00:00`)}</p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          className={TB.iconBtnRound}
          aria-label="Actualiser"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="mt-5">
        <TabletDayPicker value={day} onChange={setDay} />
      </div>

      {error ? <p className={`mt-6 ${TB.error}`}>{error}</p> : null}

      {loading ? (
        <p className={`mt-10 ${TB.empty}`}>Chargement…</p>
      ) : rows.length === 0 ? (
        <p className={`mt-10 ${TB.empty}`}>Aucune réservation ce jour-là.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <TabletReservationCard key={r.id} reservation={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
