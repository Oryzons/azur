import { create } from 'zustand';
import { api } from '@/lib/api';

export type ExtraPriceKind = 'percent' | 'euro';
export type ExtraBillingUnit = 'location' | 'jour' | 'semaine';
export type ExtraPaymentChannel = 'online' | 'offline';

export type Extra = {
  id: string;
  name: string;
  description: string;
  priceKind: ExtraPriceKind;
  /** percent: 0–100 ; euro: montant > 0 */
  priceValue: number;
  billingUnit: ExtraBillingUnit;
  /** Taux de TVA (%) ex: 20 */
  vatRate: number;
  /** null = stock illimité ; sinon plafond par jour civil */
  stock: number | null;
  /** Canal de paiement proposé (par défaut: en ligne). */
  paymentChannel: ExtraPaymentChannel;
  /** Clé d'icône (lucide) affichée sur le calendrier. */
  icon: string | null;
  enabled: boolean;
  createdAt: string;
};

export type AddExtraPayload = Omit<Extra, 'id' | 'createdAt'>;
export type UpdateExtraPayload = Omit<Extra, 'createdAt'>;

export function billingUnitLabel(u: ExtraBillingUnit) {
  if (u === 'location') return 'par location';
  if (u === 'jour') return 'par jour';
  return 'par semaine';
}

export function formatExtraPriceLine(ex: Pick<Extra, 'priceKind' | 'priceValue' | 'billingUnit'>) {
  if (ex.priceKind === 'percent') return `${ex.priceValue} % · ${billingUnitLabel(ex.billingUnit)}`;
  const v = ex.priceValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v} € · ${billingUnitLabel(ex.billingUnit)}`;
}

interface ExtrasState {
  extras: Extra[];
  hydrated: boolean;
  refresh: () => Promise<void>;
  addExtra: (e: AddExtraPayload) => { ok: true; id: string } | { ok: false; error: string };
  updateExtra: (e: UpdateExtraPayload) => Promise<{ ok: true } | { ok: false; error: string }>;
  removeExtra: (id: string) => void;
}

export const useExtrasStore = create<ExtrasState>()(
  (set, get) => ({
    extras: [],
    hydrated: false,

    refresh: async () => {
      try {
        const { data } = await api.get('/extras');
        const extras: Extra[] = (Array.isArray(data) ? data : []).map(mapExtraFromApi);
        set({ extras, hydrated: true });
      } catch {
        set({ hydrated: true });
      }
    },

    addExtra: (e: AddExtraPayload) => {
        const name = e.name.trim();
        if (!name) return { ok: false, error: 'Le nom est requis.' };

        const vat = Number(e.vatRate);
        if (!Number.isFinite(vat) || vat < 0 || vat > 100) return { ok: false, error: 'TVA : valeur entre 0 et 100.' };

        const price = Number(e.priceValue);
        if (!Number.isFinite(price) || price < 0) return { ok: false, error: 'Tarif invalide.' };
        if (e.priceKind === 'euro' && price === 0) return { ok: false, error: 'Tarif : montant > 0.' };

        const stock = e.stock === null ? null : Math.floor(Number(e.stock));
        if (stock !== null && (!Number.isFinite(stock) || stock < 0)) return { ok: false, error: 'Stock : nombre positif ou vide.' };

        const id = tmpIdNow();
        const createdAt = new Date().toISOString();
        set((s) => ({
          extras: [
            ...s.extras,
            {
              id,
              createdAt,
              ...e,
              name,
              description: e.description.trim(),
              priceValue: price,
              vatRate: vat,
              stock,
              paymentChannel: e.paymentChannel ?? 'online',
              icon: e.icon ?? null,
            },
          ],
        }));
        void createExtraApi(
          id,
          {
            name,
            description: e.description.trim(),
            priceKind: e.priceKind,
            priceValue: price,
            billingUnit: e.billingUnit,
            vatRate: vat,
            stock,
            paymentChannel: e.paymentChannel ?? 'online',
            icon: e.icon ?? null,
            enabled: e.enabled,
          },
          set,
        );
        return { ok: true, id };
      },

    updateExtra: async (e: UpdateExtraPayload) => {
        const prev = get().extras.find((x) => x.id === e.id);
        if (!prev) return { ok: false, error: 'Extra introuvable.' };

        const name = e.name.trim();
        if (!name) return { ok: false, error: 'Le nom est requis.' };
        const exists = get().extras.some((x) => x.id !== e.id && x.name.toLowerCase() === name.toLowerCase());
        if (exists) return { ok: false, error: 'Un extra avec ce nom existe déjà.' };

        const vat = Number(e.vatRate);
        if (!Number.isFinite(vat) || vat < 0 || vat > 100) return { ok: false, error: 'TVA : valeur entre 0 et 100.' };

        const price = Number(e.priceValue);
        if (!Number.isFinite(price) || price < 0) return { ok: false, error: 'Tarif invalide.' };
        if (e.priceKind === 'euro' && price === 0) return { ok: false, error: 'Tarif : montant > 0.' };

        const stock = e.stock === null ? null : Math.floor(Number(e.stock));
        if (stock !== null && (!Number.isFinite(stock) || stock < 0)) return { ok: false, error: 'Stock : nombre positif ou vide.' };

        const payload = extraToApiPayload({
          ...e,
          name,
          description: e.description.trim(),
          priceValue: price,
          vatRate: vat,
          stock,
          paymentChannel: e.paymentChannel ?? 'online',
          icon: e.icon ?? null,
          enabled: e.enabled,
        });

        const optimistic: Extra = {
          ...prev,
          ...e,
          name,
          description: e.description.trim(),
          priceValue: price,
          vatRate: vat,
          stock,
          paymentChannel: e.paymentChannel ?? 'online',
          icon: e.icon ?? null,
        };

        set((s) => ({
          extras: s.extras.map((x) => (x.id === e.id ? optimistic : x)),
        }));

        if (!isPersistedExtraId(e.id)) {
          return { ok: true };
        }

        try {
          const { data } = await api.put(`/extras/${e.id}`, payload);
          const real = mapExtraFromApi(data);
          set((s) => ({
            extras: s.extras.map((x) => (x.id === e.id ? real : x)),
          }));
          return { ok: true };
        } catch (err: unknown) {
          set((s) => ({
            extras: s.extras.map((x) => (x.id === e.id ? prev : x)),
          }));
          return { ok: false, error: extractExtraApiError(err, 'Impossible de modifier l’extra.') };
        }
      },

    removeExtra: (id: string) => {
      set((s) => ({ extras: s.extras.filter((x) => x.id !== id) }));
      void api.delete(`/extras/${id}`).catch(() => {
        void get().refresh();
      });
    },
  }),
);

function tmpIdNow() {
  return `tmp_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

