import { useEffect, useMemo, useState } from 'react';
import {
  Anchor,
  FileText,
  Handshake,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
} from 'lucide-react';
import { RoundCheckbox } from '@/components/RoundCheckbox';
import {
  PARTNER_KINDS,
  PARTNER_OFFERING_ORDER,
  PARTNER_OFFERINGS,
  fileToDataUrl,
  partnerInitials,
  partnerKindLabel,
  partnerOfferingsSummary,
} from '@/lib/partnerUi';
import { useSettingsStore, type Partner, type PartnerLinkedOffering } from '@/stores/settings';

type EditorSection = 'identity' | 'offerings' | 'contact';
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

const EMPTY_PARTNER_TEMPLATE = {
  name: '',
  kind: 'other' as const,
  linkedOfferings: ['boat_license'] as PartnerLinkedOffering[],
  description: '',
  logoUrl: '',
  price: '',
  active: true,
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  note: '',
};

export function PartnersSettingsTab() {
  const partners = useSettingsStore((s) => s.partners);
  const addPartner = useSettingsStore((s) => s.addPartner);
  const updatePartner = useSettingsStore((s) => s.updatePartner);
  const removePartner = useSettingsStore((s) => s.removePartner);

  const [selectedId, setSelectedId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [section, setSection] = useState<EditorSection>('identity');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sorted = useMemo(
    () => partners.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [partners],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((p) => {
      if (listFilter === 'active' && !p.active) return false;
      if (listFilter === 'inactive' && p.active) return false;
      if (!q) return true;
      const hay = [p.name, p.price, p.description, partnerOfferingsSummary(p.linkedOfferings)]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sorted, search, listFilter]);

  const selected = useMemo(
    () => partners.find((p) => p.id === selectedId) ?? null,
    [partners, selectedId],
  );

  useEffect(() => {
    if (partners.length === 0) {
      setSelectedId('');
      return;
    }
    if (!selectedId || !partners.some((p) => p.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? sorted[0]?.id ?? '');
    }
  }, [partners, selectedId, filtered, sorted]);

  function handleAdd() {
    const id = addPartner({
      ...EMPTY_PARTNER_TEMPLATE,
      name: 'Nouveau partenaire',
    });
    setSelectedId(id);
    setSection('identity');
    setConfirmDeleteId(null);
  }

  function toggleOffering(p: Partner, offering: PartnerLinkedOffering) {
    const next = new Set(p.linkedOfferings);
    if (next.has(offering)) {
      if (next.size <= 1) return;
      next.delete(offering);
    } else {
      next.add(offering);
    }
    updatePartner({
      ...p,
      linkedOfferings: PARTNER_OFFERING_ORDER.filter((o) => next.has(o)),
    });
  }

  const stats = useMemo(
    () => ({
      total: partners.length,
      active: partners.filter((p) => p.active).length,
    }),
    [partners],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#416B9F]/15 bg-gradient-to-br from-[#416B9F]/8 to-white p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-zinc-900">À quoi servent les partenaires ?</h3>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          <li className="flex gap-3 rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 shadow-sm">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#416B9F] text-xs font-bold text-white">
              1
            </span>
            <p className="text-[11px] leading-relaxed text-zinc-600">
              Référencez écoles, bases ou assureurs avec logo et conditions commerciales.
            </p>
          </li>
          <li className="flex gap-3 rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 shadow-sm">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#416B9F] text-xs font-bold text-white">
              2
            </span>
            <p className="text-[11px] leading-relaxed text-zinc-600">
              Cochez les <strong className="font-semibold text-zinc-800">prestations</strong> concernées (permis, location…).
            </p>
          </li>
          <li className="flex gap-3 rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 shadow-sm">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#416B9F] text-xs font-bold text-white">
              3
            </span>
            <p className="text-[11px] leading-relaxed text-zinc-600">
              Activez ou désactivez l’affichage sans supprimer la fiche.
            </p>
          </li>
        </ol>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-600">
          <span className="font-semibold text-zinc-900">{stats.total}</span> partenaire{stats.total !== 1 ? 's' : ''} ·{' '}
          <span className="font-semibold text-emerald-700">{stats.active}</span> actif{stats.active !== 1 ? 's' : ''}
        </p>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#365b87]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          Nouveau partenaire
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
                  listFilter === f.id
                    ? 'bg-[#416B9F] text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80',
                ].join(' ')}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="max-h-[min(28rem,55vh)] space-y-2 overflow-y-auto pr-0.5">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-xs text-zinc-500">
                {partners.length === 0 ? 'Aucun partenaire.' : 'Aucun résultat pour cette recherche.'}
              </div>
            ) : (
              filtered.map((p) => {
                const active = p.id === selectedId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(p.id);
                      setConfirmDeleteId(null);
                    }}
                    className={[
                      'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                      active
                        ? 'border-[#416B9F]/50 bg-[#416B9F]/10 ring-1 ring-[#416B9F]/20'
                        : 'border-zinc-200/90 bg-white hover:bg-zinc-50',
                      !p.active ? 'opacity-80' : '',
                    ].join(' ')}
                  >
                    <PartnerAvatar name={p.name} logoUrl={p.logoUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-900">{p.name || 'Sans nom'}</p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {partnerKindLabel(p.kind)}
                        {p.price.trim() ? ` · ${p.price.trim()}` : ''}
                      </p>
                    </div>
                    <StatusBadge active={p.active} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-8">
          {!selected ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-16 text-center">
              <Handshake className="h-10 w-10 text-zinc-300" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium text-zinc-700">Aucun partenaire sélectionné</p>
              <p className="mt-1 max-w-sm text-xs text-zinc-500">
                Créez votre premier partenaire pour gérer logos, remises et prestations associées.
              </p>
              <button
                type="button"
                onClick={handleAdd}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                Ajouter un partenaire
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-2 ring-[#416B9F]/15 ring-offset-2">
              <div className="flex flex-wrap items-start gap-4 border-b border-zinc-100 p-4 sm:p-5">
                <PartnerAvatar name={selected.name} logoUrl={selected.logoUrl} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-zinc-900">{selected.name || 'Sans nom'}</h3>
                    <StatusBadge active={selected.active} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{partnerOfferingsSummary(selected.linkedOfferings)}</p>
                </div>
                <RoundCheckbox
                  checked={selected.active}
                  onChange={(v) => updatePartner({ ...selected, active: v })}
                  label={selected.active ? 'Partenaire visible' : 'Partenaire masqué'}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                />
              </div>

              <div className="flex gap-1 border-b border-zinc-100 px-4 sm:px-5">
                {(
                  [
                    { id: 'identity' as const, label: 'Identité', Icon: User },
                    { id: 'offerings' as const, label: 'Prestations', Icon: Anchor },
                    { id: 'contact' as const, label: 'Contact', Icon: Mail },
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

              <div className="p-4 sm:p-5">
                {section === 'identity' ? (
                  <div className="space-y-4">
                    <label className="block">
                      <FieldLabel>Nom du partenaire</FieldLabel>
                      <input
                        value={selected.name}
                        onChange={(e) => updatePartner({ ...selected, name: e.target.value })}
                        className={inputCls()}
                        placeholder="ex. École nautique du port"
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Type</FieldLabel>
                      <select
                        value={selected.kind}
                        onChange={(e) =>
                          updatePartner({ ...selected, kind: e.target.value as Partner['kind'] })
                        }
                        className={inputCls()}
                      >
                        {PARTNER_KINDS.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <FieldLabel>Tarif / avantage partenaire</FieldLabel>
                      <input
                        value={selected.price}
                        onChange={(e) => updatePartner({ ...selected, price: e.target.value })}
                        className={inputCls()}
                        placeholder="ex. -10 % · 50 € de remise · tarif préférentiel"
                      />
                      <p className="mt-1 text-[11px] text-zinc-500">Texte libre affiché côté commercial.</p>
                    </label>
                    <label className="block">
                      <FieldLabel>Logo</FieldLabel>
                      <input
                        type="file"
                        accept="image/*"
                        className={inputCls()}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          void fileToDataUrl(f).then((url) => updatePartner({ ...selected, logoUrl: url }));
                        }}
                      />
                      {selected.logoUrl ? (
                        <button
                          type="button"
                          onClick={() => updatePartner({ ...selected, logoUrl: '' })}
                          className="mt-2 text-[11px] font-semibold text-zinc-500 hover:text-red-600"
                        >
                          Retirer le logo
                        </button>
                      ) : null}
                    </label>
                    <label className="block">
                      <FieldLabel>Description</FieldLabel>
                      <textarea
                        value={selected.description}
                        onChange={(e) => updatePartner({ ...selected, description: e.target.value })}
                        rows={3}
                        className={`${inputCls()} resize-none`}
                        placeholder="Présentation courte pour le site ou usage interne."
                      />
                    </label>
                  </div>
                ) : null}

                {section === 'offerings' ? (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-600">
                      Sélectionnez au moins une prestation. Cliquez pour activer ou retirer.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {PARTNER_OFFERINGS.map((opt) => {
                        const on = selected.linkedOfferings.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => toggleOffering(selected, opt.id)}
                            className={[
                              'rounded-xl border px-3 py-3 text-left transition',
                              on
                                ? 'border-[#416B9F] bg-[#416B9F]/10 ring-1 ring-[#416B9F]/25'
                                : 'border-zinc-200/90 bg-white hover:border-zinc-300',
                            ].join(' ')}
                          >
                            <p className="text-sm font-semibold text-zinc-900">{opt.label}</p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">{opt.hint}</p>
                            {on ? (
                              <span className="mt-2 inline-block text-[10px] font-bold uppercase text-[#416B9F]">
                                Activé
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {section === 'contact' ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <FieldLabel>Interlocuteur</FieldLabel>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <input
                          value={selected.contactName}
                          onChange={(e) => updatePartner({ ...selected, contactName: e.target.value })}
                          className={`${inputCls()} pl-9`}
                          placeholder="Nom du contact"
                        />
                      </div>
                    </label>
                    <label className="block">
                      <FieldLabel>Email</FieldLabel>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <input
                          type="email"
                          value={selected.contactEmail}
                          onChange={(e) => updatePartner({ ...selected, contactEmail: e.target.value })}
                          className={`${inputCls()} pl-9`}
                          placeholder="contact@…"
                        />
                      </div>
                    </label>
                    <label className="block">
                      <FieldLabel>Téléphone</FieldLabel>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <input
                          value={selected.contactPhone}
                          onChange={(e) => updatePartner({ ...selected, contactPhone: e.target.value })}
                          className={`${inputCls()} pl-9`}
                          placeholder="06 …"
                        />
                      </div>
                    </label>
                    <label className="block sm:col-span-2">
                      <FieldLabel>Note interne</FieldLabel>
                      <div className="relative">
                        <FileText className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                        <textarea
                          value={selected.note}
                          onChange={(e) => updatePartner({ ...selected, note: e.target.value })}
                          rows={2}
                          className={`${inputCls()} resize-none pl-9`}
                          placeholder="Non visible client — rappels, conditions particulières…"
                        />
                      </div>
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-zinc-100 bg-red-50/40 px-4 py-4 sm:px-5">
                {confirmDeleteId === selected.id ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-red-900">
                      Supprimer « {selected.name} » ? Cette action est définitive.
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
                          removePartner(selected.id);
                          setConfirmDeleteId(null);
                        }}
                        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                      >
                        Confirmer la suppression
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
                    Supprimer ce partenaire
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

function PartnerAvatar(props: Readonly<{ name: string; logoUrl: string; size: 'sm' | 'lg' }>) {
  const dim = props.size === 'lg' ? 'h-16 w-16 text-lg' : 'h-10 w-10 text-xs';
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200/90 bg-zinc-100 p-1 ${dim}`}
    >
      {props.logoUrl ? (
        <img src={props.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
      ) : (
        <span className="font-bold text-zinc-400">{partnerInitials(props.name)}</span>
      )}
    </div>
  );
}
