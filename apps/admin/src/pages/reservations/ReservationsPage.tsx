import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, CalendarDays, LogIn, LogOut, Plus, Search, Ship, Trash2 } from 'lucide-react';
import { addDays, startOfDay } from '@/pages/calendar/calendarConstants';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import { deserializeReservation, useReservationsStore } from '@/stores/reservations';
import { BOAT_TYPES_UI, useBoatsStore, type BoatType } from '@/stores/boats';
import { ReservationDetailsPanel } from '@/pages/reservations/ReservationDetailsPanel';
import { RentalContractStatusBadge } from '@/components/reservations/RentalContractStatusBadge';
import { usePageFiltersPanel, type PageFiltersConfig } from '@/contexts/PageFiltersContext';
import { ContentReveal } from '@/components/ui/ContentReveal';
import { ThreeStepGuide } from '@/components/ui/ThreeStepGuide';
import { ReservationsPageSkeleton } from '@/components/skeletons/ReservationsPageSkeleton';
import { useCoreStoresReady } from '@/lib/useStoreHydration';
import { useOwnerFleetScope } from '@/lib/ownerFleetScope';
import { isOwnerUser } from '@/lib/userRoles';
import { useAuthStore } from '@/stores/auth';
import {
  matchesReservationListFilter,
  reservationClientLabel,
  reservationPeriodShort,
  reservationSearchHaystack,
  reservationStatusBadge,
  type ReservationListFilter,
} from '@/lib/reservationUi';

type BoatRow = { id: string; name: string; meta?: string };

