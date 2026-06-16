import { useCallback, useEffect, useState } from 'react';
import { Landmark, RefreshCw } from 'lucide-react';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { api } from '@/lib/api';
import { euro } from './pricingTotals';

type StripeBalanceSnapshot = {
  availableCents: number;
  pendingCents: number;
  totalCents: number;
  currency: string;
  livemode: boolean;
  fetchedAt: string;
};

type StripeBalanceResponse =
  | { configured: false }
  | { configured: true; balance: StripeBalanceSnapshot }
  | { configured: true; error: string };

function centsToEuros(cents: number) {
  return cents / 100;
}

function formatFetchedAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function StripeLiveBalanceCard(
  props: Readonly<{
    periodNetStripe: number;
    periodStripeGross: number;
    periodLabel: string;
    feesEstimated: boolean;
  }>,
) {
  const { periodNetStripe, periodStripeGross, periodLabel, feesEstimated } = props;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [response, setResponse] = useState<StripeBalanceResponse | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { data } = await api.get<StripeBalanceResponse>('/reservations/stripe-balance');
      setResponse(data);
    } catch {
      setResponse({ configured: true, error: 'Impossible de joindre l’API Stripe.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const balance = response?.configured === true && 'balance' in response ? response.balance : null;
  const error = response?.configured === true && 'error' in response ? response.error : null;
  const notConfigured = response?.configured === false;

  return (
    <section className="rounded-2xl border border-[#416B9F]/25 bg-gradient-to-br from-[#416B9F]/10 via-white to-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#416B9F] shadow-sm ring-1 ring-[#416B9F]/15">
            <Landmark className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900">Solde Stripe (temps réel)</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Lecture directe du compte Stripe — identique au tableau de bord Stripe.
            </p>
            {balance ? (
              <p className="mt-1 text-[10px] font-medium text-zinc-400">
                Mis à jour {formatFetchedAt(balance.fetchedAt)}
                {balance.livemode ? '' : ' · mode test'}
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-[#416B9F] shadow-sm ring-1 ring-[#416B9F]/20 transition hover:bg-[#416B9F]/5 disabled:opacity-60"
        >
          <RefreshCw className={['h-3.5 w-3.5', refreshing ? 'animate-spin' : ''].join(' ')} strokeWidth={2} />
          Actualiser
        </button>
      </div>

      {loading && !balance ? (
        <p className="mt-4 text-sm text-zinc-500">Chargement du solde Stripe…</p>
      ) : notConfigured ? (
        <p className="mt-4 text-sm text-amber-800">
          Stripe n’est pas configuré (<code className="text-xs">STRIPE_SECRET_KEY</code> manquant sur l’API).
        </p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-700">{error}</p>
      ) : balance ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80">Disponible</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-emerald-900">
                <AnimatedNumber
                  value={centsToEuros(balance.availableCents)}
                  format={(n) => `${euro(n)} €`}
                />
              </p>
            </div>
            <div className="rounded-xl border border-sky-200/80 bg-sky-50/50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800/80">En attente</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-sky-900">
                <AnimatedNumber
                  value={centsToEuros(balance.pendingCents)}
                  format={(n) => `${euro(n)} €`}
                />
              </p>
            </div>
            <div className="rounded-xl border border-[#416B9F]/20 bg-[#416B9F]/5 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#416B9F]/80">Total solde</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-[#416B9F]">
                <AnimatedNumber
                  value={centsToEuros(balance.totalCents)}
                  format={(n) => `${euro(n)} €`}
                />
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/90 bg-white/80 p-3 text-xs leading-relaxed text-zinc-600">
            <p className="font-semibold text-zinc-800">Pourquoi ce n’est pas le même chiffre que « Net Stripe » ?</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>
                <span className="font-medium text-zinc-700">Solde Stripe</span> = tout l’historique sur le compte,
                maintenant (moins les virements déjà envoyés vers votre banque).
              </li>
              <li>
                <span className="font-medium text-zinc-700">Net Stripe ({periodLabel})</span> ={' '}
                {euro(periodNetStripe)} € calculé sur les réservations de la période (date de location), hors espèces.
                {feesEstimated ? ' Frais encore estimés sur une partie des paiements.' : ''}
              </li>
              <li>
                CB Stripe encaissée sur la période : {euro(periodStripeGross)} € (brut, avant frais).
              </li>
            </ul>
            <p className="mt-2 text-zinc-500">
              Pour rapprocher les chiffres, il faudrait filtrer par date de paiement Stripe et exclure les virements —
              le solde restera toujours une photo instantanée, pas un CA période.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
