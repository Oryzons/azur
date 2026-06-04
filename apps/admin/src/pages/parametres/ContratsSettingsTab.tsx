import { useEffect, useMemo, useState } from 'react';
import { Eye, FileText, Loader2, Plus, Scale, ScrollText, Search, Shield, Sparkles, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { extractApiErrorMessage } from '@/lib/apiError';
import { openPdfBlobInNewTab } from '@/lib/openPdfBlob';
import { RoundCheckbox } from '@/components/RoundCheckbox';
import { ContractSignaturePad } from '@/components/ContractSignaturePad';
import { useSettingsStore, type Contract } from '@/stores/settings';

type EditorSection = 'general' | 'documents' | 'terms';
type ListFilter = 'all' | 'active' | 'inactive';

function inputCls() {
  return 'mt-1.5 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15';
}

function FieldLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{children}</span>;
}

function StatusBadge({ active }: Readonly<{ active: boolean }>) {
  return active ? (
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

const EMPTY_CONTRACT: Omit<Contract, 'id' | 'createdAt'> = {
  name: 'Nouveau contrat',
  title: 'Contrat de location',
  description: '',
  requiredDocuments: [],
  cancellationTerms: '',
  rentalTerms: '',
  active: true,
};

export function ContratsSettingsTab() {
  const contracts = useSettingsStore((s) => s.contracts);
  const company = useSettingsStore((s) => s.company);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const addContract = useSettingsStore((s) => s.addContract);
  const updateContract = useSettingsStore((s) => s.updateContract);
  const removeContract = useSettingsStore((s) => s.removeContract);
  const applyDefaultContractTemplate = useSettingsStore((s) => s.applyDefaultContractTemplate);

  const [selectedId, setSelectedId] = useState('');
  const [applyingDefaults, setApplyingDefaults] = useState(false);
  const [search, setSearch] = useState('');
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [section, setSection] = useState<EditorSection>('general');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const sorted = useMemo(
    () => contracts.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [contracts],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((c) => {
      if (listFilter === 'active' && !c.active) return false;
      if (listFilter === 'inactive' && c.active) return false;
      if (!q) return true;
      const hay = [c.name, c.title, c.description, ...c.requiredDocuments].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [sorted, search, listFilter]);

  const selected = useMemo(
    () => contracts.find((c) => c.id === selectedId) ?? null,
    [contracts, selectedId],
  );

  useEffect(() => {
    if (contracts.length === 0) {
      setSelectedId('');
      return;
    }
    if (!selectedId || !contracts.some((c) => c.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? sorted[0]?.id ?? '');
    }
  }, [contracts, selectedId, filtered, sorted]);

  function handleAdd() {
    const id = addContract({ ...EMPTY_CONTRACT });
    setSelectedId(id);
    setSection('general');
    setConfirmDeleteId(null);
  }

  const stats = useMemo(
    () => ({
      total: contracts.length,
      active: contracts.filter((c) => c.active).length,
    }),
    [contracts],
  );

  const selectedNeedsDefaults = useMemo(() => {
    if (!selected) return false;
    return (
      !selected.cancellationTerms.trim() &&
      !selected.rentalTerms.trim() &&
      selected.requiredDocuments.length === 0
    );
  }, [selected]);

  async function handleApplyDefaults() {
    if (!selected || applyingDefaults) return;
    setApplyingDefaults(true);
    try {
      await applyDefaultContractTemplate(selected.id);
      setSection('terms');
    } finally {
      setApplyingDefaults(false);
    }
  }

  async function handlePreviewPdf(contractId: string) {
    setPreviewError(null);
    setPreviewingId(contractId);
    try {
      const res = await api.get(`/contracts/${contractId}/preview`, { responseType: 'blob' });
      const ok = openPdfBlobInNewTab(res.data);
      if (!ok) setPreviewError('Autorisez les pop-ups pour afficher l’aperçu PDF.');
    } catch (e: unknown) {
      setPreviewError(extractApiErrorMessage(e, 'Aperçu PDF impossible.'));
    } finally {
      setPreviewingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-semibold text-zinc-900">Signature exploitant (par défaut)</h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          Appliquée automatiquement à chaque contrat tant qu&apos;aucune signature n&apos;a été enregistrée pour la
          réservation. Obligatoire avant la signature client.
        </p>
        <div className="mt-4 max-w-md">
          <ContractSignaturePad
            label="Signature de l'exploitant"
            value={company.contractOperatorSignatureDataUrl}
            onChange={(v) => setSettings({ company: { contractOperatorSignatureDataUrl: v } })}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[#416B9F]/15 bg-gradient-to-br from-[#416B9F]/8 to-white p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-zinc-900">Modèles de contrat</h3>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          <li className="flex gap-3 rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 shadow-sm">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#416B9F] text-xs font-bold text-white">
              1
            </span>
            <p className="text-[11px] leading-relaxed text-zinc-600">
              Créez un modèle (nom interne + titre affiché au client).
            </p>
          </li>
          <li className="flex gap-3 rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 shadow-sm">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#416B9F] text-xs font-bold text-white">
              2
            </span>
            <p className="text-[11px] leading-relaxed text-zinc-600">
              Listez les <strong className="font-semibold text-zinc-800">justificatifs</strong> demandés au client.
            </p>
          </li>
          <li className="flex gap-3 rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 shadow-sm">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#416B9F] text-xs font-bold text-white">
              3
            </span>
            <p className="text-[11px] leading-relaxed text-zinc-600">
              Rédigez les conditions d’annulation et de location.
            </p>
          </li>
        </ol>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-600">
          <span className="font-semibold text-zinc-900">{stats.total}</span> contrat{stats.total !== 1 ? 's' : ''} ·{' '}
          <span className="font-semibold text-emerald-700">{stats.active}</span> actif{stats.active !== 1 ? 's' : ''}
        </p>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#365b87]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          Nouveau contrat
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
              placeholder="Rechercher…"
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
                  listFilter === f.id ? 'bg-[#416B9F] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80',
                ].join(' ')}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="max-h-[min(28rem,55vh)] space-y-2 overflow-y-auto pr-0.5">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-xs text-zinc-500">
                {contracts.length === 0 ? 'Aucun contrat.' : 'Aucun résultat.'}
              </div>
            ) : (
              filtered.map((c) => {
                const active = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(c.id);
                      setConfirmDeleteId(null);
                    }}
                    className={[
                      'w-full rounded-xl border px-3 py-2.5 text-left transition',
                      active
                        ? 'border-[#416B9F]/50 bg-[#416B9F]/10 ring-1 ring-[#416B9F]/20'
                        : 'border-zinc-200/90 bg-white hover:bg-zinc-50',
                      !c.active ? 'opacity-80' : '',
                    ].join(' ')}
                  >
                    <p className="truncate text-sm font-semibold text-zinc-900">{c.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-500">{c.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <StatusBadge active={c.active} />
                      {c.requiredDocuments.length > 0 ? (
                        <span className="text-[10px] text-zinc-400">
                          {c.requiredDocuments.length} justificatif{c.requiredDocuments.length > 1 ? 's' : ''}
                        </span>
                      ) : null}
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
              <FileText className="h-10 w-10 text-zinc-300" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium text-zinc-700">Aucun contrat sélectionné</p>
              <button
                type="button"
                onClick={handleAdd}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                Créer un contrat
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-2 ring-[#416B9F]/15 ring-offset-2">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 p-4 sm:p-5">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-zinc-900">{selected.name}</h3>
                  <p className="mt-0.5 text-xs text-zinc-500">{selected.title}</p>
                  {selected.active ? (
                    <p className="mt-1.5 text-[11px] text-zinc-500">
                      Modèle utilisé pour les{' '}
                      <span className="font-semibold text-zinc-800">
                        {selected.linkedReservationsCount ?? 0}
                      </span>{' '}
                      contrat{(selected.linkedReservationsCount ?? 0) !== 1 ? 's' : ''} de réservation
                      {(selected.linkedReservationsCount ?? 0) === 0
                        ? ' (les prochaines réservations seront liées à ce modèle actif)'
                        : ''}
                      .
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={previewingId === selected.id}
                    onClick={() => void handlePreviewPdf(selected.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
                  >
                    {previewingId === selected.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Eye className="h-3.5 w-3.5 text-[#416B9F]" aria-hidden />
                    )}
                    Aperçu PDF (brouillon)
                  </button>
                  <RoundCheckbox
                    checked={selected.active}
                    onChange={(v) => updateContract({ ...selected, active: v })}
                    label={selected.active ? 'Contrat utilisable' : 'Contrat archivé'}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                  />
                </div>
              </div>
              {previewError ? (
                <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-800 sm:px-5">{previewError}</p>
              ) : null}

              <div className="flex gap-1 border-b border-zinc-100 px-4 sm:px-5">
                {(
                  [
                    { id: 'general' as const, label: 'Général', Icon: FileText },
                    { id: 'documents' as const, label: 'Justificatifs', Icon: Shield },
                    { id: 'terms' as const, label: 'Conditions', Icon: Scale },
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

              {(selectedNeedsDefaults || selected.active) && (
                <div className="border-b border-zinc-100 bg-amber-50/60 px-4 py-3 sm:px-5">
                  {selectedNeedsDefaults ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-amber-950/90">
                        Ce modèle est vide : chargez le texte standard Bleu Calanque (conditions, CGV et
                        justificatifs) pour alimenter les PDF de réservation.
                      </p>
                      <button
                        type="button"
                        disabled={applyingDefaults}
                        onClick={() => void handleApplyDefaults()}
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#416B9F] px-3 py-2 text-xs font-semibold text-white hover:bg-[#365b87] disabled:opacity-60"
                      >
                        {applyingDefaults ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        Charger le modèle standard
                      </button>
                    </div>
                  ) : selected.active ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-zinc-600">
                        Les réservations utilisent ce modèle pour le PDF et les conditions générales.
                      </p>
                      <button
                        type="button"
                        disabled={applyingDefaults}
                        onClick={() => void handleApplyDefaults()}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                      >
                        {applyingDefaults ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        Réinitialiser au modèle standard
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="p-4 sm:p-5">
                {section === 'general' ? (
                  <div className="space-y-4">
                    <label className="block">
                      <FieldLabel>Nom interne</FieldLabel>
                      <input
                        value={selected.name}
                        onChange={(e) => updateContract({ ...selected, name: e.target.value })}
                        className={inputCls()}
                        placeholder="ex. Contrat location été"
                      />
                      <p className="mt-1 text-[11px] text-zinc-500">Pour vous retrouver dans la liste admin.</p>
                    </label>
                    <label className="block">
                      <FieldLabel>Titre client</FieldLabel>
                      <input
                        value={selected.title}
                        onChange={(e) => updateContract({ ...selected, title: e.target.value })}
                        className={inputCls()}
                        placeholder="ex. Conditions générales de location"
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Description courte</FieldLabel>
                      <textarea
                        value={selected.description}
                        onChange={(e) => updateContract({ ...selected, description: e.target.value })}
                        rows={3}
                        className={`${inputCls()} resize-none`}
                        placeholder="Résumé affiché avant signature ou envoi."
                      />
                    </label>
                  </div>
                ) : null}

                {section === 'documents' ? (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-600">Un justificatif par ligne (pièce d’identité, permis, etc.).</p>
                    <label className="block">
                      <FieldLabel>Liste des justificatifs</FieldLabel>
                      <textarea
                        value={selected.requiredDocuments.join('\n')}
                        onChange={(e) =>
                          updateContract({
                            ...selected,
                            requiredDocuments: e.target.value
                              .split('\n')
                              .map((x) => x.trim())
                              .filter(Boolean),
                          })
                        }
                        rows={8}
                        className={`${inputCls()} resize-none font-mono text-[13px]`}
                        placeholder={"Pièce d'identité\nPermis bateau"}
                      />
                    </label>
                    {selected.requiredDocuments.length > 0 ? (
                      <ul className="flex flex-wrap gap-1.5">
                        {selected.requiredDocuments.map((doc, i) => (
                          <li
                            key={`${doc}-${i}`}
                            className="rounded-lg bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700"
                          >
                            {doc}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] italic text-zinc-400">Aucun justificatif pour l’instant.</p>
                    )}
                  </div>
                ) : null}

                {section === 'terms' ? (
                  <div className="space-y-4">
                    <label className="block">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        <ScrollText className="h-3.5 w-3.5" />
                        Conditions d’annulation
                      </span>
                      <textarea
                        value={selected.cancellationTerms}
                        onChange={(e) => updateContract({ ...selected, cancellationTerms: e.target.value })}
                        rows={6}
                        className={`${inputCls()} resize-y min-h-[8rem]`}
                        placeholder="Délais, frais, cas de force majeure…"
                      />
                    </label>
                    <label className="block">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        <ScrollText className="h-3.5 w-3.5" />
                        Conditions de location
                      </span>
                      <textarea
                        value={selected.rentalTerms}
                        onChange={(e) => updateContract({ ...selected, rentalTerms: e.target.value })}
                        rows={10}
                        className={`${inputCls()} resize-y min-h-[10rem]`}
                        placeholder="Responsabilités, carburant, horaires, caution…"
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-zinc-100 bg-red-50/40 px-4 py-4 sm:px-5">
                {confirmDeleteId === selected.id ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-red-900">
                      Supprimer « {selected.name} » ? Action définitive.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          removeContract(selected.id);
                          setConfirmDeleteId(null);
                        }}
                        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                      >
                        Confirmer
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(selected.id)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-red-700 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                    Supprimer ce contrat
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
