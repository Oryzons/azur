import { useEffect, useMemo, useState } from 'react';
import { Megaphone, Plus, Search, Ship, X } from 'lucide-react';
import { Portal } from '@/components/Portal';
import { usePresence } from '@/lib/presence';
import {
  DEFAULT_NAVAL_BASE,
  useAnnouncementsStore,
  type Announcement,
  type AnnouncementLink,
} from '@/stores/announcements';
import { BOAT_TYPES_UI, useBoatsStore, type Boat, type BoatType, type Fleet } from '@/stores/boats';
import { usePageFiltersPanel, type PageFiltersConfig } from '@/contexts/PageFiltersContext';
import { usePersistedString } from '@/lib/pageFilterStorage';
import { ContentReveal } from '@/components/ui/ContentReveal';
import { ThreeStepGuide } from '@/components/ui/ThreeStepGuide';
import { AnnoncesPageSkeleton } from '@/components/skeletons/AnnoncesPageSkeleton';
import { AnnouncementDetailPanel } from '@/components/annonces/AnnouncementDetailPanel';
import {
  announcementCoverSrc,
  announcementSearchHaystack,
  announcementTargetSummary,
  boatDisplayLabel,
  matchesAnnouncementFleetFilter,
} from '@/lib/announcementUi';
import { PresentationPhotosField } from '@/components/media/PresentationPhotosField';

function publicAnnouncementsUrl() {
  const base =
    (import.meta as any)?.env?.VITE_PUBLIC_SITE_URL
      ? String((import.meta as any).env.VITE_PUBLIC_SITE_URL)
      : window.location.origin;
  return new URL('/annonces', base).toString();
}

function inputBase(disabled?: boolean) {
  return [
    'mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-[15px] text-zinc-900 shadow-sm outline-none transition-colors',
    'border-zinc-200/90 focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15',
    disabled ? 'opacity-60' : '',
  ].join(' ');
}

function FieldLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return <span className="text-xs font-semibold tracking-wide uppercase text-zinc-500">{children}</span>;
}

function roundRadioClass() {
  return 'h-5 w-5 shrink-0 cursor-pointer rounded-full border border-zinc-300 text-[#416B9F] accent-[#416B9F] focus:outline-none focus:ring-2 focus:ring-[#416B9F]/25';
}

type LinkMode = AnnouncementLink['kind'];

