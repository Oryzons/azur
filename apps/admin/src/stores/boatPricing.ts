import { create } from 'zustand';
import { api } from '@/lib/api';

export type PricingUnit = 'demi_journee' | 'journee' | 'semaine';

export type BoatPricingPeriod = {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  active: boolean;
  createdAt: string;
  /** BASSE | MOYENNE | HAUTE pour les saisons fixes. */
  code: string | null;
};

export type BoatPriceRow = {
  boatId: string;
  demiJournee: number | null;
  journee: number | null;
  semaine: number | null;
};

export type FleetPriceRow = {
  fleetId: string;
  demiJournee: number | null;
  journee: number | null;
  semaine: number | null;
};

export type PeriodPrices = {
  periodId: string;
  rows: BoatPriceRow[];
  updatedAt: string;
};

export type FleetPeriodPrices = {
  periodId: string;
  rows: FleetPriceRow[];
  updatedAt: string;
};

type BoatPricingState = {
  periods: BoatPricingPeriod[];
  pricesByPeriodId: Record<string, PeriodPrices>;
  fleetPricesByPeriodId: Record<string, FleetPeriodPrices>;
  hydrated: boolean;
  refresh: () => Promise<void>;

  addPeriod: (p: Omit<BoatPricingPeriod, 'id' | 'createdAt'>) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  updatePeriod: (p: Omit<BoatPricingPeriod, 'createdAt'>) => Promise<{ ok: true } | { ok: false; error: string }>;
  removePeriod: (id: string) => void;

  setBoatPrice: (
    periodId: string,
    boatId: string,
    patch: Partial<Pick<BoatPriceRow, 'demiJournee' | 'journee' | 'semaine'>>,
  ) => void;

  setFleetPrice: (
    periodId: string,
    fleetId: string,
    patch: Partial<Pick<FleetPriceRow, 'demiJournee' | 'journee' | 'semaine'>>,
  ) => void;
};