function extractExtraApiError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: unknown } } };
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(' ') || fallback;
  if (typeof msg === 'string' && msg.trim()) return msg;
  return fallback;
}

function isPersistedExtraId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function mapExtraFromApi(x: any): Extra {
  let billingUnit: ExtraBillingUnit = 'location';
  if (x?.billingUnit === 'JOUR') billingUnit = 'jour';
  else if (x?.billingUnit === 'SEMAINE') billingUnit = 'semaine';
  const paymentChannel: ExtraPaymentChannel = x?.paymentChannel === 'OFFLINE' ? 'offline' : 'online';
  return {
    id: String(x?.id ?? ''),
    name: String(x?.name ?? ''),
    description: String(x?.description ?? ''),
    priceKind: x?.priceKind === 'PERCENT' ? 'percent' : 'euro',
    priceValue: Number(x?.priceValue ?? 0),
    billingUnit,
    vatRate: Number(x?.vatRate ?? 0),
    stock: x?.stock === null || x?.stock === undefined ? null : Number(x.stock),
    paymentChannel,
    icon: x?.icon ? String(x.icon) : null,
    enabled: Boolean(x?.enabled ?? true),
    createdAt: x?.createdAt ? new Date(x.createdAt).toISOString() : new Date().toISOString(),
  };
}

function extraToApiPayload(e: {
  name: string;
  description: string;
  priceKind: ExtraPriceKind;
  priceValue: number;
  billingUnit: ExtraBillingUnit;
  vatRate: number;
  stock: number | null;
  paymentChannel: ExtraPaymentChannel;
  icon: string | null;
  enabled: boolean;
}) {
  let billingUnit = 'LOCATION';
  if (e.billingUnit === 'jour') billingUnit = 'JOUR';
  else if (e.billingUnit === 'semaine') billingUnit = 'SEMAINE';
  return {
    name: e.name,
    description: e.description,
    priceKind: e.priceKind === 'percent' ? 'PERCENT' : 'EURO',
    priceValue: e.priceValue,
    billingUnit,
    vatRate: e.vatRate,
    stock: e.stock,
    paymentChannel: e.paymentChannel === 'offline' ? 'OFFLINE' : 'ONLINE',
    icon: e.icon,
    enabled: e.enabled,
  };
}

async function createExtraApi(
  tmpId: string,
  input: {
    name: string;
    description: string;
    priceKind: ExtraPriceKind;
    priceValue: number;
    billingUnit: ExtraBillingUnit;
    vatRate: number;
    stock: number | null;
    paymentChannel: ExtraPaymentChannel;
    icon: string | null;
    enabled: boolean;
  },
  set: (fn: any) => void,
) {
  try {
    const { data } = await api.post('/extras', extraToApiPayload(input));
    set((s: { extras: Extra[] }) => ({
      extras: s.extras.map((x) => (x.id === tmpId ? mapExtraFromApi(data) : x)),
    }));
  } catch {
    set((s: { extras: Extra[] }) => ({ extras: s.extras.filter((x) => x.id !== tmpId) }));
  }
}