export function AnnoncesPage() {
  const fleets = useBoatsStore((s) => s.fleets);
  const boats = useBoatsStore((s) => s.boats);
  const boatsHydrated = useBoatsStore((s) => s.hydrated);
  const refreshBoats = useBoatsStore((s) => s.refresh);
  const announcements = useAnnouncementsStore((s) => s.announcements);
  const hydrated = useAnnouncementsStore((s) => s.hydrated);
  const refresh = useAnnouncementsStore((s) => s.refresh);
  const addAnnouncement = useAnnouncementsStore((s) => s.addAnnouncement);
  const updateAnnouncement = useAnnouncementsStore((s) => s.updateAnnouncement);
  const removeAnnouncement = useAnnouncementsStore((s) => s.removeAnnouncement);

  useEffect(() => {
    if (!hydrated) void refresh();
  }, [hydrated, refresh]);
  useEffect(() => {
    if (!boatsHydrated) void refreshBoats();
  }, [boatsHydrated, refreshBoats]);

  const active = useMemo(() => announcements.filter((a) => a.status === 'active'), [announcements]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = usePersistedString('annonces.search');
  const [fleetFilter, setFleetFilter] = usePersistedString('annonces.fleetFilter', 'all');

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const presence = usePresence(panelOpen, 180);

  const [title, setTitle] = useState('');
  const [navalBase, setNavalBase] = useState(DEFAULT_NAVAL_BASE);
  const [linkMode, setLinkMode] = useState<LinkMode>('existing_boat');
  const [targetFleetId, setTargetFleetId] = useState('');
  const [boatFleetFilter, setBoatFleetFilter] = useState('');
  const [targetBoatId, setTargetBoatId] = useState('');
  const [newFleetName, setNewFleetName] = useState('');
  const [newBoatBrand, setNewBoatBrand] = useState('');
  const [newBoatName, setNewBoatName] = useState('');
  const [newBoatModel, setNewBoatModel] = useState('');
  const [newBoatType, setNewBoatType] = useState<BoatType>('voilier');
  const [newBoatMax, setNewBoatMax] = useState('8');
  const [newBoatFleetId, setNewBoatFleetId] = useState('');
  const [presentationPhotos, setPresentationPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState('');
  const [error, setError] = useState('');

  const fleetFilterOptions = useMemo(() => {
    const opts: { key: string; label: string }[] = [{ key: 'all', label: 'Toutes' }];
    for (const f of fleets) opts.push({ key: f.id, label: f.name });
    opts.push({ key: 'none', label: 'Sans flotille' });
    const nfKeys = new Set<string>();
    for (const a of active) {
      if (a.link.kind === 'new_fleet') {
        const k = `nf:${a.link.fleetName.trim().toLowerCase()}`;
        if (!nfKeys.has(k)) {
          nfKeys.add(k);
          opts.push({ key: k, label: `Nouv. · ${a.link.fleetName.trim()}` });
        }
      }
    }
    return opts;
  }, [fleets, active]);

  const listFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return active
      .filter((a) => matchesAnnouncementFleetFilter(a, fleetFilter, boats))
      .filter((a) => !q || announcementSearchHaystack(a, fleets, boats).includes(q))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [active, fleetFilter, search, fleets, boats]);

  useEffect(() => {
    if (listFiltered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !listFiltered.some((a) => a.id === selectedId)) {
      setSelectedId(listFiltered[0]?.id ?? null);
    }
  }, [listFiltered, selectedId]);

  const selected = useMemo(
    () => (selectedId ? active.find((a) => a.id === selectedId) ?? null : null),
    [active, selectedId],
  );

  const boatsFilteredByFleetForSelect = useMemo(() => {
    if (!boatFleetFilter) return boats;
    return boats.filter((b) => b.fleetId === boatFleetFilter);
  }, [boats, boatFleetFilter]);

  const stats = useMemo(
    () => ({
      total: active.length,
      withPhotos: active.filter((a) => (a.presentationPhotos?.length ?? 0) > 0).length,
      boatLinked: active.filter((a) => a.link.kind === 'existing_boat').length,
    }),
    [active],
  );

  const filtersActiveCount = (search.trim() ? 1 : 0) + (fleetFilter !== 'all' ? 1 : 0);

  usePageFiltersPanel(
    useMemo(
      () =>
        ({
          title: 'Annonces',
          subtitle: 'Recherche et filtre flotille sur la page.',
          activeFilterCount: filtersActiveCount,
          panelBody: (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFleetFilter('all');
              }}
              className="w-full rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
            >
              Réinitialiser les filtres
            </button>
          ),
        }) as PageFiltersConfig,
      [filtersActiveCount],
    ),
  );

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setNavalBase(DEFAULT_NAVAL_BASE);
    setLinkMode('existing_boat');
    setTargetFleetId(fleets[0]?.id ?? '');
    setBoatFleetFilter('');
    setTargetBoatId(boats[0]?.id ?? '');
    setNewFleetName('');
    setNewBoatBrand('');
    setNewBoatName('');
    setNewBoatModel('');
    setNewBoatType('voilier');
    setNewBoatMax('8');
    setNewBoatFleetId('');
    setPresentationPhotos([]);
    setPhotoError('');
    setError('');
  }

  function fillFormFromAnnouncement(a: Announcement) {
    setEditingId(a.id);
    setTitle(a.title);
    setNavalBase(a.navalBase);
    setPresentationPhotos(a.presentationPhotos ?? []);
    setPhotoError('');
    setError('');
    const link = a.link;
    setLinkMode(link.kind);
    if (link.kind === 'existing_fleet') {
      setTargetFleetId(link.fleetId);
    } else if (link.kind === 'existing_boat') {
      setTargetBoatId(link.boatId);
      const boat = boats.find((b) => b.id === link.boatId);
      setBoatFleetFilter(boat?.fleetId ?? '');
    } else if (link.kind === 'new_fleet') {
      setNewFleetName(link.fleetName);
    } else if (link.kind === 'new_boat') {
      setNewBoatBrand(link.brand);
      setNewBoatName(link.name);
      setNewBoatModel(link.model);
      setNewBoatType(link.boatType);
      setNewBoatMax(String(link.maxPassengers));
      setNewBoatFleetId(link.fleetId ?? '');
    }
  }

  function openPanel() {
    resetForm();
    setTargetFleetId(fleets[0]?.id ?? '');
    setTargetBoatId(boats[0]?.id ?? '');
    setPanelOpen(true);
  }

  function openEditPanel(a: Announcement) {
    fillFormFromAnnouncement(a);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setEditingId(null);
  }

  function buildLink(): AnnouncementLink | null {
    if (linkMode === 'existing_fleet') {
      return targetFleetId ? { kind: 'existing_fleet', fleetId: targetFleetId } : null;
    }
    if (linkMode === 'existing_boat') {
      return targetBoatId ? { kind: 'existing_boat', boatId: targetBoatId } : null;
    }
    if (linkMode === 'new_fleet') {
      return newFleetName.trim() ? { kind: 'new_fleet', fleetName: newFleetName.trim() } : null;
    }
    const max = Math.floor(Number(newBoatMax.replaceAll(',', '.')));
    return {
      kind: 'new_boat',
      brand: newBoatBrand.trim(),
      name: newBoatName.trim(),
      model: newBoatModel.trim(),
      boatType: newBoatType,
      maxPassengers: max,
      fleetId: newBoatFleetId.trim() ? newBoatFleetId : null,
    };
  }

  function submitPanel() {
    setError('');
    const link = buildLink();
    if (!link) {
      setError('Complète les champs obligatoires du lien (flotille / bateau).');
      return;
    }
    void (async () => {
      const payload = {
        title,
        navalBase,
        status: 'active' as const,
        link,
        presentationPhotos,
      };
      const res = editingId
        ? await updateAnnouncement(editingId, payload)
        : await addAnnouncement(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSelectedId(res.id);
      closePanel();
    })();
  }

  const pageReady = hydrated && boatsHydrated;
  const publicUrl = publicAnnouncementsUrl();

  return (
    <ContentReveal ready={pageReady} skeleton={<AnnoncesPageSkeleton />}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Annonces</h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-zinc-500">
              Offres publiées sur le site web — rattachées à une flotille ou un bateau du catalogue.
            </p>
          </div>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-[#416B9F] hover:underline"
          >
            Voir la page publique →
          </a>
        </div>

        <ThreeStepGuide
          guideKey="annonces"
          title="Publier une annonce en 3 étapes"
          steps={[
            <>Renseignez le <strong className="font-semibold text-zinc-800">titre</strong>, la base nautique et les photos de présentation.</>,
            <>
              Choisissez le <strong className="font-semibold text-zinc-800">lien</strong> : flotille ou bateau existant, ou description
              indicative (nouvelle entrée).
            </>,
            <>Validez : l&apos;annonce apparaît sur le site public et dans cette liste.</>,
          ]}
        />

        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
          <span className="rounded-xl border border-zinc-200/90 bg-white px-3 py-2 shadow-sm">
            <span className="font-semibold text-zinc-900">{stats.total}</span> active{stats.total !== 1 ? 's' : ''}
          </span>
          <span className="rounded-xl border border-zinc-200/90 bg-white px-3 py-2 shadow-sm">
            <span className="font-semibold text-zinc-800">{stats.withPhotos}</span> avec photo{stats.withPhotos !== 1 ? 's' : ''}
          </span>
          <span className="rounded-xl border border-zinc-200/90 bg-white px-3 py-2 shadow-sm">
            <span className="font-semibold text-zinc-800">{stats.boatLinked}</span> liée{stats.boatLinked !== 1 ? 's' : ''} au catalogue
          </span>
          <button
            type="button"
            onClick={openPanel}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#365b87]"
          >
            <Plus className="h-4 w-4" />
            Nouvelle annonce
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une annonce…"
                className="w-full rounded-xl border border-zinc-200/90 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15"
              />
            </div>
            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
              {fleetFilterOptions.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFleetFilter(f.key)}
                  className={[
                    'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition',
                    fleetFilter === f.key
                      ? 'bg-[#416B9F] text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80',
                  ].join(' ')}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="max-h-[min(32rem,58vh)] space-y-2 overflow-y-auto pr-0.5">
              {active.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-xs text-zinc-500">
                  <Megaphone className="mx-auto h-8 w-8 text-zinc-300" strokeWidth={1.5} />
                  <p className="mt-2 font-medium text-zinc-700">Aucune annonce active</p>
                  <button
                    type="button"
                    onClick={openPanel}
                    className="mt-3 inline-flex items-center gap-1 rounded-lg bg-[#416B9F] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Créer une annonce
                  </button>
                </div>
              ) : listFiltered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-xs text-zinc-500">
                  Aucun résultat pour ces critères.
                </div>
              ) : (
                listFiltered.map((a) => {
                  const isActive = a.id === selectedId;
                  const sum = announcementTargetSummary(a, fleets, boats);
                  const thumb = announcementCoverSrc(a, boats);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelectedId(a.id)}
                      className={[
                        'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                        isActive
                          ? 'border-[#416B9F]/50 bg-[#416B9F]/10 ring-1 ring-[#416B9F]/20'
                          : 'border-zinc-200/90 bg-white hover:bg-zinc-50',
                      ].join(' ')}
                    >
                      {thumb ? (
                        <img src={thumb} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-zinc-200 object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50">
                          <Ship className="h-4 w-4 text-zinc-300" aria-hidden />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-zinc-900">{a.title}</p>
                        <p className="truncate text-[11px] text-zinc-500">{sum.line}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="lg:col-span-8">
            {!selected ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-16 text-center">
                <Megaphone className="h-10 w-10 text-zinc-300" strokeWidth={1.5} />
                <p className="mt-3 text-sm font-medium text-zinc-700">Aucune annonce sélectionnée</p>
                <p className="mt-1 max-w-sm text-xs text-zinc-500">
                  Choisissez une annonce dans la liste ou créez-en une nouvelle.
                </p>
                <button
                  type="button"
                  onClick={openPanel}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2 text-sm font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Nouvelle annonce
                </button>
              </div>
            ) : (
              <AnnouncementDetailPanel
                announcement={selected}
                fleets={fleets}
                boats={boats}
                publicUrl={publicUrl}
                onEdit={() => openEditPanel(selected)}
                onDelete={() => {
                  const ok = globalThis.confirm(`Supprimer l’annonce « ${selected.title} » ?`);
                  if (!ok) return;
                  removeAnnouncement(selected.id);
                  setSelectedId(null);
                }}
              />
            )}
          </div>
        </div>

        <AnnouncementCreatePanel
          presence={presence}
          onClose={closePanel}
          mode={editingId ? 'edit' : 'create'}
          title={title}
          setTitle={setTitle}
          navalBase={navalBase}
          setNavalBase={setNavalBase}
          linkMode={linkMode}
          setLinkMode={setLinkMode}
          fleets={fleets}
          boats={boats}
          boatsFiltered={boatsFilteredByFleetForSelect}
          targetFleetId={targetFleetId}
          setTargetFleetId={setTargetFleetId}
          boatFleetFilter={boatFleetFilter}
          setBoatFleetFilter={setBoatFleetFilter}
          targetBoatId={targetBoatId}
          setTargetBoatId={setTargetBoatId}
          newFleetName={newFleetName}
          setNewFleetName={setNewFleetName}
          newBoatBrand={newBoatBrand}
          setNewBoatBrand={setNewBoatBrand}
          newBoatName={newBoatName}
          setNewBoatName={setNewBoatName}
          newBoatModel={newBoatModel}
          setNewBoatModel={setNewBoatModel}
          newBoatType={newBoatType}
          setNewBoatType={setNewBoatType}
          newBoatMax={newBoatMax}
          setNewBoatMax={setNewBoatMax}
          newBoatFleetId={newBoatFleetId}
          setNewBoatFleetId={setNewBoatFleetId}
          presentationPhotos={presentationPhotos}
          setPresentationPhotos={setPresentationPhotos}
          photoError={photoError}
          setPhotoError={setPhotoError}
          error={error}
          submit={submitPanel}
        />
      </div>
    </ContentReveal>
  );
}

function AnnouncementCreatePanel(
  props: Readonly<{
    presence: { present: boolean; phase: 'enter' | 'exit' };
    onClose: () => void;
    mode: 'create' | 'edit';
    title: string;
    setTitle: (v: string) => void;
    navalBase: string;
    setNavalBase: (v: string) => void;
    linkMode: LinkMode;
    setLinkMode: (v: LinkMode) => void;
    fleets: Fleet[];
    boats: Boat[];
    boatsFiltered: Boat[];
    targetFleetId: string;
    setTargetFleetId: (v: string) => void;
    boatFleetFilter: string;
    setBoatFleetFilter: (v: string) => void;
    targetBoatId: string;
    setTargetBoatId: (v: string) => void;
    newFleetName: string;
    setNewFleetName: (v: string) => void;
    newBoatBrand: string;
    setNewBoatBrand: (v: string) => void;
    newBoatName: string;
    setNewBoatName: (v: string) => void;
    newBoatModel: string;
    setNewBoatModel: (v: string) => void;
    newBoatType: BoatType;
    setNewBoatType: (v: BoatType) => void;
    newBoatMax: string;
    setNewBoatMax: (v: string) => void;
    newBoatFleetId: string;
    setNewBoatFleetId: (v: string) => void;
    presentationPhotos: string[];
    setPresentationPhotos: (v: string[] | ((prev: string[]) => string[])) => void;
    photoError: string;
    setPhotoError: (v: string) => void;
    error: string;
    submit: () => void;
  }>,
) {
  const { presence, onClose, mode } = props;
  if (!presence.present) return null;

  const panelTitle = mode === 'edit' ? 'Modifier l’annonce' : 'Nouvelle annonce';
  const panelSubtitle =
    mode === 'edit'
      ? 'Mettez à jour le titre, les photos ou le rattachement à l’offre.'
      : 'Titre, base nautique, photos et rattachement à l’offre.';
  const submitLabel = mode === 'edit' ? 'Enregistrer' : 'Publier';

  return (
    <Portal>
      <div className="fixed inset-0 z-50">
        <button
          type="button"
          className={['absolute inset-0 bg-black/30 bc-animate', presence.phase === 'enter' ? 'bc-overlay-enter' : 'bc-overlay-exit'].join(
            ' ',
          )}
          aria-label="Fermer"
          onClick={onClose}
        />
        <div
          className={[
            'absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl bc-animate',
            presence.phase === 'enter' ? 'bc-panel-enter' : 'bc-panel-exit',
          ].join(' ')}
        >
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200/80 bg-white/90 px-6 py-5 backdrop-blur">
            <div>
              <p className="text-lg font-bold tracking-tight text-zinc-900">{panelTitle}</p>
              <p className="mt-1 text-sm text-zinc-500">{panelSubtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-200/90 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" strokeWidth={1.9} aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
            {props.error ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {props.error}
              </p>
            ) : null}

            <label className="block">
              <FieldLabel>Titre de l&apos;annonce</FieldLabel>
              <input
                value={props.title}
                onChange={(e) => props.setTitle(e.target.value)}
                className={inputBase()}
                placeholder="ex: Sortie groupe entreprise…"
              />
            </label>

            <label className="block">
              <FieldLabel>Base nautique</FieldLabel>
              <input
                value={props.navalBase}
                onChange={(e) => props.setNavalBase(e.target.value)}
                className={inputBase()}
                placeholder={DEFAULT_NAVAL_BASE}
              />
              <p className="mt-1.5 text-xs text-zinc-400">Par défaut : {DEFAULT_NAVAL_BASE}</p>
            </label>

            <PresentationPhotosField
              label="Photos de l'annonce"
              photos={props.presentationPhotos}
              setPhotos={props.setPresentationPhotos}
              photoError={props.photoError}
              setPhotoError={props.setPhotoError}
            />

            <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Lien avec l&apos;offre</p>
              <p className="mt-1 text-xs text-zinc-400">
                Flotille ou bateau du catalogue, ou description indicative pour cette annonce uniquement.
              </p>

              <div className="mt-4 space-y-3">
                {(
                  [
                    ['existing_fleet', 'Flotille existante'],
                    ['existing_boat', 'Bateau existant'],
                    ['new_fleet', 'Nouvelle flotille (texte)'],
                    ['new_boat', 'Nouveau bateau (indicatif)'],
                  ] as const
                ).map(([mode, label]) => (
                  <label
                    key={mode}
                    className="flex cursor-pointer items-start gap-3 rounded-2xl border border-transparent bg-white/80 px-3 py-2 shadow-sm hover:border-[#416B9F]/20"
                  >
                    <input
                      type="radio"
                      name="link-mode"
                      className={roundRadioClass()}
                      checked={props.linkMode === mode}
                      onChange={() => props.setLinkMode(mode)}
                    />
                    <span className="text-sm font-medium text-zinc-800">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {props.linkMode === 'existing_fleet' ? (
              <div className="space-y-2 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm">
                <FieldLabel>Flotille</FieldLabel>
                <select value={props.targetFleetId} onChange={(e) => props.setTargetFleetId(e.target.value)} className={inputBase()}>
                  {!props.fleets.length ? <option value="">— Aucune flotille</option> : null}
                  {props.fleets.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {props.linkMode === 'existing_boat' ? (
              <div className="space-y-4 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm">
                <label className="block">
                  <FieldLabel>Flotille (filtre)</FieldLabel>
                  <select
                    value={props.boatFleetFilter}
                    onChange={(e) => {
                      const v = e.target.value;
                      props.setBoatFleetFilter(v);
                      const pool = v ? props.boats.filter((b) => b.fleetId === v) : props.boats;
                      if (!pool.some((b) => b.id === props.targetBoatId) && pool[0]) {
                        props.setTargetBoatId(pool[0].id);
                      }
                    }}
                    className={inputBase()}
                  >
                    <option value="">Toutes les flotilles</option>
                    {props.fleets.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <FieldLabel>Bateau</FieldLabel>
                  <select value={props.targetBoatId} onChange={(e) => props.setTargetBoatId(e.target.value)} className={inputBase()}>
                    {!props.boatsFiltered.length ? <option value="">— Aucun bateau</option> : null}
                    {props.boatsFiltered.map((b) => (
                      <option key={b.id} value={b.id}>
                        {boatDisplayLabel(b)} — {b.model}
                      </option>
                    ))}
                  </select>
                  <SummarizeBoat boats={props.boats} boatId={props.targetBoatId} />
                </label>
              </div>
            ) : null}

            {props.linkMode === 'new_fleet' ? (
              <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm">
                <label className="block">
                  <FieldLabel>Nom de la nouvelle flotille</FieldLabel>
                  <input
                    value={props.newFleetName}
                    onChange={(e) => props.setNewFleetName(e.target.value)}
                    className={inputBase()}
                    placeholder="ex: Croisières Corse été 2026"
                  />
                </label>
              </div>
            ) : null}

            {props.linkMode === 'new_boat' ? (
              <div className="grid grid-cols-1 gap-4 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <FieldLabel>Flotille existante (optionnel)</FieldLabel>
                  <select value={props.newBoatFleetId} onChange={(e) => props.setNewBoatFleetId(e.target.value)} className={inputBase()}>
                    <option value="">Sans flotille</option>
                    {props.fleets.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <FieldLabel>Marque</FieldLabel>
                  <input value={props.newBoatBrand} onChange={(e) => props.setNewBoatBrand(e.target.value)} className={inputBase()} />
                </label>
                <label className="block">
                  <FieldLabel>Nom</FieldLabel>
                  <input value={props.newBoatName} onChange={(e) => props.setNewBoatName(e.target.value)} className={inputBase()} />
                </label>
                <label className="block sm:col-span-2">
                  <FieldLabel>Modèle</FieldLabel>
                  <input value={props.newBoatModel} onChange={(e) => props.setNewBoatModel(e.target.value)} className={inputBase()} />
                </label>
                <label className="block">
                  <FieldLabel>Type</FieldLabel>
                  <select value={props.newBoatType} onChange={(e) => props.setNewBoatType(e.target.value as BoatType)} className={inputBase()}>
                    {BOAT_TYPES_UI.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <FieldLabel>Passagers max</FieldLabel>
                  <input
                    value={props.newBoatMax}
                    onChange={(e) => props.setNewBoatMax(e.target.value)}
                    className={inputBase()}
                    inputMode="numeric"
                  />
                </label>
              </div>
            ) : null}

            <div className="flex justify-end gap-3 border-t border-zinc-100 pt-5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={props.submit}
                className="rounded-2xl bg-[#416B9F] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#365b87]"
              >
                {submitLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function SummarizeBoat(props: Readonly<{ boats: Boat[]; boatId: string }>) {
  const b = props.boats.find((x) => x.id === props.boatId);
  if (!b) return <p className="mt-2 text-xs text-zinc-400">Sélectionnez un bateau.</p>;
  const typeLbl = BOAT_TYPES_UI.find((t) => t.value === b.boatType)?.label ?? b.boatType;
  return (
    <div className="mt-3 rounded-2xl border border-zinc-100 bg-zinc-50/90 px-3 py-3 text-xs text-zinc-600">
      <p>
        <span className="font-semibold text-zinc-700">Modèle</span> · {b.model}
      </p>
      <p className="mt-1">
        <span className="font-semibold text-zinc-700">Type</span> · {typeLbl}
      </p>
      <p className="mt-1">
        <span className="font-semibold text-zinc-700">Passagers</span> · {b.maxPassengers}
      </p>
    </div>
  );
}