function tmpIdNow() {
  return `tmp_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

function extractApiError(e: any, fallback: string): string {
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(' ') || fallback;
  if (typeof msg === 'string') return msg;
  return fallback;
}

function periodFromApi(x: any): BoatPricingPeriod {
  return {
    id: String(x?.id ?? ''),
    name: String(x?.name ?? ''),
    startDate: x?.startDate ? new Date(x.startDate).toISOString().slice(0, 10) : '',
    endDate: x?.endDate ? new Date(x.endDate).toISOString().slice(0, 10) : '',
    active: Boolean(x?.active ?? true),
    createdAt: x?.createdAt ? new Date(x.createdAt).toISOString() : new Date().toISOString(),
    code: typeof x?.code === 'string' && x.code ? String(x.code) : null,
  };
}

function periodToApi(p: Omit<BoatPricingPeriod, 'id' | 'createdAt'> | BoatPricingPeriod) {
  return { name: p.name, startDate: p.startDate, endDate: p.endDate, active: p.active };
}

function priceUnitToApi(u: keyof Omit<BoatPriceRow, 'boatId'>): 'DEMI_JOURNEE' | 'JOURNEE' | 'SEMAINE' {
  if (u === 'demiJournee') return 'DEMI_JOURNEE';
  if (u === 'journee') return 'JOURNEE';
  return 'SEMAINE';
}

function fromCents(v: number | null | undefined): number | null {
  if (v == null) return null;
  return Math.round(Number(v)) / 100;
}
function toCents(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(Number(v))) return null;
  return Math.round(Number(v) * 100);
}

export const useBoatPricingStore = create<BoatPricingState>()((set, get) => ({
  periods: [],
  pricesByPeriodId: {},
  fleetPricesByPeriodId: {},
  hydrated: false,

  refresh: async () => {
    const [pRes, prRes, frRes] = await Promise.all([
      api.get('/pricing-periods'),
      api.get('/boat-prices'),
      api.get('/fleet-prices'),
    ]);
    const periods: BoatPricingPeriod[] = (Array.isArray(pRes.data) ? pRes.data : []).map(periodFromApi);
    const map: Record<string, PeriodPrices> = {};
    const fleetMap: Record<string, FleetPeriodPrices> = {};
    for (const p of periods) {
      map[p.id] = { periodId: p.id, rows: [], updatedAt: new Date().toISOString() };
      fleetMap[p.id] = { periodId: p.id, rows: [], updatedAt: new Date().toISOString() };
    }
    const list: any[] = Array.isArray(prRes.data) ? prRes.data : [];
    for (const it of list) {
      const periodId = String(it?.periodId ?? '');
      if (!map[periodId]) map[periodId] = { periodId, rows: [], updatedAt: new Date().toISOString() };
      const boatId = String(it?.boatId ?? '');
      let row = map[periodId].rows.find((r) => r.boatId === boatId);
      if (!row) {
        row = { boatId, demiJournee: null, journee: null, semaine: null };
        map[periodId].rows.push(row);
      }
      const amount = fromCents(it?.amountCents);
      if (it?.unit === 'DEMI_JOURNEE') row.demiJournee = amount;
      else if (it?.unit === 'JOURNEE') row.journee = amount;
      else if (it?.unit === 'SEMAINE') row.semaine = amount;
    }
    const fleetList: any[] = Array.isArray(frRes.data) ? frRes.data : [];
    for (const it of fleetList) {
      const periodId = String(it?.periodId ?? '');
      if (!fleetMap[periodId]) fleetMap[periodId] = { periodId, rows: [], updatedAt: new Date().toISOString() };
      const fleetId = String(it?.fleetId ?? '');
      let row = fleetMap[periodId].rows.find((r) => r.fleetId === fleetId);
      if (!row) {
        row = { fleetId, demiJournee: null, journee: null, semaine: null };
        fleetMap[periodId].rows.push(row);
      }
      const amount = fromCents(it?.amountCents);
      if (it?.unit === 'DEMI_JOURNEE') row.demiJournee = amount;
      else if (it?.unit === 'JOURNEE') row.journee = amount;
      else if (it?.unit === 'SEMAINE') row.semaine = amount;
    }
    set({ periods, pricesByPeriodId: map, fleetPricesByPeriodId: fleetMap, hydrated: true });
  },

  addPeriod: async (p) => {
    const name = p.name.trim();
    if (!name) return { ok: false, error: 'Nom de période requis.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.startDate)) return { ok: false, error: 'Date de début invalide.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.endDate)) return { ok: false, error: 'Date de fin invalide.' };
    if (new Date(p.startDate).getTime() > new Date(p.endDate).getTime()) return { ok: false, error: 'Fin doit être après début.' };

    const tmpId = tmpIdNow();
    const optimistic: BoatPricingPeriod = { ...p, name, id: tmpId, createdAt: new Date().toISOString(), code: null };
    set((s) => ({
      periods: [...s.periods, optimistic],
      pricesByPeriodId: {
        ...s.pricesByPeriodId,
        [tmpId]: { periodId: tmpId, rows: [], updatedAt: new Date().toISOString() },
      },
      fleetPricesByPeriodId: {
        ...s.fleetPricesByPeriodId,
        [tmpId]: { periodId: tmpId, rows: [], updatedAt: new Date().toISOString() },
      },
    }));

    try {
      const { data } = await api.post('/pricing-periods', periodToApi({ ...p, name }));
      const real = periodFromApi(data);
      set((s) => {
        const next = { ...s.pricesByPeriodId };
        next[real.id] = next[tmpId] ?? { periodId: real.id, rows: [], updatedAt: new Date().toISOString() };
        delete next[tmpId];
        const nextF = { ...s.fleetPricesByPeriodId };
        nextF[real.id] = nextF[tmpId] ?? { periodId: real.id, rows: [], updatedAt: new Date().toISOString() };
        delete nextF[tmpId];
        return {
          periods: s.periods.map((x) => (x.id === tmpId ? real : x)),
          pricesByPeriodId: next,
          fleetPricesByPeriodId: nextF,
        };
      });
      return { ok: true, id: real.id };
    } catch (e) {
      set((s) => {
        const next = { ...s.pricesByPeriodId };
        delete next[tmpId];
        const nextF = { ...s.fleetPricesByPeriodId };
        delete nextF[tmpId];
        return { periods: s.periods.filter((x) => x.id !== tmpId), pricesByPeriodId: next, fleetPricesByPeriodId: nextF };
      });
      return { ok: false, error: extractApiError(e, 'Impossible de créer la période.') };
    }
  },

  updatePeriod: async (p) => {
    const prev = get().periods.find((x) => x.id === p.id);
    if (!prev) return { ok: false, error: 'Période introuvable.' };
    const name = p.name.trim();
    if (!name) return { ok: false, error: 'Nom de période requis.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.startDate)) return { ok: false, error: 'Date de début invalide.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.endDate)) return { ok: false, error: 'Date de fin invalide.' };
    if (new Date(p.startDate).getTime() > new Date(p.endDate).getTime()) return { ok: false, error: 'Fin doit être après début.' };

    set((s) => ({
      periods: s.periods.map((x) => (x.id === p.id ? { ...x, ...p, name } : x)),
    }));
    try {
      await api.patch(`/pricing-periods/${p.id}`, periodToApi({ ...p, name }));
      return { ok: true };
    } catch (e) {
      void get().refresh();
      return { ok: false, error: extractApiError(e, 'Impossible de modifier la période.') };
    }
  },

  removePeriod: (id) => {
    set((s) => {
      const next = { ...s.pricesByPeriodId };
      delete next[id];
      const nextF = { ...s.fleetPricesByPeriodId };
      delete nextF[id];
      return { periods: s.periods.filter((p) => p.id !== id), pricesByPeriodId: next, fleetPricesByPeriodId: nextF };
    });
    void api.delete(`/pricing-periods/${id}`).catch(() => {
      void get().refresh();
    });
  },

  setBoatPrice: (periodId, boatId, patch) => {
    set((s) => {
      const cur = s.pricesByPeriodId[periodId] ?? { periodId, rows: [], updatedAt: new Date().toISOString() };
      const rows = [...cur.rows];
      const idx = rows.findIndex((r) => r.boatId === boatId);
      if (idx === -1) {
        rows.push({
          boatId,
          demiJournee: patch.demiJournee ?? null,
          journee: patch.journee ?? null,
          semaine: patch.semaine ?? null,
        });
      } else {
        rows[idx] = { ...rows[idx], ...patch };
      }
      return {
        pricesByPeriodId: {
          ...s.pricesByPeriodId,
          [periodId]: { periodId, rows, updatedAt: new Date().toISOString() },
        },
      };
    });

    // Persistance API par valeur modifiée
    const keys = Object.keys(patch) as Array<keyof typeof patch>;
    for (const k of keys) {
      const value = patch[k];
      const unit = priceUnitToApi(k);
      if (value == null) {
        void api.delete(`/pricing-periods/${periodId}/prices/${boatId}/${unit}`).catch(() => {
          void get().refresh();
        });
      } else {
        const cents = toCents(value);
        if (cents == null) continue;
        void api.post(`/pricing-periods/${periodId}/prices`, { boatId, unit, amountCents: cents }).catch(() => {
          void get().refresh();
        });
      }
    }
  },

  setFleetPrice: (periodId, fleetId, patch) => {
    set((s) => {
      const cur = s.fleetPricesByPeriodId[periodId] ?? { periodId, rows: [], updatedAt: new Date().toISOString() };
      const rows = [...cur.rows];
      const idx = rows.findIndex((r) => r.fleetId === fleetId);
      if (idx === -1) {
        rows.push({
          fleetId,
          demiJournee: patch.demiJournee ?? null,
          journee: patch.journee ?? null,
          semaine: patch.semaine ?? null,
        });
      } else {
        rows[idx] = { ...rows[idx], ...patch };
      }
      return {
        fleetPricesByPeriodId: {
          ...s.fleetPricesByPeriodId,
          [periodId]: { periodId, rows, updatedAt: new Date().toISOString() },
        },
      };
    });

    const keys = Object.keys(patch) as Array<keyof typeof patch>;
    for (const k of keys) {
      const value = patch[k];
      const unit = priceUnitToApi(k);
      if (value == null) {
        void api.delete(`/pricing-periods/${periodId}/fleet-prices/${fleetId}/${unit}`).catch(() => {
          void get().refresh();
        });
      } else {
        const cents = toCents(value);
        if (cents == null) continue;
        void api.post(`/pricing-periods/${periodId}/fleet-prices`, { fleetId, unit, amountCents: cents }).catch(() => {
          void get().refresh();
        });
      }
    }
  },
}));

export function defaultNewPeriod() {
  const y = new Date().getFullYear();
  return {
    name: 'Nouvelle période',
    startDate: `${y}-01-01`,
    endDate: `${y}-12-31`,
    active: true,
  } as const;
}
