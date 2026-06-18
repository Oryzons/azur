import { useEffect, useState } from 'react';
import { Anchor, ChevronDown, ChevronUp, ExternalLink, Loader2, Waves, Wind } from 'lucide-react';
import { useMarineWeatherHeadline } from '@/contexts/MarineWeatherHeadlineContext';
import { MarineBoatingScoreHero } from '@/pages/dashboard/MarineBoatingOpsVisual';
import type { DayBoatingOps } from '@/pages/dashboard/marineBoatingOps';
import { fetchDayBoatingOps } from '@/pages/dashboard/marineBoatingOps';
import type { MarineDaySummary, MarineRiskLevel } from './marineWeather';
import {
  fetchMarineDailyForecast,
  formatBeaufortFromKmh,
  formatKmh,
  formatMeters,
  formatSeconds,
  formatTempC,
  getMarineForecastLocationLabel,
  getMarineHeadlineKind,
  kmhToKnots,
  meteoFranceMarineUrl,
} from './marineWeather';

/** Index dans la série API (0 = aujourd’hui). */
const IDX_TOMORROW = 1;
const IDX_DAY_AFTER = 2;

type MarineDaySlide = 'forward' | 'back' | null;

function riskBadgeClasses(level: MarineRiskLevel): string {
  switch (level) {
    case 'calme':
      return 'bg-emerald-50/90 text-emerald-800 ring-emerald-600/12';
    case 'modere':
      return 'bg-amber-50/90 text-amber-900 ring-amber-600/15';
    case 'vigilance':
      return 'bg-orange-50/90 text-orange-900 ring-orange-600/18';
    case 'difficile':
      return 'bg-red-50/90 text-red-900 ring-red-600/18';
    default:
      return 'bg-zinc-100 text-zinc-800 ring-zinc-500/12';
  }
}

function dayHeading(index: number): string {
  if (index === IDX_TOMORROW) return 'Demain';
  if (index === IDX_DAY_AFTER) return 'Après-demain';
  return 'Prévision';
}

function DayDetailsExtra({ day }: Readonly<{ day: MarineDaySummary }>) {
  return (
    <dl className="mt-3 space-y-2 border-t border-zinc-200/60 pt-3 text-xs text-zinc-600">
      <div className="flex gap-2 justify-between">
        <dt className="font-medium text-zinc-500">Mer de vent max</dt>
        <dd className="text-right font-semibold tabular-nums text-zinc-800">{formatMeters(day.windSeaMaxM)}</dd>
      </div>
      <div className="flex gap-2 justify-between">
        <dt className="font-medium text-zinc-500">Swell max</dt>
        <dd className="text-right font-semibold tabular-nums text-zinc-800">{formatMeters(day.swellMaxM)}</dd>
      </div>
      <div className="flex gap-2 justify-between">
        <dt className="font-medium text-zinc-500">Période de crête swell max</dt>
        <dd className="text-right font-semibold tabular-nums text-zinc-800">{formatSeconds(day.swellPeriodMaxS)}</dd>
      </div>
      <div className="flex gap-2 justify-between">
        <dt className="font-medium text-zinc-500">Mer (surface)</dt>
        <dd className="text-right font-semibold tabular-nums text-zinc-800">{formatTempC(day.seaTempMaxC)}</dd>
      </div>
    </dl>
  );
}

