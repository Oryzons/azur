import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical } from 'lucide-react';
import { RoundCheckbox } from '@/components/RoundCheckbox';
import { CALENDAR_BOAT_ROW_DRAG_MIME } from '@/pages/calendar/calendarConstants';
import {
  calendarStatusFilterOptions,
  inputCls,
  type CalendarBoatRow,
  type CalendarFilterState,
  type CalendarSortMode,
} from '@/lib/calendarFilters';
import { BOAT_TYPES_UI, type BoatType, type Fleet } from '@/stores/boats';
import type { ReservationStatus } from '@/lib/reservationStatus';

type Props = {
  fleets: Fleet[];
  storeBoats: { id: string; name: string; brand: string; model: string; boatType: BoatType; fleetId?: string | null }[];
  owners: { id: string; label: string }[];
  orderedBoats: CalendarBoatRow[];
  allMatchingBoats: CalendarBoatRow[];
  filterState: CalendarFilterState;
  onFilterChange: <K extends keyof CalendarFilterState>(key: K, value: CalendarFilterState[K]) => void;
  onReorderBoats: (fromIndex: number, toIndex: number) => void;
  onReset: () => void;
};

const SORT_LABELS: Record<CalendarSortMode, string> = {
  custom: 'Ordre personnalisé',
  fleet: 'Par flotille puis ordre enregistré',
  alpha: 'Alphabétique (nom)',
};

