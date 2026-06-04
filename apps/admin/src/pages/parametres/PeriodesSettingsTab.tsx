import { useEffect, useMemo, useState } from 'react';
import { Anchor, Layers, Ship, Sun } from 'lucide-react';
import {
  PRICING_MONTH_LABELS,
  PRICING_SEASON_CODES,
  PRICING_SEASON_THEME,
  PRICING_SEASON_UI,
  resolvePricingSeasonCode,
  type PricingSeasonCode,
} from '@/lib/pricingSeasons';
import { useBoatPricingStore, type BoatPriceRow, type FleetPriceRow } from '@/stores/boatPricing';
import { useBoatsStore } from '@/stores/boats';

type PriceKey = 'demiJournee' | 'journee' | 'semaine';
type PricingSubview = 'fleets' | 'boats';

const PRICE_COLUMNS: { key: PriceKey; label: string; short: string }[] = [
  { key: 'demiJournee', label: 'Demi-journée', short: '½ j' },
  { key: 'journee', label: 'Journée', short: 'J' },
  { key: 'semaine', label: 'Semaine', short: 'Sem.' },
];

function inputCompact() {
  return 'w-full min-w-[4.5rem] rounded-lg border border-zinc-200/90 bg-white py-1.5 pl-2.5 pr-7 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15';
}

function parseEuro(raw: string): number | null {
  const v = raw.trim() === '' ? null : Number(raw.replace(',', '.'));
  return v !== null && Number.isFinite(v) ? v : null;
}

function countFilled(row: { demiJournee: number | null; journee: number | null; semaine: number | null }) {
  return [row.demiJournee, row.journee, row.semaine].filter((v) => v != null && Number.isFinite(v)).length;
}

function EuroInput(props: Readonly<{
  value: number | null | undefined;
  placeholder?: string;
  onChange: (raw: string) => void;
}>) {
  return (
    <div className="relative">
      <input
        inputMode="decimal"
        value={props.value ?? ''}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder ?? '—'}
        className={inputCompact()}
        title={props.placeholder}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-zinc-400">
        €
      </span>
    </div>
  );
}

