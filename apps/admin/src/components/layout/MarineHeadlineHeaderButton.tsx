import { useEffect, useId, useRef } from 'react';
import { AlertTriangle, Anchor, CloudLightning, Loader2, Wind } from 'lucide-react';
import { useMarineWeatherHeadline, type MarineHeadlineState } from '@/contexts/MarineWeatherHeadlineContext';
import type { MarineDaySummary, MarineHeadlineKind } from '@/pages/dashboard/marineWeather';
import {
  formatKmh,
  formatMeters,
  kmhToBeaufort,
  meteoFranceMarineUrl,
} from '@/pages/dashboard/marineWeather';

export function MarineHeadlineHeaderButton() {
  const { headline, panelOpen, setPanelOpen } = useMarineWeatherHeadline();
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPanelOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [panelOpen, setPanelOpen]);

  const ariaLabel =
    headline.status === 'ready'
      ? headline.kind === 'bon'
        ? 'Météo mer : conditions favorables'
        : headline.kind === 'vigilance'
          ? 'Météo mer : vigilance'
          : 'Météo mer : conditions difficiles ou vent fort'
      : headline.status === 'loading'
        ? 'Météo mer : chargement'
        : headline.status === 'error'
          ? 'Météo mer : erreur'
          : 'Météo mer';

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setPanelOpen(!panelOpen)}
        aria-expanded={panelOpen}
        aria-controls={panelOpen ? panelId : undefined}
        aria-label={ariaLabel}
        className={buttonSurfaceClass(headline)}
      >
        {buttonInner(headline)}
      </button>

      {panelOpen ? (
        <div
          id={panelId}
          role="region"
          aria-label="Aperçu météo mer"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-[min(100vw-2rem,20rem)] rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-xl shadow-zinc-400/15"
        >
          {headline.status === 'ready' ? (
            <ReadyPanel day={headline.day} kind={headline.kind} onClose={() => setPanelOpen(false)} />
          ) : headline.status === 'loading' ? (
            <p className="flex items-center gap-2 text-sm text-zinc-600">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#416B9F]" strokeWidth={1.75} aria-hidden />
              Chargement de la météo mer…
            </p>
          ) : headline.status === 'error' ? (
            <p className="text-sm text-red-700">{headline.message}</p>
          ) : (
            <p className="text-sm text-zinc-500">Ouvre le tableau de bord pour charger la météo mer.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function buttonSurfaceClass(headline: MarineHeadlineState): string {
  const base =
    'flex min-h-10 max-w-[min(100vw-8rem,14rem)] items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm font-semibold shadow-sm transition-colors';

  if (headline.status === 'ready') {
    if (headline.kind === 'bon') {
      return `${base} border-[#416B9F]/35 bg-[#416B9F]/12 text-[#2d4d73] hover:bg-[#416B9F]/18`;
    }
    if (headline.kind === 'vigilance') {
      return `${base} border-orange-300/90 bg-orange-100 text-orange-950 hover:bg-orange-100/90`;
    }
    return `${base} border-red-300/90 bg-red-100 text-red-950 hover:bg-red-100/90`;
  }
  if (headline.status === 'loading') {
    return `${base} border-zinc-200/90 bg-white text-zinc-600 hover:bg-zinc-50`;
  }
  if (headline.status === 'error') {
    return `${base} border-zinc-300/90 bg-zinc-100 text-zinc-700 hover:bg-zinc-50`;
  }
  return `${base} border-zinc-200/90 bg-white text-zinc-500 hover:bg-zinc-50`;
}

function buttonInner(headline: MarineHeadlineState) {
  if (headline.status === 'loading') {
    return (
      <>
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-zinc-500" strokeWidth={1.75} aria-hidden />
        <span className="truncate text-xs font-medium text-zinc-600">Météo…</span>
      </>
    );
  }
  if (headline.status === 'error') {
    return (
      <>
        <AlertTriangle className="h-5 w-5 shrink-0 text-zinc-500" strokeWidth={1.75} aria-hidden />
        <span className="truncate text-xs">Météo</span>
      </>
    );
  }
  if (headline.status === 'ready') {
    if (headline.kind === 'bon') {
      return (
        <>
          <Anchor className="h-5 w-5 shrink-0 text-[#416B9F]" strokeWidth={1.75} aria-hidden />
          <span className="truncate">Mer calme</span>
        </>
      );
    }
    if (headline.kind === 'vigilance') {
      return (
        <>
          <AlertTriangle className="h-5 w-5 shrink-0 text-orange-700" strokeWidth={1.75} aria-hidden />
          <span className="truncate">Vigilance</span>
        </>
      );
    }
    return (
      <>
        <CloudLightning className="h-5 w-5 shrink-0 text-red-700" strokeWidth={1.75} aria-hidden />
        <span className="truncate">Danger</span>
      </>
    );
  }
  return (
    <>
      <Anchor className="h-5 w-5 shrink-0 text-zinc-400" strokeWidth={1.75} aria-hidden />
      <span className="truncate text-xs">Météo mer</span>
    </>
  );
}

function ReadyPanel(props: Readonly<{ day: MarineDaySummary; kind: MarineHeadlineKind; onClose: () => void }>) {
  const { day, kind, onClose } = props;
  return (
    <div className="space-y-3">
      <div
        className={[
          'rounded-xl border px-3 py-2.5 text-sm',
          kind === 'bon' && 'border-[#416B9F]/25 bg-[#416B9F]/8 text-[#2d4d73]',
          kind === 'vigilance' && 'border-orange-200 bg-orange-50 text-orange-950',
          kind === 'danger' && 'border-red-200 bg-red-50 text-red-950',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <p className="font-semibold capitalize">{day.label}</p>
        <p className="mt-1 text-xs opacity-90">{day.riskLabel}</p>
        {kind === 'bon' ? (
          <p className="mt-2 text-xs font-medium leading-snug opacity-90">
            Conditions globalement favorables ; reste attentif aux bulletins officiels.
          </p>
        ) : null}
        {kind === 'vigilance' ? (
          <p className="mt-2 text-xs font-medium leading-snug">
            Vigilance : mer plus formée ou vent soutenu. Vérifie les bulletins avant sortie.
          </p>
        ) : null}
        {kind === 'danger' ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs font-medium leading-snug">
            <Wind className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            Vent fort, orage signalé ou houle importante : sortie déconseillée sans avis météo adapté.
          </p>
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-zinc-600">
        <div>
          <dt className="text-zinc-400">Ciel</dt>
          <dd className="font-medium text-zinc-800">{day.weatherLabel}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Vent max</dt>
          <dd className="font-semibold tabular-nums text-zinc-800">
            {formatKmh(day.windMaxKmh)}
            <span className="mt-0.5 block text-[10px] font-medium text-zinc-500">
              Beaufort {kmhToBeaufort(day.windMaxKmh) ?? '—'}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-zinc-400">Rafales</dt>
          <dd className="font-semibold tabular-nums text-zinc-800">
            {formatKmh(day.gustMaxKmh)}
            <span className="mt-0.5 block text-[10px] font-medium text-zinc-500">
              Beaufort {kmhToBeaufort(day.gustMaxKmh) ?? '—'}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-zinc-400">Houle max</dt>
          <dd className="font-semibold tabular-nums text-zinc-800">{formatMeters(day.waveMaxM)}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
        <a
          href={meteoFranceMarineUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#416B9F] px-3 py-2 text-center text-xs font-semibold text-white hover:bg-[#365b87]"
        >
          Météo marine MF
        </a>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
