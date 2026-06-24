import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  PackagePlus,
  Percent,
  Plus,
  Search,
  Trash2,
  Boxes,
  CreditCard,
  FileText,
  History,
} from 'lucide-react';
import { RoundCheckbox } from '@/components/RoundCheckbox';
import { ContentReveal } from '@/components/ui/ContentReveal';
import { ThreeStepGuide } from '@/components/ui/ThreeStepGuide';
import { ExtrasPageSkeleton } from '@/components/skeletons/ExtrasPageSkeleton';
import {
  EMPTY_EXTRA_TEMPLATE,
  EXTRA_BILLING_UNITS,
  extraInitials,
  extraSearchHaystack,
  paymentChannelLabel,
  priceKindLabel,
  stockLabel,
  vatLabel,
} from '@/lib/extraUi';
import {
  billingUnitLabel,
  formatExtraPriceLine,
  useExtrasStore,
  type Extra,
  type ExtraBillingUnit,
  type ExtraPriceKind,
} from '@/stores/extras';
import { useDefaultPageFilters } from '@/contexts/PageFiltersContext';
import { usePersistedEnum, usePersistedString } from '@/lib/pageFilterStorage';
import { EXTRA_ICON_OPTIONS } from '@/lib/extraIcons';
import { resolveExtraIcon } from '@bleu-calanque/shared';
import {
  extraRentalClientLabel,
  extraRentalStatusLabel,
  formatExtraRentalAmount,
  useExtraRentalsStore,
  type ExtraRental,
} from '@/stores/extraRentals';

type EditorSection = 'general' | 'pricing' | 'availability' | 'history';
type ListFilter = 'all' | 'active' | 'inactive';

function inputCls() {
  return 'mt-1.5 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15';
}

function FieldLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{children}</span>;
}

function StatusBadge({ enabled }: Readonly<{ enabled: boolean }>) {
  return enabled ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Actif
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
      Inactif
    </span>
  );
}

function ExtraAvatar({ name }: Readonly<{ name: string }>) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#416B9F]/12 text-sm font-bold text-[#416B9F]">
      {extraInitials(name)}
    </span>
  );
}

function parsePriceValueInput(raw: string, kind: ExtraPriceKind): number {
  const n = Number.parseFloat(String(raw).replaceAll(',', '.'));
  if (!Number.isFinite(n)) return kind === 'percent' ? 0 : 0;
  return n;
}