export function PeriodesSettingsTab() {
  const boats = useBoatsStore((s) => s.boats);
  const fleets = useBoatsStore((s) => s.fleets);
  const boatsHydrated = useBoatsStore((s) => s.hydrated);
  const refreshBoats = useBoatsStore((s) => s.refresh);
  const setBoatDepositEuros = useBoatsStore((s) => s.setBoatDepositEuros);

  const pricingPeriods = useBoatPricingStore((s) => s.periods);
  const pricesByPeriodId = useBoatPricingStore((s) => s.pricesByPeriodId);
  const fleetPricesByPeriodId = useBoatPricingStore((s) => s.fleetPricesByPeriodId);
  const pricingHydrated = useBoatPricingStore((s) => s.hydrated);
  const refreshPricing = useBoatPricingStore((s) => s.refresh);
  const setBoatPrice = useBoatPricingStore((s) => s.setBoatPrice);
  const setFleetPrice = useBoatPricingStore((s) => s.setFleetPrice);

  const [season, setSeason] = useState<PricingSeasonCode>('MOYENNE');
  const [subview, setSubview] = useState<PricingSubview>('fleets');

  useEffect(() => {
    if (!boatsHydrated) void refreshBoats();
  }, [boatsHydrated, refreshBoats]);
  useEffect(() => {
    if (!pricingHydrated) void refreshPricing();
  }, [pricingHydrated, refreshPricing]);

  useEffect(() => {
    if (!pricingHydrated) return;
    const hasCurrent = pricingPeriods.some((p) => p.code === season);
    if (hasCurrent) return;
    const first = PRICING_SEASON_CODES.find((c) => pricingPeriods.some((p) => p.code === c));
    if (first) setSeason(first);
  }, [pricingHydrated, pricingPeriods, season]);

  const period = useMemo(
    () => pricingPeriods.find((p) => p.code === season) ?? null,
    [pricingPeriods, season],
  );

  const fleetRows = period ? (fleetPricesByPeriodId[period.id]?.rows ?? []) : [];
  const boatRows = period ? (pricesByPeriodId[period.id]?.rows ?? []) : [];
  const byFleetId = useMemo(() => new Map(fleetRows.map((r) => [r.fleetId, r])), [fleetRows]);
  const byBoatId = useMemo(() => new Map(boatRows.map((r) => [r.boatId, r])), [boatRows]);

  const seasonStats = useMemo(() => {
    const out: Record<PricingSeasonCode, { fleets: number; boats: number; total: number }> = {
      BASSE: { fleets: 0, boats: 0, total: 0 },
      MOYENNE: { fleets: 0, boats: 0, total: 0 },
      HAUTE: { fleets: 0, boats: 0, total: 0 },
    };
    for (const code of PRICING_SEASON_CODES) {
      const p = pricingPeriods.find((x) => x.code === code);
      if (!p) continue;
      const fr = fleetPricesByPeriodId[p.id]?.rows ?? [];
      const br = pricesByPeriodId[p.id]?.rows ?? [];
      for (const f of fleets) {
        const row = fr.find((r) => r.fleetId === f.id) ?? { demiJournee: null, journee: null, semaine: null };
        out[code].fleets += countFilled(row);
      }
      for (const b of boats) {
        const row = br.find((r) => r.boatId === b.id) ?? { demiJournee: null, journee: null, semaine: null };
        out[code].boats += countFilled(row);
      }
      out[code].total = out[code].fleets + out[code].boats;
    }
    return out;
  }, [pricingPeriods, fleetPricesByPeriodId, pricesByPeriodId, fleets, boats]);

  const sortedFleets = useMemo(() => fleets.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr')), [fleets]);
  const sortedBoats = useMemo(() => boats.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr')), [boats]);

  const fleetNameById = useMemo(() => new Map(fleets.map((f) => [f.id, f.name])), [fleets]);

  if (!pricingHydrated) {
    return <p className="text-sm text-zinc-500">Chargement des tarifs…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#416B9F]/15 bg-gradient-to-br from-[#416B9F]/8 to-white p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-zinc-900">Comment ça fonctionne</h3>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          <li className="flex gap-3 rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 shadow-sm">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#416B9F] text-xs font-bold text-white">
              1
            </span>
            <div>
              <p className="text-xs font-semibold text-zinc-900">Saison calendaire</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-600">
                Le calendrier applique automatiquement basse, moyenne ou haute selon le mois de départ.
              </p>
            </div>
          </li>
          <li className="flex gap-3 rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 shadow-sm">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#416B9F] text-xs font-bold text-white">
              2
            </span>
            <div>
              <p className="text-xs font-semibold text-zinc-900">Tarif flotille</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-600">
                Prix par défaut pour tous les bateaux d’une même catégorie (ex. catamaran).
              </p>
            </div>
          </li>
          <li className="flex gap-3 rounded-xl border border-white/80 bg-white/70 px-3 py-2.5 shadow-sm">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#416B9F] text-xs font-bold text-white">
              3
            </span>
            <div>
              <p className="text-xs font-semibold text-zinc-900">Exception bateau</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-600">
                Un montant saisi sur un bateau remplace celui de sa flotille pour cette saison.
              </p>
            </div>
          </li>
        </ol>
      </div>

      <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Calendrier des saisons</p>
          <p className="text-[11px] text-zinc-500">Cliquez un mois pour ouvrir la saison correspondante</p>
        </div>
        <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-12">
          {PRICING_MONTH_LABELS.map((label, idx) => {
            const code = resolvePricingSeasonCode(idx);
            const theme = PRICING_SEASON_THEME[code];
            const active = season === code;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setSeason(code)}
                className={[
                  'rounded-lg border px-1 py-2 text-center text-[11px] font-semibold transition',
                  active ? theme.monthActive : theme.month,
                ].join(' ')}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-zinc-600">
          {PRICING_SEASON_CODES.map((code) => (
            <span key={code} className="inline-flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${PRICING_SEASON_THEME[code].dot}`} />
              {PRICING_SEASON_UI[code].shortLabel} — {PRICING_SEASON_UI[code].monthsHint}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRICING_SEASON_CODES.map((code) => {
          const ui = PRICING_SEASON_UI[code];
          const theme = PRICING_SEASON_THEME[code];
          const active = season === code;
          const exists = pricingPeriods.some((p) => p.code === code);
          const stat = seasonStats[code];
          const maxSlots = (fleets.length + boats.length) * 3;
          const pct = maxSlots > 0 ? Math.round((stat.total / maxSlots) * 100) : 0;
          return (
            <button
              key={code}
              type="button"
              onClick={() => setSeason(code)}
              className={[
                'min-w-[7.5rem] flex-1 rounded-2xl border px-4 py-3 text-left transition sm:max-w-[12rem]',
                active ? theme.pillActive : theme.pill,
                !exists ? 'opacity-60' : '',
              ].join(' ')}
            >
              <p className="text-sm font-semibold">{ui.shortLabel}</p>
              <p className={`mt-0.5 text-[11px] ${active ? 'text-white/85' : 'text-zinc-600'}`}>{ui.monthsHint}</p>
              {exists ? (
                <p className={`mt-2 text-[10px] font-medium ${active ? 'text-white/75' : 'text-zinc-500'}`}>
                  {pct}% renseigné
                </p>
              ) : (
                <p className="mt-2 text-[10px] font-semibold text-amber-800">API / migration requise</p>
              )}
            </button>
          );
        })}
      </div>

      {!period ? (
        <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 px-4 py-10 text-center text-sm text-amber-900">
          Saison « {PRICING_SEASON_UI[season].title} » introuvable. Vérifiez que l’API tourne et que les migrations Prisma
          ont créé les 3 périodes.
        </div>
      ) : (
        <div className={`rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-2 ring-offset-2 ${PRICING_SEASON_THEME[season].ring}`}>
          <div className="border-b border-zinc-100 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-zinc-900">{PRICING_SEASON_UI[season].title}</p>
                <p className="mt-1 text-sm text-zinc-600">{PRICING_SEASON_UI[season].subtitle}</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600">
                <Sun className="h-3.5 w-3.5" strokeWidth={2} />
                {PRICING_SEASON_UI[season].monthsHint}
              </span>
            </div>
          </div>

          <div className="flex gap-1 border-b border-zinc-100 px-4 sm:px-5">
            <button
              type="button"
              onClick={() => setSubview('fleets')}
              className={[
                'inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition',
                subview === 'fleets'
                  ? 'border-[#416B9F] text-[#416B9F]'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800',
              ].join(' ')}
            >
              <Layers className="h-3.5 w-3.5" />
              Flotilles
              {fleets.length > 0 ? (
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">{fleets.length}</span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setSubview('boats')}
              className={[
                'inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition',
                subview === 'boats'
                  ? 'border-[#416B9F] text-[#416B9F]'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800',
              ].join(' ')}
            >
              <Ship className="h-3.5 w-3.5" />
              Bateaux
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">{boats.length}</span>
            </button>
          </div>

          <div className="p-4 sm:p-5">
            {subview === 'fleets' ? (
              fleets.length === 0 ? (
                <p className="text-sm text-zinc-500">Aucune flotille. Créez des flotilles dans le catalogue bateaux.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-200/90">
                  <table className="w-full min-w-[520px] text-left">
                    <thead>
                      <tr className="bg-zinc-50/90">
                        <th className="px-3 py-2.5 text-xs font-semibold text-zinc-500">Flotille</th>
                        {PRICE_COLUMNS.map((col) => (
                          <th key={col.key} className="px-2 py-2.5 text-xs font-semibold text-zinc-500">
                            <span className="hidden sm:inline">{col.label}</span>
                            <span className="sm:hidden">{col.short}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFleets.map((f) => (
                        <FleetPriceRowEditor
                          key={f.id}
                          fleetName={f.name}
                          row={
                            byFleetId.get(f.id) ?? {
                              fleetId: f.id,
                              demiJournee: null,
                              journee: null,
                              semaine: null,
                            }
                          }
                          onSet={(k, raw) => {
                            const v = parseEuro(raw);
                            setFleetPrice(period.id, f.id, { [k]: v } as Partial<FleetPriceRow>);
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-200/90">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="bg-zinc-50/90">
                      <th className="px-3 py-2.5 text-xs font-semibold text-zinc-500">Bateau</th>
                      {PRICE_COLUMNS.map((col) => (
                        <th key={col.key} className="px-2 py-2.5 text-xs font-semibold text-zinc-500">
                          <span className="hidden sm:inline">{col.label}</span>
                          <span className="sm:hidden">{col.short}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBoats.map((b) => {
                      const row = byBoatId.get(b.id) ?? {
                        boatId: b.id,
                        demiJournee: null,
                        journee: null,
                        semaine: null,
                      };
                      const fleetRow = b.fleetId ? byFleetId.get(b.fleetId) : undefined;
                      const fleetLabel = b.fleetId ? fleetNameById.get(b.fleetId) : null;
                      return (
                        <BoatPriceRowEditor
                          key={b.id}
                          boatName={b.name}
                          boatMeta={`${b.brand} · ${b.model}`}
                          fleetLabel={fleetLabel ?? null}
                          row={row}
                          fleetRow={fleetRow}
                          onSet={(k, raw) => {
                            const v = parseEuro(raw);
                            setBoatPrice(period.id, b.id, { [k]: v } as Partial<BoatPriceRow>);
                          }}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
              {subview === 'fleets'
                ? 'Ces montants s’appliquent à tous les bateaux de la flotille, sauf exception saisie dans l’onglet Bateaux.'
                : 'Champ vide = tarif de la flotille (indiqué en italique sous le champ). Saisie = prix spécifique à ce bateau.'}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2">
          <Anchor className="h-4 w-4 text-zinc-500" strokeWidth={2} />
          <h3 className="text-sm font-semibold text-zinc-900">Cautions par bateau</h3>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          Montant d’empreinte bancaire (identique toute l’année, toutes saisons). Modifiez puis cliquez hors du champ pour
          enregistrer. Défaut : 2 500&nbsp;€.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200/90">
          <table className="w-full min-w-[400px]">
            <thead>
              <tr className="bg-zinc-50/90">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500">Bateau</th>
                <th className="w-36 px-3 py-2.5 text-left text-xs font-semibold text-zinc-500">Caution</th>
              </tr>
            </thead>
            <tbody>
              {sortedBoats.map((b) => (
                <tr key={b.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2">
                    <p className="text-sm font-medium text-zinc-900">{b.name}</p>
                    <p className="text-[11px] text-zinc-500">{b.brand}</p>
                  </td>
                  <td className="px-3 py-2">
                    <DepositEuroInput
                      boatId={b.id}
                      euros={b.depositEuros ?? 2500}
                      onSave={setBoatDepositEuros}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FleetPriceRowEditor(props: Readonly<{
  fleetName: string;
  row: FleetPriceRow;
  onSet: (k: PriceKey, raw: string) => void;
}>) {
  const filled = countFilled(props.row);
  return (
    <tr className="border-t border-zinc-100">
      <td className="px-3 py-2">
        <p className="text-sm font-medium text-zinc-900">{props.fleetName}</p>
        <p className="text-[10px] text-zinc-400">{filled}/3 tarifs</p>
      </td>
      {PRICE_COLUMNS.map((col) => (
        <td key={col.key} className="px-2 py-2">
          <EuroInput value={props.row[col.key]} onChange={(raw) => props.onSet(col.key, raw)} />
        </td>
      ))}
    </tr>
  );
}

function DepositEuroInput(props: Readonly<{
  boatId: string;
  euros: number;
  onSave: (id: string, euros: number) => void;
}>) {
  const [draft, setDraft] = useState(String(props.euros));
  useEffect(() => {
    setDraft(String(props.euros));
  }, [props.boatId, props.euros]);

  return (
    <div className="relative">
      <input
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const v = draft.trim() === '' ? 2500 : Number(draft.replace(',', '.'));
          if (!Number.isFinite(v) || v < 0) {
            setDraft(String(props.euros));
            return;
          }
          props.onSave(props.boatId, v);
        }}
        className={inputCompact()}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-zinc-400">
        €
      </span>
    </div>
  );
}

function BoatPriceRowEditor(props: Readonly<{
  boatName: string;
  boatMeta: string;
  fleetLabel: string | null;
  row: BoatPriceRow;
  fleetRow?: FleetPriceRow;
  onSet: (k: PriceKey, raw: string) => void;
}>) {
  const hasOverride = countFilled(props.row) > 0;
  return (
    <tr className={`border-t border-zinc-100 ${hasOverride ? 'bg-[#416B9F]/[0.03]' : ''}`}>
      <td className="px-3 py-2">
        <p className="text-sm font-medium text-zinc-900">{props.boatName}</p>
        <p className="text-[11px] text-zinc-500">
          {props.boatMeta}
          {props.fleetLabel ? ` · ${props.fleetLabel}` : ''}
        </p>
        {hasOverride ? (
          <span className="mt-0.5 inline-block text-[10px] font-semibold text-[#416B9F]">Prix spécifique</span>
        ) : null}
      </td>
      {PRICE_COLUMNS.map((col) => {
        const inherited = props.row[col.key] == null ? props.fleetRow?.[col.key] : null;
        const ph = inherited != null ? String(inherited) : undefined;
        return (
          <td key={col.key} className="px-2 py-2">
            <EuroInput
              value={props.row[col.key]}
              placeholder={ph}
              onChange={(raw) => props.onSet(col.key, raw)}
            />
            {inherited != null && props.row[col.key] == null ? (
              <p className="mt-0.5 text-[10px] italic text-zinc-400">flotille {inherited} €</p>
            ) : null}
          </td>
        );
      })}
    </tr>
  );
}
