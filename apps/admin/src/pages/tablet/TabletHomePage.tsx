import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, LogOut } from 'lucide-react';
import { useCheckFlowStore, type TabletReservationRow } from '@/stores/checkFlow';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function hasSubmission(r: TabletReservationRow, kind: 'CHECK_IN' | 'CHECK_OUT') {
  return r.checkFlowSubmissions.some((s) => s.kind === kind);
}

export function TabletHomePage() {
  const fetchTablet = useCheckFlowStore((s) => s.fetchTabletReservations);
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<TabletReservationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchTablet(day).then((data) => {
      if (!cancelled) setRows(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [day, fetchTablet]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [rows],
  );

  return (
    <div className="px-4 py-5">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Journée</span>
        <input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white"
        />
      </label>

      {loading ? (
        <p className="mt-8 text-center text-slate-400">Chargement…</p>
      ) : sorted.length === 0 ? (
        <p className="mt-8 text-center text-slate-400">Aucune réservation ce jour.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {sorted.map((r) => {
            const inDone = hasSubmission(r, 'CHECK_IN');
            const outDone = hasSubmission(r, 'CHECK_OUT');
            return (
              <li
                key={r.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/20"
              >
                <p className="text-base font-bold text-white">{r.title}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {r.boat.brand} {r.boat.name} · {fmtTime(r.startAt)} — {fmtTime(r.endAt)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/tablette/check-in/${r.id}`}
                    className={[
                      'inline-flex min-w-[8rem] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold',
                      inDone
                        ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                        : 'bg-[#416B9F] text-white',
                    ].join(' ')}
                  >
                    <LogIn className="h-4 w-4" />
                    {inDone ? 'Check-in ✓' : 'Check-in'}
                  </Link>
                  <Link
                    to={`/tablette/check-out/${r.id}`}
                    className={[
                      'inline-flex min-w-[8rem] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold',
                      outDone
                        ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                        : 'border border-white/20 bg-white/10 text-white',
                    ].join(' ')}
                  >
                    <LogOut className="h-4 w-4" />
                    {outDone ? 'Check-out ✓' : 'Check-out'}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