export function MarineWeatherSummary() {
  const [days, setDays] = useState<MarineDaySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dayIndex, setDayIndex] = useState(IDX_TOMORROW);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { setHeadline, setPanelOpen } = useMarineWeatherHeadline();

  const [ops, setOps] = useState<DayBoatingOps | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsError, setOpsError] = useState<string | null>(null);

  const [marineSlide, setMarineSlide] = useState<MarineDaySlide>(null);

  const locationLabel = getMarineForecastLocationLabel();

  const hasDayAfter = (days?.length ?? 0) > IDX_DAY_AFTER;

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    void fetchMarineDailyForecast(ac.signal)
      .then(setDays)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Erreur réseau');
        setDays(null);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (days && dayIndex >= days.length) {
      setDayIndex(Math.min(IDX_TOMORROW, Math.max(0, days.length - 1)));
    }
  }, [days, dayIndex]);

  const day = days?.[dayIndex] ?? null;

  useEffect(() => {
    if (!day?.dateIso) {
      setOps(null);
      setOpsError(null);
      setOpsLoading(false);
      return;
    }
    const ac = new AbortController();
    setOps(null);
    setOpsError(null);
    setOpsLoading(true);
    fetchDayBoatingOps(day.dateIso, ac.signal)
      .then(setOps)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setOpsError(e instanceof Error ? e.message : 'Erreur indice');
        setOps(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setOpsLoading(false);
      });
    return () => ac.abort();
  }, [day?.dateIso]);

  useEffect(() => {
    if (!marineSlide) return;
    const id = globalThis.setTimeout(() => setMarineSlide(null), 340);
    return () => globalThis.clearTimeout(id);
  }, [marineSlide]);

  useEffect(() => {
    if (loading) {
      setHeadline({ status: 'loading' });
      return;
    }
    if (error) {
      setHeadline({ status: 'error', message: error });
      return;
    }
    if (day) {
      const kind = getMarineHeadlineKind(day);
      setHeadline({ status: 'ready', day, kind });
      return;
    }
    setHeadline({ status: 'idle' });
  }, [loading, error, day, setHeadline]);

  useEffect(() => {
    return () => {
      setHeadline({ status: 'idle' });
      setPanelOpen(false);
    };
  }, [setHeadline, setPanelOpen]);

  return (
    <section className="h-full rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-md shadow-zinc-300/25 ring-1 ring-zinc-100/80 sm:p-6">
      <div className="flex flex-wrap items-center gap-3 gap-y-2 border-b border-zinc-100 pb-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#416B9F]/10 text-[#416B9F]">
            <Anchor className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-zinc-900">Météo mer</h2>
            <p className="mt-0.5 truncate text-sm text-zinc-500">{locationLabel}</p>
          </div>
        </div>
        <a
          href={meteoFranceMarineUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-[#416B9F] transition-colors hover:border-[#416B9F]/30 hover:bg-white"
        >
          Météo France
          <ExternalLink className="h-3.5 w-3.5 opacity-80" strokeWidth={1.75} aria-hidden />
        </a>
      </div>

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#416B9F]" strokeWidth={1.75} aria-hidden />
          Chargement des prévisions…
        </div>
      )}

      {!loading && error && (
        <p className="mt-4 text-sm leading-snug text-red-700">Impossible de charger la météo ({error}).</p>
      )}

      {!loading && !error && day && (
        <>
          <div
            key={day.dateIso}
            className={[
              'overflow-x-hidden',
              marineSlide === 'forward' ? 'bc-animate bc-marine-day-forward' : '',
              marineSlide === 'back' ? 'bc-animate bc-marine-day-back' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{dayHeading(dayIndex)}</p>
                <p className="mt-0.5 truncate text-base font-semibold capitalize text-zinc-900">{day.label}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${riskBadgeClasses(day.risk)}`}
              >
                {day.riskLabel}
              </span>
            </div>

          <MarineBoatingScoreHero ops={ops} loading={opsLoading} />
          {opsError ? (
            <p className="mt-2 text-[11px] text-amber-800/90">
              Indice horaire indisponible ({opsError}) — les totaux journaliers ci-dessous restent affichés.
            </p>
          ) : null}

          <p className="mt-2 text-sm text-zinc-600">{day.weatherLabel}</p>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-700">
            <span className="inline-flex items-center gap-1.5">
              <Wind className="h-4 w-4 shrink-0 text-[#416B9F]" strokeWidth={1.75} aria-hidden />
              <span className="text-zinc-500">Vent</span>
              <span className="font-semibold tabular-nums text-zinc-900">{formatKmh(day.windMaxKmh)}</span>
              <span className="tabular-nums text-zinc-500">
                ({kmhToKnots(day.windMaxKmh)}, {formatBeaufortFromKmh(day.windMaxKmh)})
              </span>
            </span>
            <span>
              <span className="text-zinc-500">Rafales</span>{' '}
              <span className="font-semibold tabular-nums text-zinc-900">{formatKmh(day.gustMaxKmh)}</span>
              <span className="tabular-nums text-zinc-500">
                {' '}
                ({kmhToKnots(day.gustMaxKmh)}, {formatBeaufortFromKmh(day.gustMaxKmh)})
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Waves className="h-4 w-4 shrink-0 text-[#416B9F]" strokeWidth={1.75} aria-hidden />
              <span className="text-zinc-500">Houle</span>
              <span className="font-semibold tabular-nums text-zinc-900">{formatMeters(day.waveMaxM)}</span>
            </span>
          </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {dayIndex === IDX_TOMORROW && hasDayAfter && (
              <button
                type="button"
                onClick={() => {
                  setMarineSlide('forward');
                  setDayIndex(IDX_DAY_AFTER);
                  setDetailsOpen(false);
                }}
                className="rounded-lg border border-zinc-200/90 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-zinc-600 shadow-sm transition-all duration-200 ease-out hover:border-zinc-300 hover:text-zinc-900 active:scale-[0.97]"
              >
                Après-demain
              </button>
            )}
            {dayIndex === IDX_DAY_AFTER && (
              <button
                type="button"
                onClick={() => {
                  setMarineSlide('back');
                  setDayIndex(IDX_TOMORROW);
                  setDetailsOpen(false);
                }}
                className="rounded-lg border border-zinc-200/90 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-zinc-600 shadow-sm transition-all duration-200 ease-out hover:border-zinc-300 hover:text-zinc-900 active:scale-[0.97]"
              >
                Demain
              </button>
            )}

            <button
              type="button"
              onClick={() => setDetailsOpen((o) => !o)}
              aria-expanded={detailsOpen}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#416B9F] shadow-sm transition-all duration-200 ease-out hover:border-[#416B9F]/25 hover:bg-[#416B9F]/5 active:scale-[0.97]"
            >
              {detailsOpen ? (
                <>
                  Moins d’infos
                  <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                </>
              ) : (
                <>
                  Plus d’infos
                  <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                </>
              )}
            </button>
          </div>

          {detailsOpen && (
            <div className="mt-1">
              <DayDetailsExtra day={day} />
              <p className="mt-3 text-[10px] leading-relaxed text-zinc-400">
                Données{' '}
                <a
                  href="https://open-meteo.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-zinc-500 underline-offset-2 hover:text-[#416B9F] hover:underline"
                >
                  Open-Meteo
                </a>
                {' — '}
                Indication non officielle : consulter les bulletins avant appareillage.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
