import { useMemo } from 'react';
import { ClipboardCheck, LogIn, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardSectionCard } from '@/components/dashboard/DashboardSectionCard';
import { fmtTabletTime } from '@/lib/tablet';
import type { TabletReservationRow } from '@/stores/checkFlow';

type Props = {
  dayLabel: string;
  rows: TabletReservationRow[];
  loading?: boolean;
};

function countCheck(rows: TabletReservationRow[]) {
  let checkInDone = 0;
  let checkInTodo = 0;
  let checkOutDone = 0;
  let checkOutTodo = 0;
  const pending: TabletReservationRow[] = [];

  for (const r of rows) {
    const inDone = r.checkFlowSubmissions.some((s) => s.kind === 'CHECK_IN');
    const outDone = r.checkFlowSubmissions.some((s) => s.kind === 'CHECK_OUT');
    if (inDone) checkInDone += 1;
    else checkInTodo += 1;
    if (outDone) checkOutDone += 1;
    else checkOutTodo += 1;
    if (!inDone || !outDone) pending.push(r);
  }

  return { checkInDone, checkInTodo, checkOutDone, checkOutTodo, pending };
}

export function DashboardCheckFlowSnapshot(props: Readonly<Props>) {
  const { dayLabel, rows, loading } = props;
  const stats = useMemo(() => countCheck(rows), [rows]);

  return (
    <DashboardSectionCard
      title="Check-in / Check-out"
      description={`Suivi tablette pour ${dayLabel.toLowerCase()}.`}
      icon={ClipboardCheck}
      href="/check-flow/formulaires"
      hrefLabel="Formulaires"
    >
      {loading ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Aucune réservation ce jour — rien à traiter.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatBlock
              icon={LogIn}
              label="Check-in"
              done={stats.checkInDone}
              todo={stats.checkInTodo}
              tone="in"
            />
            <StatBlock
              icon={LogOut}
              label="Check-out"
              done={stats.checkOutDone}
              todo={stats.checkOutTodo}
              tone="out"
            />
          </div>

          {stats.pending.length === 0 ? (
            <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              Tous les formulaires du jour sont complétés.
            </p>
          ) : (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">À compléter</p>
              <ul className="mt-3 space-y-2">
                {stats.pending.map((r) => {
                  const inDone = r.checkFlowSubmissions.some((s) => s.kind === 'CHECK_IN');
                  const outDone = r.checkFlowSubmissions.some((s) => s.kind === 'CHECK_OUT');
                  return (
                    <li key={r.id}>
                      <Link
                        to="/reservations"
                        className="block rounded-xl border border-amber-200/80 bg-amber-50/50 px-4 py-3 hover:bg-amber-50"
                      >
                        <p className="truncate text-sm font-semibold text-zinc-800">{r.title}</p>
                        <p className="mt-0.5 text-sm text-zinc-500">
                          {r.boat.name} · {fmtTabletTime(r.startAt)} — {fmtTabletTime(r.endAt)}
                        </p>
                        <p className="mt-1 text-sm font-medium text-amber-800">
                          {!inDone && !outDone
                            ? 'Check-in et check-out'
                            : !inDone
                              ? 'Check-in manquant'
                              : 'Check-out manquant'}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </DashboardSectionCard>
  );
}

function StatBlock(props: Readonly<{
  icon: typeof LogIn;
  label: string;
  done: number;
  todo: number;
  tone: 'in' | 'out';
}>) {
  const { icon: Icon, label, done, todo, tone } = props;
  return (
    <div
      className={[
        'rounded-xl border px-4 py-4',
        tone === 'in' ? 'border-[#416B9F]/15 bg-[#416B9F]/5' : 'border-violet-200/80 bg-violet-50/50',
      ].join(' ')}
    >
      <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-600">
        <Icon className="h-4 w-4" aria-hidden />
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">{done}</p>
      <p className="mt-1 text-sm text-zinc-500">
        fait{done !== 1 ? 's' : ''} · <span className="font-semibold text-amber-700">{todo}</span> à faire
      </p>
    </div>
  );
}
