import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Info,
  LogIn,
  LogOut,
} from 'lucide-react';
import { TabletBoatCoverImage } from '@/components/tablet/TabletBoatCoverImage';
import { fmtTabletTime } from '@/lib/tablet';
import { formatBoatDisplayName, formatBoatSpecsLine } from '@/lib/tabletBoat';
import { checkKindPrimaryBtnClass } from '@/lib/tabletCheckKindTheme';
import { tabletFlowAccessForReservation } from '@/lib/checkFlowTabletAccess';
import { isReservationFullyValidated } from '@/lib/tabletPendingActions';
import { useCheckFlowStore, type CheckFlowKind } from '@/stores/checkFlow';
import { extractApiErrorMessage } from '@/lib/apiError';

const KIND_LABEL: Record<CheckFlowKind, string> = {
  CHECK_IN: 'Check-in',
  CHECK_OUT: 'Check-out',
};

function flowPath(reservationId: string, kind: CheckFlowKind): string {
  return kind === 'CHECK_IN'
    ? `/tablette/check-in/${reservationId}`
    : `/tablette/check-out/${reservationId}`;
}

function accessLabel(kind: CheckFlowKind, mode: string): { text: string; ok: boolean; warn?: boolean } {
  if (mode === 'payment_required') {
    return { text: 'Paiement requis', ok: false, warn: true };
  }
  if (mode === 'submit') return { text: 'À compléter', ok: false };
  if (mode === 'done_today') return { text: 'Validé aujourd’hui', ok: true };
  if (mode === 'view') return { text: 'Validé', ok: true };
  return { text: kind === 'CHECK_IN' ? 'Check-in expiré' : 'Check-out expiré', ok: false, warn: true };
}