export function CalendarFiltersPanel(props: Readonly<Props>) {
  const {
    fleets,
    storeBoats,
    owners,
    orderedBoats,
    allMatchingBoats,
    filterState,
    onFilterChange,
    onReorderBoats,
    onReset,
  } = props;

  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const visibilityBoats = useMemo(() => {
    return [...allMatchingBoats].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [allMatchingBoats]);

  const canReorder = filterState.sortMode === 'custom' && orderedBoats.length > 1;

  function moveBoat(index: number, dir: -1 | 1) {
    const to = index + dir;
    if (to < 0 || to >= orderedBoats.length) return;
    onReorderBoats(index, to);
  }

  function toggleBoatVisibility(id: string) {
    const next = new Set(filterState.hiddenBoatIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onFilterChange('hiddenBoatIds', next);
  }

  function toggleStatus(status: ReservationStatus) {
    const next = new Set(filterState.hiddenStatuses);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    onFilterChange('hiddenStatuses', next);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Tri des bateaux</h3>
        <label className="block">
          <span className="text-xs font-semibold text-zinc-600">Mode d&apos;affichage</span>
          <select
            value={filterState.sortMode}
            onChange={(e) => onFilterChange('sortMode', e.target.value as CalendarSortMode)}
            className={`mt-1.5 ${inputCls}`}
          >
            {(Object.keys(SORT_LABELS) as CalendarSortMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {SORT_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs leading-relaxed text-zinc-500">
          En ordre personnalisé, glissez les lignes ci-dessous ou utilisez les flèches. L&apos;ordre est aussi modifiable
          sur la grille (poignée à gauche du nom).
        </p>

        {canReorder ? (
          <ul className="max-h-56 space-y-1.5 overflow-y-auto rounded-2xl border border-zinc-200/90 bg-zinc-50/50 p-2">
            {orderedBoats.map((b, index) => (
              <li
                key={b.id}
                draggable
                onDragStart={(e) => {
                  setDragFrom(index);
                  e.dataTransfer.setData(CALENDAR_BOAT_ROW_DRAG_MIME, String(index));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const raw = e.dataTransfer.getData(CALENDAR_BOAT_ROW_DRAG_MIME);
                  const from = dragFrom ?? Number.parseInt(raw, 10);
                  if (Number.isNaN(from) || from === index) return;
                  onReorderBoats(from, index);
                  setDragFrom(null);
                }}
                onDragEnd={() => setDragFrom(null)}
                className={[
                  'flex items-center gap-2 rounded-xl border bg-white px-2 py-2 shadow-sm',
                  dragFrom === index ? 'border-[#416B9F]/40 ring-1 ring-[#416B9F]/20' : 'border-zinc-200/90',
                ].join(' ')}
              >
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-zinc-400" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-800">{b.name}</p>
                  {b.meta ? <p className="truncate text-[11px] text-zinc-500">{b.meta}</p> : null}
                </div>
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveBoat(index, -1)}
                    className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
                    aria-label="Monter"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index >= orderedBoats.length - 1}
                    onClick={() => moveBoat(index, 1)}
                    className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
                    aria-label="Descendre"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-500">
            {filterState.sortMode !== 'custom'
              ? 'Choisissez « Ordre personnalisé » pour réordonner la liste.'
              : 'Aucun bateau visible à réordonner avec les filtres actuels.'}
          </p>
        )}
      </section>

      <section className="space-y-3 border-t border-zinc-100 pt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Bateaux affichés</h3>
        <label className="block">
          <span className="text-xs font-semibold text-zinc-600">Flotille</span>
          <select
            value={filterState.fleetId}
            onChange={(e) => onFilterChange('fleetId', e.target.value)}
            className={`mt-1.5 ${inputCls}`}
          >
            <option value="">Toutes les flotilles</option>
            {fleets.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-zinc-600">Type de bateau</span>
          <select
            value={filterState.boatType}
            onChange={(e) => onFilterChange('boatType', (e.target.value || '') as '' | BoatType)}
            className={`mt-1.5 ${inputCls}`}
          >
            <option value="">Tous les types</option>
            {BOAT_TYPES_UI.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-zinc-600">Bateau précis</span>
          <select
            value={filterState.boatId}
            onChange={(e) => onFilterChange('boatId', e.target.value)}
            className={`mt-1.5 ${inputCls}`}
          >
            <option value="">Tous (selon filtres ci-dessus)</option>
            {storeBoats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} — {b.brand}
              </option>
            ))}
          </select>
        </label>
        {owners.length > 0 ? (
          <label className="block">
            <span className="text-xs font-semibold text-zinc-600">Propriétaire</span>
            <select
              value={filterState.ownerId ?? ''}
              onChange={(e) => onFilterChange('ownerId', e.target.value)}
              className={`mt-1.5 ${inputCls}`}
            >
              <option value="">Tous les propriétaires</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block">
          <span className="text-xs font-semibold text-zinc-600">Recherche</span>
          <input
            type="search"
            value={filterState.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            placeholder="Nom, marque, modèle…"
            className={`mt-1.5 ${inputCls}`}
            autoComplete="off"
          />
        </label>
        <RoundCheckbox
          checked={filterState.onlyWithReservationsInPeriod}
          onChange={(v) => onFilterChange('onlyWithReservationsInPeriod', v)}
          label="Uniquement les bateaux avec un créneau sur la période affichée"
        />

        {visibilityBoats.length > 0 ? (
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-zinc-600">Visibilité ({visibilityBoats.length})</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onFilterChange('hiddenBoatIds', new Set())}
                  className="text-[11px] font-semibold text-[#416B9F] hover:underline"
                >
                  Tout afficher
                </button>
                <button
                  type="button"
                  onClick={() => onFilterChange('hiddenBoatIds', new Set(visibilityBoats.map((b) => b.id)))}
                  className="text-[11px] font-semibold text-zinc-500 hover:underline"
                >
                  Tout masquer
                </button>
              </div>
            </div>
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-zinc-200/90 p-2">
              {visibilityBoats.map((b) => {
                const visible = !filterState.hiddenBoatIds.has(b.id);
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => toggleBoatVisibility(b.id)}
                      className={[
                        'flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors',
                        visible ? 'bg-white text-zinc-800 hover:bg-zinc-50' : 'bg-zinc-100/80 text-zinc-400',
                      ].join(' ')}
                    >
                      {visible ? (
                        <Eye className="h-4 w-4 shrink-0 text-[#416B9F]" aria-hidden />
                      ) : (
                        <EyeOff className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                      <span className="min-w-0 truncate font-medium">{b.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 border-t border-zinc-100 pt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Créneaux sur la grille</h3>
        <p className="text-xs text-zinc-500">Décochez un statut pour masquer ces réservations sur le calendrier.</p>
        <ul className="space-y-2">
          {calendarStatusFilterOptions().map(({ value, label }) => {
            const shown = !filterState.hiddenStatuses.has(value);
            return (
              <li key={value}>
                <RoundCheckbox checked={shown} onChange={() => toggleStatus(value)} label={label} />
              </li>
            );
          })}
        </ul>
      </section>

      <button
        type="button"
        onClick={onReset}
        className="w-full rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
      >
        Réinitialiser tous les filtres
      </button>
    </div>
  );
}
