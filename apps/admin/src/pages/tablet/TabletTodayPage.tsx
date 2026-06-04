import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { TabletReservationCard } from '@/components/tablet/TabletReservationCard';
import { fmtTabletDate, todayIso } from '@/lib/tablet';
import { TB } from '@/lib/tabletTheme';
import { useTabletDayReservations } from '@/pages/tablet/useTabletDayReservations';

function countPending(rows: { checkFlowSubmissions: { kind: string }[] }[]) {
  return rows.filter((r) => {
    const inDone = r.checkFlowSubmissions.some((s) => s.kind === 'CHECK_IN');
    const outDone = r.checkFlowSubmissions.some((s) => s.kind === 'CHECK_OUT');
    return !inDone || !outDone;
  }).length;
}

export function TabletTodayPage() {
  const day = todayIso();
  const { rows, loading, error, reload } = useTabletDayReservations(day);
  const pending = useMemo(() => countPending(rows), [rows]);

  return (
    <div className={TB.page}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className={TB.h1}>Aujourd&apos;hui</h1>
          <p className={TB.subtitle}>{fmtTabletDate(`${day}T12:00:00`)}</p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          className={TB.iconBtn}
          aria-label="Actualiser"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!loading && rows.length > 0 ? (
        <p className={`mt-4 ${TB.info}`}>
          {pending === 0
            ? 'Tous les check-in et check-out du jour sont faits.'
            : `${pending} réservation${pending > 1 ? 's' : ''} avec formulaire${pending > 1 ? 's' : ''} à compléter.`}
        </p>
      ) : null}

      {error ? <p className={`mt-6 ${TB.error}`}>{error}</p> : null}

      {loading ? (
        <p className={`mt-10 ${TB.empty}`}>Chargement…</p>
      ) : rows.length === 0 ? (
        <p className={`mt-10 ${TB.empty}`}>Aucune réservation aujourd&apos;hui.</p>
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