function isoDay(d: Date) {
  const x = startOfDay(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function parseFilterDateIso(s: string): Date | null {
  const t = s.trim();
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T12:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

const LIST_FILTERS: { id: ReservationListFilter; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'upcoming', label: 'À venir' },
  { id: 'past', label: 'Passées' },
  { id: 'pending_payment', label: 'En attente' },
  { id: 'paid', label: 'Payées' },
  { id: 'cancelled', label: 'Annulées' },
];

export function ReservationsPage() {
  const navigate = useNavigate();
  const isOwner = isOwnerUser(useAuthStore((s) => s.user.role));
  const { scopedBoats: catalogBoats, ownedBoatIdSet } = useOwnerFleetScope();
  const rawItems = useReservationsStore((s) => s.items);
  const reservations = useMemo(() => {
    const all = rawItems.map(deserializeReservation);
    if (!isOwner) return all;
    return all.filter((r) => ownedBoatIdSet.has(r.boatId));
  }, [rawItems, isOwner, ownedBoatIdSet]);
  const clearAll = useReservationsStore((s) => s.clearAll);
  const reservationsHydrated = useReservationsStore((s) => s.hydrated);
  const refreshReservations = useReservationsStore((s) => s.refresh);
  const coreReady = useCoreStoresReady();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [listFilter, setListFilter] = useState<ReservationListFilter>('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [filterBoatId, setFilterBoatId] = useState('');
  const [filterBoatType, setFilterBoatType] = useState<'' | BoatType>('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  useEffect(() => {
    if (!reservationsHydrated) void refreshReservations();
  }, [reservationsHydrated, refreshReservations]);

  const fleets = useBoatsStore((s) => s.fleets);
  const demoBoats = useMemo<BoatRow[]>(
    () =>
      isOwner
        ? []
        : [
            { id: 'b1', name: 'Sun Odyssey 37', meta: 'Monocoque' },
            { id: 'b2', name: 'Lagoon 42', meta: 'Catamaran' },
            { id: 'b3', name: 'Cap Camarat 7.5', meta: 'Day boat' },
            { id: 'b4', name: 'Jeanneau 9.0', meta: 'Semi-rigide' },
          ],
    [isOwner],
  );
  const boats = useMemo<BoatRow[]>(() => {
    if (catalogBoats.length > 0) {
      return catalogBoats.map((b) => ({ id: b.id, name: b.name, meta: `${b.brand} · ${b.model}` }));
    }
    return demoBoats;
  }, [demoBoats, catalogBoats]);

  function boatLabel(boatId: string) {
    return boats.find((b) => b.id === boatId)?.name ?? boatId;
  }

  const boatById = useMemo(() => new Map(catalogBoats.map((b) => [b.id, b])), [catalogBoats]);

  const list = useMemo(() => [...reservations].sort((a, b) => b.start.getTime() - a.start.getTime()), [reservations]);

  const listFiltered = useMemo(() => {
    let rows = list;

    const fromD = parseFilterDateIso(filterDateFrom);
    const toD = parseFilterDateIso(filterDateTo);
    if (fromD) {
      const start = startOfDay(fromD);
      rows = rows.filter((r) => r.end > start);
    }
    if (toD) {
      const endExclusive = addDays(startOfDay(toD), 1);
      rows = rows.filter((r) => r.start < endExclusive);
    }

    const panelQ = filterQuery.trim().toLowerCase();
    if (panelQ) {
      rows = rows.filter((r) => {
        const boat = boatById.get(r.boatId);
        return reservationSearchHaystack(r, boat, boatLabel(r.boatId)).includes(panelQ);
      });
    }

    if (filterBoatId) rows = rows.filter((r) => r.boatId === filterBoatId);
    if (filterBoatType) {
      rows = rows.filter((r) => boatById.get(r.boatId)?.boatType === filterBoatType);
    }

    rows = rows.filter((r) => matchesReservationListFilter(r, listFilter));

    const q = listSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        const boat = boatById.get(r.boatId);
        return reservationSearchHaystack(r, boat, boatLabel(r.boatId)).includes(q);
      });
    }

    return rows;
  }, [
    list,
    filterQuery,
    filterBoatId,
    filterBoatType,
    filterDateFrom,
    filterDateTo,
    listFilter,
    listSearch,
    boatById,
    boats,
  ]);

  useEffect(() => {
    if (listFiltered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !listFiltered.some((r) => r.id === selectedId)) {
      setSelectedId(listFiltered[0]?.id ?? null);
    }
  }, [listFiltered, selectedId]);

  const now = new Date();
  const stats = useMemo(() => {
    const upcoming = list.filter((r) => r.end.getTime() >= now.getTime());
    const paid = list.filter((r) => reservationStatusBadge(r).label === 'Payée');
    const pending = list.filter((r) => reservationStatusBadge(r).label === 'En attente de paiement');
    return {
      total: list.length,
      upcoming: upcoming.length,
      paid: paid.length,
      pending: pending.length,
    };
  }, [list, now]);

  const reservationsFiltersActiveCount =
    (filterDateFrom.trim() ? 1 : 0) +
    (filterDateTo.trim() ? 1 : 0) +
    (filterQuery.trim() ? 1 : 0) +
    (filterBoatId ? 1 : 0) +
    (filterBoatType ? 1 : 0);

  const reservationsFiltersPanel = useMemo(
    () => (
      <div className="space-y-5">
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Période</legend>
          <p className="text-xs leading-relaxed text-zinc-500">
            Filtre les créneaux qui <span className="font-semibold text-zinc-700">croisent</span> la plage choisie.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-zinc-600">Du</span>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-[15px] text-zinc-900 shadow-sm outline-none transition-colors focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-600">Au</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-[15px] text-zinc-900 shadow-sm outline-none transition-colors focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15"
              />
            </label>
          </div>
        </fieldset>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500" htmlFor="res-filter-q">
            Recherche
          </label>
          <input
            id="res-filter-q"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-[15px] text-zinc-900 shadow-sm outline-none transition-colors focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15"
            placeholder="Nom, client, bateau…"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500" htmlFor="res-filter-boat">
            Bateau
          </label>
          <select
            id="res-filter-boat"
            value={filterBoatId}
            onChange={(e) => setFilterBoatId(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-[15px] text-zinc-900 shadow-sm outline-none transition-colors focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15"
          >
            <option value="">Tous les bateaux</option>
            {boats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500" htmlFor="res-filter-type">
            Type de bateau
          </label>
          <select
            id="res-filter-type"
            value={filterBoatType}
            onChange={(e) => setFilterBoatType((e.target.value || '') as '' | BoatType)}
            className="mt-2 w-full rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-[15px] text-zinc-900 shadow-sm outline-none transition-colors focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15"
          >
            <option value="">Tous les types</option>
            {BOAT_TYPES_UI.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setFilterDateFrom('');
            setFilterDateTo('');
            setFilterQuery('');
            setFilterBoatId('');
            setFilterBoatType('');
          }}
          className="w-full rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
        >
          Réinitialiser les filtres
        </button>
      </div>
    ),
    [filterQuery, filterBoatId, filterBoatType, filterDateFrom, filterDateTo, boats, catalogBoats.length],
  );

  const selectedReservation = useMemo(
    () => (selectedId ? reservations.find((x) => x.id === selectedId) ?? null : null),
    [selectedId, reservations],
  );

  const reservationsFiltersConfig = useMemo<PageFiltersConfig>(
    () => ({
      title: 'Réservations',
      subtitle: 'Période, recherche, bateau et type.',
      activeFilterCount: reservationsFiltersActiveCount,
      panelBody: reservationsFiltersPanel,
    }),
    [reservationsFiltersActiveCount, reservationsFiltersPanel],
  );

  usePageFiltersPanel(reservationsFiltersConfig);

  function editReservation(id: string) {
    const r = reservations.find((x) => x.id === id);
    const day = r ? isoDay(r.start) : isoDay(new Date());
    const params = new URLSearchParams({ view: 'day', date: day, open: id, edit: id });
    navigate(`/calendrier?${params.toString()}`);
  }

  function calendarLink(r: Reservation) {
    const day = isoDay(r.start);
    const params = new URLSearchParams({ view: 'day', date: day, open: r.id });
    return `/calendrier?${params.toString()}`;
  }

  return (
    <ContentReveal ready={coreReady} skeleton={<ReservationsPageSkeleton />}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Réservations</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-zinc-500">
            Toutes les locations créées depuis le calendrier — fiche détaillée, statuts, paiements et check-in / check-out.
          </p>
        </div>

        <ThreeStepGuide
          guideKey="reservations"
          title="Gérer une réservation en 3 étapes"
          steps={[
            <>
              Parcourez la liste et les filtres (à venir, payées, annulées). Les filtres avancés sont dans le panneau en
              haut à droite.
            </>,
            <>
              Sélectionnez une ligne pour afficher client, tarifs, caution, extras et le suivi check-in / check-out.
            </>,
            <>
              Utilisez <strong className="font-semibold text-zinc-800">Modifier</strong> ou l&apos;icône calendrier pour
              ouvrir le créneau dans le planning.
            </>,
          ]}
        />

        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
          <span className="rounded-xl border border-zinc-200/90 bg-white px-3 py-2 shadow-sm">
            <span className="font-semibold text-zinc-900">{stats.total}</span> réservation{stats.total !== 1 ? 's' : ''}
          </span>
          <span className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2">
            <span className="font-semibold text-emerald-800">{stats.upcoming}</span> à venir
          </span>
          <span className="rounded-xl border border-zinc-200/90 bg-white px-3 py-2 shadow-sm">
            <span className="font-semibold text-zinc-800">{stats.paid}</span> payée{stats.paid !== 1 ? 's' : ''}
          </span>
          <span className="rounded-xl border border-orange-200/80 bg-orange-50/60 px-3 py-2">
            <span className="font-semibold text-orange-800">{stats.pending}</span> en attente
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            {list.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  const ok = globalThis.confirm('Supprimer toutes les réservations ?');
                  if (!ok) return;
                  setSelectedId(null);
                  clearAll();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-600 shadow-sm hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Tout supprimer
              </button>
            ) : null}
            <Link
              to="/calendrier"
              className="inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#365b87]"
            >
              <Plus className="h-4 w-4" />
              Calendrier
            </Link>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Rechercher une réservation…"
                className="w-full rounded-xl border border-zinc-200/90 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {LIST_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setListFilter(f.id)}
                  className={[
                    'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition',
                    listFilter === f.id
                      ? 'bg-[#416B9F] text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80',
                  ].join(' ')}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="max-h-[min(32rem,58vh)] space-y-2 overflow-y-auto pr-0.5">
              {list.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-xs text-zinc-500">
                  <CalendarDays className="mx-auto h-8 w-8 text-zinc-300" strokeWidth={1.5} />
                  <p className="mt-2 font-medium text-zinc-700">Aucune réservation</p>
                  <p className="mt-1">Créez-en une depuis le calendrier.</p>
                  <Link
                    to="/calendrier"
                    className="mt-3 inline-flex items-center gap-1 rounded-lg bg-[#416B9F] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ouvrir le calendrier
                  </Link>
                </div>
              ) : listFiltered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-xs text-zinc-500">
                  Aucun résultat pour ces critères.
                </div>
              ) : (
                listFiltered.map((r) => {
                  const active = r.id === selectedId;
                  const badge = reservationStatusBadge(r);
                  const client = reservationClientLabel(r);
                  const upcoming = r.end.getTime() >= now.getTime();
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={[
                        'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                        active
                          ? 'border-[#416B9F]/50 bg-[#416B9F]/10 ring-1 ring-[#416B9F]/20'
                          : 'border-zinc-200/90 bg-white hover:bg-zinc-50',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'mt-1.5 inline-flex h-2.5 w-2.5 shrink-0 rounded-full',
                          upcoming ? 'bg-emerald-500' : 'bg-zinc-300',
                        ].join(' ')}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-zinc-900">{r.title}</p>
                          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>
                        {client ? <p className="mt-0.5 truncate text-[11px] text-zinc-600">{client}</p> : null}
                        <p className="mt-1 text-[11px] text-zinc-500">{reservationPeriodShort(r)}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-400">
                          <Ship className="h-3 w-3 shrink-0" aria-hidden />
                          {boatLabel(r.boatId)}
                        </p>
                        {r.rentalContractStatus ? (
                          <div className="mt-1.5">
                            <RentalContractStatusBadge status={r.rentalContractStatus} className="!px-1.5 !py-0.5 !text-[10px]" />
                          </div>
                        ) : null}
                        <div className="mt-1.5 flex gap-2">
                          {r.checkInDone ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700">
                              <LogIn className="h-3 w-3" aria-hidden />
                              CI
                            </span>
                          ) : null}
                          {r.checkOutDone ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700">
                              <LogOut className="h-3 w-3" aria-hidden />
                              CO
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="lg:col-span-8">
            {!selectedId ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-16 text-center">
                <CalendarDays className="h-10 w-10 text-zinc-300" strokeWidth={1.5} />
                <p className="mt-3 text-sm font-medium text-zinc-700">Aucune réservation sélectionnée</p>
                <p className="mt-1 max-w-sm text-xs text-zinc-500">
                  Choisissez une ligne dans la liste ou créez une réservation sur le calendrier.
                </p>
                <Link
                  to="/calendrier"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2 text-sm font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Nouvelle réservation
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap justify-end gap-2">
                  {selectedReservation ? (
                  <Link
                    to={calendarLink(selectedReservation)}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
                  >
                    <Calendar className="h-4 w-4" />
                    Voir au calendrier
                  </Link>
                  ) : null}
                </div>
                <ReservationDetailsPanel
                  layout="embedded"
                  reservationId={selectedId}
                  reservations={reservations}
                  boatsCatalog={catalogBoats}
                  fleetsCatalog={fleets}
                  onEdit={editReservation}
                  onOpenReservation={(id) => setSelectedId(id)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </ContentReveal>
  );
}
