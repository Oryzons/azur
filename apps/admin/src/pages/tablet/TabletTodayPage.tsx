import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TabletAgentWelcomeHeader } from '@/components/tablet/TabletAgentWelcomeHeader';
import { TabletBoatActionCard } from '@/components/tablet/TabletBoatActionCard';
import { TabletReservationCard } from '@/components/tablet/TabletReservationCard';
import { fmtTabletDate, todayIso } from '@/lib/tablet';
import { tabletFlowAccessForReservation } from '@/lib/checkFlowTabletAccess';
import { listTabletPendingActions } from '@/lib/tabletPendingActions';
import { TB } from '@/lib/tabletTheme';
import { useTabletDayReservations } from '@/pages/tablet/useTabletDayReservations';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';
import type { TabletReservationRow } from '@/stores/checkFlow';

type Filter = 'all' | 'pending' | 'done';

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'pending', label: 'À faire' },
  { id: 'done', label: 'Terminées' },
];

function isPending(r: TabletReservationRow): boolean {
  const inAccess = tabletFlowAccessForReservation(r, 'CHECK_IN');
  const outAccess = tabletFlowAccessForReservation(r, 'CHECK_OUT');
  return inAccess.mode === 'submit' || outAccess.mode === 'submit';
}

function filterRows(rows: TabletReservationRow[], filter: Filter): TabletReservationRow[] {
  if (filter === 'pending') return rows.filter(isPending);
  if (filter === 'done') return rows.filter((r) => !isPending(r));
  return rows;
}

export function TabletTodayPage() {
  const navigate = useNavigate();
  const day = todayIso();
  const { rows, loading, error, reload } = useTabletDayReservations(day);
  const [filter, setFilter] = useState<Filter>('all');
  const rt = useAuthStore((s) => s.refreshToken);
  const clear = useAuthStore((s) => s.clear);

  const pendingActions = useMemo(() => listTabletPendingActions(rows), [rows]);
  const filtered = useMemo(() => filterRows(rows, filter), [rows, filter]);
  const pendingCount = pendingActions.length;

  const list = useMemo(() => {
    if (filter === 'pending') return [];
    if (filter === 'done') return filtered;
    return rows.filter((r) => !isPending(r));
  }, [rows, filter, filtered]);

  const showActionCards = filter === 'all' || filter === 'pending';

  async function logout() {
    try {
      if (rt) await api.post('/auth/logout', { refreshToken: rt });
    } catch {
      /* ignore */
    }
    clear();
    navigate('/login', { replace: true });
  }

  return (
    <div className={TB.homePage}>
      <TabletAgentWelcomeHeader
        onRefresh={() => void reload()}
        refreshing={loading}
        onLogout={() => void logout()}
      />

      <h1 className={TB.h1Hero}>Vos réservations du jour</h1>
      <p className={TB.subtitle}>{fmtTabletDate(`${day}T12:00:00`)}</p>

      <div className="-mx-1 mt-6 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filters.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={[TB.chip, active ? TB.chipActive : TB.chipIdle].join(' ')}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {!loading && rows.length > 0 ? (
        <p className={`mt-5 ${TB.info}`}>
          {pendingCount === 0
            ? 'Tous les check-in et check-out du jour sont faits.'
            : `${pendingCount} action${pendingCount > 1 ? 's' : ''} à compléter.`}
        </p>
      ) : null}

      {error ? <p className={`mt-6 ${TB.error}`}>{error}</p> : null}

      {loading ? (
        <p className={`mt-12 ${TB.empty}`}>Chargement…</p>
      ) : rows.length === 0 ? (
        <p className={`mt-12 ${TB.empty}`}>Aucune réservation aujourd&apos;hui.</p>
      ) : (
        <div className="bc-page-stagger mt-6 space-y-6">
          {showActionCards && pendingActions.length > 0 ? (
            <section>
              <h2 className={`mb-3 ${TB.sectionTitle}`}>Prochaines actions</h2>
              <ul className="space-y-4">
                {pendingActions.map((action) => (
                  <li key={`${action.reservation.id}-${action.kind}`}>
                    <TabletBoatActionCard reservation={action.reservation} kind={action.kind} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {list.length > 0 ? (
            <section>
              <h2 className={`mb-3 ${TB.sectionTitle}`}>
                {filter === 'done' ? 'Terminées' : 'Autres réservations'}
              </h2>
              <ul className="space-y-3">
                {list.map((r) => (
                  <TabletReservationCard key={r.id} reservation={r} />
                ))}
              </ul>
            </section>
          ) : filter === 'pending' && pendingActions.length === 0 ? (
            <p className={TB.empty}>Aucune action en attente.</p>
          ) : filter === 'done' && list.length === 0 ? (
            <p className={TB.empty}>Aucune réservation terminée.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