export function TabletReservationDetailPage() {
  const { reservationId } = useParams<{ reservationId: string }>();
  const navigate = useNavigate();
  const fetchOne = useCheckFlowStore((s) => s.fetchTabletReservation);
  const [row, setRow] = useState<Awaited<ReturnType<typeof fetchOne>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeKind, setActiveKind] = useState<CheckFlowKind>('CHECK_IN');

  useEffect(() => {
    if (!reservationId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    void fetchOne(reservationId)
      .then((data) => {
        if (!cancelled) {
          setRow(data);
          const inPending = tabletFlowAccessForReservation(data, 'CHECK_IN').mode === 'submit';
          setActiveKind(inPending ? 'CHECK_IN' : 'CHECK_OUT');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(extractApiErrorMessage(err, 'Réservation introuvable.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reservationId, fetchOne]);

  const inAccess = useMemo(
    () => (row ? tabletFlowAccessForReservation(row, 'CHECK_IN') : null),
    [row],
  );
  const outAccess = useMemo(
    () => (row ? tabletFlowAccessForReservation(row, 'CHECK_OUT') : null),
    [row],
  );
  const allDone = row ? isReservationFullyValidated(row) : false;

  if (loading) {
    return <p className="px-5 py-16 text-center text-sm text-zinc-500">Chargement…</p>;
  }

  if (error || !row) {
    return (
      <div className="px-5 py-10">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-zinc-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>
        <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || 'Réservation introuvable.'}
        </p>
      </div>
    );
  }

  const name = formatBoatDisplayName(row.boat);
  const specs = formatBoatSpecsLine(row.boat);
  const inStatus = accessLabel('CHECK_IN', inAccess?.mode ?? 'submit');
  const outStatus = accessLabel('CHECK_OUT', outAccess?.mode ?? 'submit');

  const checklist: Array<{
    key: string;
    kind: CheckFlowKind;
    label: string;
    sub: string;
    status: { text: string; ok: boolean; warn?: boolean };
    Icon: typeof LogIn;
  }> = [
    {
      key: 'check-in',
      kind: 'CHECK_IN',
      label: 'Check-in',
      sub: 'État du bateau au départ',
      status: inStatus,
      Icon: LogIn,
    },
    {
      key: 'check-out',
      kind: 'CHECK_OUT',
      label: 'Check-out',
      sub: 'État du bateau au retour',
      status: outStatus,
      Icon: LogOut,
    },
  ];

  const activeAccess = activeKind === 'CHECK_IN' ? inAccess : outAccess;
  const activeBlocked = activeAccess?.mode === 'payment_required' || activeAccess?.mode === 'expired';

  return (
    <div className="min-h-full bg-white">
      <div className="relative h-[42vh] min-h-[17rem] max-h-[22rem] overflow-hidden bg-zinc-800">
        <TabletBoatCoverImage boat={row.boat} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/25" />
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute left-4 top-[max(0.75rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-zinc-800 shadow-lg touch-manipulation active:scale-95"
          aria-label="Retour"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      <div className="bc-page-stagger -mt-8 relative rounded-t-[2rem] bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 shadow-[0_-12px_40px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{name}</h1>
            {specs ? <p className="mt-1 text-sm text-zinc-500">{specs}</p> : null}
          </div>
          <span
            className={[
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
              allDone
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80'
                : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80',
            ].join(' ')}
          >
            <span
              className={['h-1.5 w-1.5 rounded-full', allDone ? 'bg-emerald-500' : 'bg-amber-500'].join(
                ' ',
              )}
              aria-hidden
            />
            {allDone ? 'Tout validé' : 'En cours'}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {(['CHECK_IN', 'CHECK_OUT'] as const).map((kind) => {
            const active = activeKind === kind;
            const access = kind === 'CHECK_IN' ? inAccess : outAccess;
            const done = access?.mode === 'view' || access?.mode === 'done_today';
            return (
              <button
                key={kind}
                type="button"
                onClick={() => setActiveKind(kind)}
                className={[
                  'min-h-[3rem] rounded-full text-sm font-semibold touch-manipulation transition-all duration-200 active:scale-[0.98]',
                  active
                    ? checkKindPrimaryBtnClass(kind, true)
                    : checkKindPrimaryBtnClass(kind, false),
                  done && !active ? 'ring-1 ring-emerald-200/80' : '',
                ].join(' ')}
              >
                {KIND_LABEL[kind]}
                {done ? ' ✓' : ''}
              </button>
            );
          })}
        </div>

        {activeBlocked ? (
          <div
            className={[
              'mt-3 flex min-h-[3.25rem] w-full cursor-not-allowed items-center justify-center rounded-full text-sm font-semibold',
              'border border-zinc-200 bg-zinc-100 text-zinc-400',
            ].join(' ')}
          >
            {activeAccess?.mode === 'payment_required'
              ? 'Paiement requis pour ouvrir le formulaire'
              : 'Délai dépassé'}
          </div>
        ) : (
          <Link
            to={flowPath(row.id, activeKind)}
            className={[
              'mt-3 flex min-h-[3.25rem] w-full items-center justify-center rounded-full text-sm font-semibold touch-manipulation active:scale-[0.98]',
              checkKindPrimaryBtnClass(activeKind, true),
              activeKind === 'CHECK_OUT' ? 'shadow-lg shadow-red-600/20' : 'shadow-lg shadow-zinc-900/15',
            ].join(' ')}
          >
            {activeKind === 'CHECK_IN' ? 'Ouvrir le check-in' : 'Ouvrir le check-out'}
          </Link>
        )}

        <section className="mt-8">
          <h2 className="text-base font-bold text-zinc-900">À compléter</h2>
          <ul className="mt-3 divide-y divide-zinc-100">
            {checklist.map((item) => {
              const itemAccess = item.kind === 'CHECK_IN' ? inAccess : outAccess;
              const itemBlocked =
                itemAccess?.mode === 'payment_required' || itemAccess?.mode === 'expired';
              const rowContent = (
                <>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600">
                    <item.Icon className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-zinc-900">{item.label}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                      {item.status.ok ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                      ) : item.status.warn ? (
                        <CircleAlert className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                      ) : item.kind === 'CHECK_OUT' ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                      )}
                      <span
                        className={
                          !item.status.ok && !item.status.warn && item.kind === 'CHECK_OUT'
                            ? 'font-medium text-red-600'
                            : ''
                        }
                      >
                        {item.status.text}
                      </span>
                    </span>
                    <span className="block text-xs text-zinc-400">{item.sub}</span>
                  </span>
                  {!itemBlocked ? (
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300" aria-hidden />
                  ) : null}
                </>
              );
              return (
                <li key={item.key}>
                  {itemBlocked ? (
                    <div className="flex items-center gap-3 py-3.5 opacity-60">{rowContent}</div>
                  ) : (
                    <Link
                      to={flowPath(row.id, item.kind)}
                      className="flex items-center gap-3 py-3.5 touch-manipulation active:opacity-70"
                    >
                      {rowContent}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-bold text-zinc-900">Informations</h2>
          <ul className="mt-3 divide-y divide-zinc-100">
            <li className="flex items-center gap-3 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600">
                <Info className="h-5 w-5" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-zinc-900">Réservation</span>
                <span className="text-xs text-zinc-500">{row.title}</span>
              </span>
            </li>
            <li className="flex items-center gap-3 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600">
                <Clock3 className="h-5 w-5" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-zinc-900">Horaires</span>
                <span className="text-xs text-zinc-500">
                  {fmtTabletTime(row.startAt)} — {fmtTabletTime(row.endAt)}
                </span>
              </span>
            </li>
          </ul>
        </section>

        <div className="mt-8">
          {allDone ? (
            <div className="flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full bg-emerald-50 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
              <Check className="h-5 w-5" aria-hidden />
              Tout est validé
            </div>
          ) : inAccess?.mode === 'payment_required' && outAccess?.mode === 'payment_required' ? (
            <div className="flex min-h-[3.25rem] items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-sm font-semibold text-zinc-400">
              Paiement requis pour les formulaires
            </div>
          ) : (
            <Link
              to={flowPath(
                row.id,
                inAccess?.mode === 'submit' ? 'CHECK_IN' : 'CHECK_OUT',
              )}
              className={[
                'flex min-h-[3.25rem] items-center justify-center rounded-full text-sm font-semibold touch-manipulation active:scale-[0.98]',
                inAccess?.mode === 'submit'
                  ? checkKindPrimaryBtnClass('CHECK_IN', true)
                  : checkKindPrimaryBtnClass('CHECK_OUT', true),
                inAccess?.mode === 'submit' ? 'shadow-lg shadow-zinc-900/15' : 'shadow-lg shadow-red-600/20',
              ].join(' ')}
            >
              Compléter les formulaires
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