export function ExtrasPage() {
  useDefaultPageFilters('Extras');
  const extras = useExtrasStore((s) => s.extras);
  const hydrated = useExtrasStore((s) => s.hydrated);
  const refresh = useExtrasStore((s) => s.refresh);
  const addExtra = useExtrasStore((s) => s.addExtra);
  const updateExtra = useExtrasStore((s) => s.updateExtra);
  const removeExtra = useExtrasStore((s) => s.removeExtra);

  const [selectedId, setSelectedId] = useState<string>('');
  const [search, setSearch] = usePersistedString('extras.search');
  const [listFilter, setListFilter] = usePersistedEnum<ListFilter>(
    'extras.listFilter',
    'all',
    ['all', 'active', 'inactive'],
  );
  const [section, setSection] = useState<EditorSection>('general');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [priceDraft, setPriceDraft] = useState('');
  const [vatDraft, setVatDraft] = useState('');
  const [rentalHistory, setRentalHistory] = useState<ExtraRental[]>([]);
  const [rentalsLoading, setRentalsLoading] = useState(false);
  const listExtraRentals = useExtraRentalsStore((s) => s.listByExtra);

  useEffect(() => {
    if (!hydrated) void refresh();
  }, [hydrated, refresh]);

  useEffect(() => {
    if (section !== 'history' || !selectedId) {
      setRentalHistory([]);
      return;
    }
    let cancelled = false;
    setRentalsLoading(true);
    void listExtraRentals(selectedId)
      .then((rows) => {
        if (!cancelled) setRentalHistory(rows);
      })
      .finally(() => {
        if (!cancelled) setRentalsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section, selectedId, listExtraRentals]);

  const sorted = useMemo(
    () => [...extras].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [extras],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((ex) => {
      if (listFilter === 'active' && !ex.enabled) return false;
      if (listFilter === 'inactive' && ex.enabled) return false;
      if (!q) return true;
      return extraSearchHaystack(ex).includes(q);
    });
  }, [sorted, search, listFilter]);

  const selected = useMemo(
    () => extras.find((ex) => ex.id === selectedId) ?? null,
    [extras, selectedId],
  );

  useEffect(() => {
    if (extras.length === 0) {
      setSelectedId('');
      return;
    }
    if (!selectedId || !extras.some((ex) => ex.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? sorted[0]?.id ?? '');
    }
  }, [extras, selectedId, filtered, sorted]);

  useEffect(() => {
    if (!selected) {
      setPriceDraft('');
      setVatDraft('');
      return;
    }
    setPriceDraft(
      selected.priceKind === 'percent'
        ? String(selected.priceValue)
        : selected.priceValue.toFixed(2).replace('.', ','),
    );
    setVatDraft(String(selected.vatRate));
  }, [selected?.id, selected?.priceKind, selected?.priceValue, selected?.vatRate]);

  const stats = useMemo(
    () => ({
      total: extras.length,
      active: extras.filter((ex) => ex.enabled).length,
      online: extras.filter((ex) => ex.paymentChannel === 'online').length,
    }),
    [extras],
  );

  async function patchSelected(patch: Partial<Extra>) {
    if (!selected) return;
    setFormError('');
    const res = await updateExtra({ ...selected, ...patch });
    if (!res.ok) setFormError(res.error);
  }

  function handleAdd() {
    setFormError('');
    const res = addExtra({
      ...EMPTY_EXTRA_TEMPLATE,
      name: 'Nouvel extra',
    });
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setSelectedId(res.id);
    setSection('general');
    setConfirmDeleteId(null);
  }

  function handleDelete(id: string) {
    removeExtra(id);
    setConfirmDeleteId(null);
    if (selectedId === id) setSelectedId('');
  }

  return (
    <ContentReveal ready={hydrated} skeleton={<ExtrasPageSkeleton />}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Extras</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-zinc-500">
            Options additionnelles proposées dans le wizard de réservation (skipper, literie, ménage…).
          </p>
        </div>

        <ThreeStepGuide
          guideKey="extras"
          title="Configurer un extra en 3 étapes"
          steps={[
            <>Nom et description affichés aux agents lors de la création de réservation.</>,
            <>
              Tarif en <strong className="font-semibold text-zinc-800">€ ou %</strong>, unité de facturation et TVA.
            </>,
            <>Stock, canal de paiement et activation pour le rendre proposable ou non.</>,
          ]}
        />

        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
          <span className="rounded-xl border border-zinc-200/90 bg-white px-3 py-2 shadow-sm">
            <span className="font-semibold text-zinc-900">{stats.total}</span> extra{stats.total !== 1 ? 's' : ''}
          </span>
          <span className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2">
            <span className="font-semibold text-emerald-800">{stats.active}</span> actif{stats.active !== 1 ? 's' : ''}
          </span>
          <span className="rounded-xl border border-zinc-200/90 bg-white px-3 py-2 shadow-sm">
            <span className="font-semibold text-zinc-800">{stats.online}</span> paiement en ligne
          </span>
          <button
            type="button"
            onClick={handleAdd}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#365b87]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            Nouvel extra
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
                placeholder="Rechercher un extra…"
                className="w-full rounded-xl border border-zinc-200/90 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all' as const, label: 'Tous' },
                  { id: 'active' as const, label: 'Actifs' },
                  { id: 'inactive' as const, label: 'Inactifs' },
                ] as const
              ).map((f) => (
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
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-xs text-zinc-500">
                  {extras.length === 0
                    ? 'Aucun extra. Créez le premier via le bouton ci-dessus.'
                    : 'Aucun résultat pour cette recherche.'}
                </div>
              ) : (
                filtered.map((ex) => {
                  const active = ex.id === selectedId;
                  return (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(ex.id);
                        setConfirmDeleteId(null);
                        setFormError('');
                      }}
                      className={[
                        'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                        active
                          ? 'border-[#416B9F]/50 bg-[#416B9F]/10 ring-1 ring-[#416B9F]/20'
                          : 'border-zinc-200/90 bg-white hover:bg-zinc-50',
                        !ex.enabled ? 'opacity-75' : '',
                      ].join(' ')}
                    >
                      <ExtraAvatar name={ex.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-zinc-900">{ex.name || 'Sans nom'}</p>
                        <p className="truncate text-[11px] text-zinc-500">{formatExtraPriceLine(ex)}</p>
                      </div>
                      <StatusBadge enabled={ex.enabled} />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="lg:col-span-8">
            {!selected ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-16 text-center">
                <PackagePlus className="h-10 w-10 text-zinc-300" strokeWidth={1.5} />
                <p className="mt-3 text-sm font-medium text-zinc-700">Aucun extra sélectionné</p>
                <p className="mt-1 max-w-sm text-xs text-zinc-500">
                  Créez un extra pour le proposer lors des réservations sur le calendrier.
                </p>
                <button
                  type="button"
                  onClick={handleAdd}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2 text-sm font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter un extra
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-2 ring-[#416B9F]/15 ring-offset-2">
                <div className="flex flex-wrap items-start gap-4 border-b border-zinc-100 p-4 sm:p-5">
                  <ExtraAvatar name={selected.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-zinc-900">{selected.name || 'Sans nom'}</h3>
                      <StatusBadge enabled={selected.enabled} />
                    </div>
                    <p className="mt-1 text-sm font-medium text-[#416B9F]">{formatExtraPriceLine(selected)}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      TVA {vatLabel(selected.vatRate)} · Stock {stockLabel(selected.stock)} ·{' '}
                      {paymentChannelLabel(selected.paymentChannel)}
                    </p>
                  </div>
                  <RoundCheckbox
                    checked={selected.enabled}
                    onChange={(v) => patchSelected({ enabled: v })}
                    label={selected.enabled ? 'Proposable à la réservation' : 'Masqué (non proposé)'}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                  />
                </div>

                <div className="flex gap-1 border-b border-zinc-100 px-4 sm:px-5">
                  {(
                    [
                      { id: 'general' as const, label: 'Général', Icon: FileText },
                      { id: 'pricing' as const, label: 'Tarif', Icon: Banknote },
                      { id: 'availability' as const, label: 'Stock & paiement', Icon: CreditCard },
                      { id: 'history' as const, label: 'Historique', Icon: History },
                    ] as const
                  ).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSection(id)}
                      className={[
                        'inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition',
                        section === id
                          ? 'border-[#416B9F] text-[#416B9F]'
                          : 'border-transparent text-zinc-500 hover:text-zinc-800',
                      ].join(' ')}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="space-y-4 p-4 sm:p-5">
                  {formError ? (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                      {formError}
                    </p>
                  ) : null}

                  {section === 'general' ? (
                    <div className="space-y-4">
                      <label className="block">
                        <FieldLabel>Nom *</FieldLabel>
                        <input
                          value={selected.name}
                          onChange={(e) => patchSelected({ name: e.target.value })}
                          className={inputCls()}
                          placeholder="ex. Skipper demi-journée"
                        />
                      </label>
                      <label className="block">
                        <FieldLabel>Description</FieldLabel>
                        <textarea
                          value={selected.description}
                          onChange={(e) => patchSelected({ description: e.target.value })}
                          rows={4}
                          className={inputCls()}
                          placeholder="Détail affiché aux agents (optionnel)"
                        />
                      </label>
                      <div className="block">
                        <FieldLabel>Icône (calendrier)</FieldLabel>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          Affichée dans le bloc de réservation pour repérer cet extra d’un coup d’œil.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {EXTRA_ICON_OPTIONS.map(({ key, label, Icon }) => {
                            const active = resolveExtraIcon(selected.icon) === key;
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => patchSelected({ icon: key })}
                                title={label}
                                className={[
                                  'flex h-10 w-10 items-center justify-center rounded-xl border transition',
                                  active
                                    ? 'border-[#416B9F] bg-[#416B9F]/10 text-[#416B9F] ring-1 ring-[#416B9F]/25'
                                    : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50',
                                ].join(' ')}
                              >
                                <Icon className="h-5 w-5" strokeWidth={2} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {section === 'pricing' ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => {
                            patchSelected({ priceKind: 'euro' });
                            setPriceDraft(
                              selected.priceValue.toFixed(2).replace('.', ','),
                            );
                          }}
                          className={[
                            'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
                            selected.priceKind === 'euro'
                              ? 'border-[#416B9F] bg-[#416B9F]/10 ring-1 ring-[#416B9F]/25'
                              : 'border-zinc-200 bg-white hover:bg-zinc-50',
                          ].join(' ')}
                        >
                          <Banknote className="h-5 w-5 text-[#416B9F]" />
                          <div>
                            <p className="text-sm font-semibold text-zinc-900">Montant fixe</p>
                            <p className="text-xs text-zinc-500">Prix en euros</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            patchSelected({ priceKind: 'percent' });
                            setPriceDraft(String(selected.priceValue));
                          }}
                          className={[
                            'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
                            selected.priceKind === 'percent'
                              ? 'border-[#416B9F] bg-[#416B9F]/10 ring-1 ring-[#416B9F]/25'
                              : 'border-zinc-200 bg-white hover:bg-zinc-50',
                          ].join(' ')}
                        >
                          <Percent className="h-5 w-5 text-[#416B9F]" />
                          <div>
                            <p className="text-sm font-semibold text-zinc-900">Pourcentage</p>
                            <p className="text-xs text-zinc-500">% sur la location</p>
                          </div>
                        </button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                          <FieldLabel>
                            {selected.priceKind === 'percent' ? 'Valeur (%)' : 'Montant (€)'}
                          </FieldLabel>
                          <input
                            value={priceDraft}
                            onChange={(e) => setPriceDraft(e.target.value)}
                            onBlur={() => {
                              const pv = parsePriceValueInput(priceDraft, selected.priceKind);
                              patchSelected({ priceValue: pv });
                            }}
                            className={inputCls()}
                            inputMode="decimal"
                          />
                        </label>
                        <label className="block">
                          <FieldLabel>Facturation</FieldLabel>
                          <select
                            value={selected.billingUnit}
                            onChange={(e) =>
                              patchSelected({ billingUnit: e.target.value as ExtraBillingUnit })
                            }
                            className={inputCls()}
                          >
                            {EXTRA_BILLING_UNITS.map((u) => (
                              <option key={u} value={u}>
                                {billingUnitLabel(u)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <label className="block sm:max-w-xs">
                        <FieldLabel>TVA (%)</FieldLabel>
                        <input
                          value={vatDraft}
                          onChange={(e) => setVatDraft(e.target.value)}
                          onBlur={() => {
                            const vr = Number.parseFloat(vatDraft.replaceAll(',', '.'));
                            if (Number.isFinite(vr)) patchSelected({ vatRate: vr });
                          }}
                          className={inputCls()}
                          inputMode="decimal"
                        />
                      </label>

                      <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                        Aperçu : <strong className="text-zinc-900">{formatExtraPriceLine(selected)}</strong> (
                        {priceKindLabel(selected.priceKind)})
                      </p>
                    </div>
                  ) : null}

                  {section === 'availability' ? (
                    <div className="space-y-4">
                      <label className="block sm:max-w-xs">
                        <FieldLabel>Stock disponible (par jour)</FieldLabel>
                        <input
                          value={selected.stock === null ? '' : String(selected.stock)}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            if (!raw) {
                              patchSelected({ stock: null });
                              return;
                            }
                            const st = Math.floor(Number.parseFloat(raw.replaceAll(',', '.')));
                            if (Number.isFinite(st)) patchSelected({ stock: st });
                          }}
                          className={inputCls()}
                          inputMode="numeric"
                          placeholder="Vide = illimité"
                        />
                        <p className="mt-1 text-[11px] text-zinc-500">
                          Nombre maximum louable le <strong>même jour</strong> (ex. 2 bouées le lundi, puis encore 1 le
                          mardi). Laissez vide pour ne pas limiter.
                        </p>
                      </label>

                      <div className="space-y-2">
                        <FieldLabel>Canal de paiement</FieldLabel>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {(
                            [
                              { id: 'online' as const, label: 'En ligne', hint: 'Stripe / paiement client' },
                              { id: 'offline' as const, label: 'Hors ligne', hint: 'Réglé sur place' },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => patchSelected({ paymentChannel: opt.id })}
                              className={[
                                'rounded-xl border px-4 py-3 text-left transition',
                                selected.paymentChannel === opt.id
                                  ? 'border-[#416B9F] bg-[#416B9F]/10 ring-1 ring-[#416B9F]/25'
                                  : 'border-zinc-200 bg-white hover:bg-zinc-50',
                              ].join(' ')}
                            >
                              <p className="text-sm font-semibold text-zinc-900">{opt.label}</p>
                              <p className="text-xs text-zinc-500">{opt.hint}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/50 px-3 py-3">
                        <Boxes className="h-5 w-5 shrink-0 text-amber-700" />
                        <p className="text-xs leading-relaxed text-amber-950">
                          Un extra <strong>inactif</strong> reste dans le catalogue mais n’apparaît plus dans le wizard
                          de réservation.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {section === 'history' ? (
                    <div className="space-y-3">
                      <p className="text-xs text-zinc-500">
                        Locations de cet extra sans réservation bateau (wake, skipper seul, etc.).
                      </p>
                      {rentalsLoading ? (
                        <p className="text-sm text-zinc-500">Chargement…</p>
                      ) : rentalHistory.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
                          Aucune location pour le moment.
                        </p>
                      ) : (
                        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200/90">
                          {rentalHistory.map((row) => {
                            const start = new Date(row.startAt);
                            const end = new Date(row.endAt);
                            const range = `${start.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} · ${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} → ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
                            const status = extraRentalStatusLabel(row.status);
                            const statusCls =
                              row.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                                : row.status === 'CANCELLED'
                                  ? 'bg-zinc-100 text-zinc-600 ring-zinc-200'
                                  : 'bg-amber-50 text-amber-900 ring-amber-200';
                            return (
                              <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-zinc-900">
                                    {extraRentalClientLabel(row)}
                                    {row.quantity > 1 ? ` × ${row.quantity}` : ''}
                                  </p>
                                  <p className="mt-0.5 text-xs text-zinc-500">{range}</p>
                                  {row.clientEmail ? (
                                    <p className="mt-0.5 text-xs text-zinc-400">{row.clientEmail}</p>
                                  ) : null}
                                </div>
                                <div className="text-right">
                                  <span
                                    className={[
                                      'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                                      statusCls,
                                    ].join(' ')}
                                  >
                                    {status}
                                  </span>
                                  <p className="mt-1 text-sm font-semibold text-zinc-800">
                                    {formatExtraRentalAmount(row.totalDueCents)}
                                  </p>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-4 py-3 sm:px-5">
                  <p className="text-[11px] text-zinc-400">
                    Créé le{' '}
                    {new Date(selected.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  {confirmDeleteId === selected.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-red-700">Supprimer cet extra ?</span>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(selected.id)}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                      >
                        Confirmer
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(selected.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ContentReveal>
  );
}
