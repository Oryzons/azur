import { create } from 'zustand';
import { api } from '@/lib/api';

export type CouponDiscountKind = 'percent' | 'fixed';

export type CouponSeasonRule = {
  maxFullDiscountUsesPerClient: number;
  degradedDiscountValue: number;
};

export type Coupon = {
  id: string;
  code: string;
  internalLabel: string;
  discountKind: CouponDiscountKind;
  discountValue: number;
  validFrom: string;
  validUntil: string | null;
  enabled: boolean;
  createdAt: string;
  seasonRule: CouponSeasonRule | null;
  requiresAirbusBadge: boolean;
};

export type CouponRedemption = {
  id: string;
  couponId: string;
  clientKey: string;
  redeemedAt: string;
};

function startOfDayFromIso(isoDate: string) {
  return new Date(`${isoDate.trim()}T00:00:00.000`).getTime();
}
function endOfDayFromIso(isoDate: string) {
  return new Date(`${isoDate.trim()}T23:59:59.999`).getTime();
}

export function isDateInAprilSeptemberSeason(d: Date) {
  const m = d.getMonth();
  return m >= 3 && m <= 8;
}

export function seasonYearForAprilSeptember(d: Date): number | null {
  if (!isDateInAprilSeptemberSeason(d)) return null;
  return d.getFullYear();
}

export function countSeasonRedemptionsForClient(
  redemptions: readonly CouponRedemption[],
  couponId: string,
  clientKey: string,
  seasonYear: number,
) {
  return redemptions.filter((r) => {
    if (r.couponId !== couponId || r.clientKey !== clientKey) return false;
    const dt = new Date(r.redeemedAt);
    return seasonYearForAprilSeptember(dt) === seasonYear;
  }).length;
}

export type EffectiveCouponTier = 'full' | 'degraded';

export function getEffectiveCouponDiscount(
  coupon: Coupon,
  clientKey: string,
  redemptions: readonly CouponRedemption[],
  evaluationDate: Date = new Date(),
): { discountKind: CouponDiscountKind; discountValue: number; tier: EffectiveCouponTier } {
  const full = {
    discountKind: coupon.discountKind,
    discountValue: coupon.discountValue,
    tier: 'full' as EffectiveCouponTier,
  };
  if (!coupon.seasonRule) return full;
  const seasonY = seasonYearForAprilSeptember(evaluationDate);
  if (seasonY === null) return full;
  const prior = countSeasonRedemptionsForClient(redemptions, coupon.id, clientKey.trim(), seasonY);
  if (prior >= coupon.seasonRule.maxFullDiscountUsesPerClient) {
    return {
      discountKind: coupon.discountKind,
      discountValue: coupon.seasonRule.degradedDiscountValue,
      tier: 'degraded',
    };
  }
  return full;
}

export function isCouponActiveNow(c: Coupon, now = new Date()) {
  if (!c.enabled) return false;
  const t = now.getTime();
  const from = c.validFrom?.trim();
  if (!from) return false;
  if (t < startOfDayFromIso(from)) return false;
  if (c.validUntil !== null && c.validUntil !== '') {
    if (t > endOfDayFromIso(c.validUntil)) return false;
  }
  return true;
}

export type AddCouponPayload = Omit<Coupon, 'id' | 'createdAt'>;
export type UpdateCouponPayload = Coupon;

interface CouponsState {
  coupons: Coupon[];
  redemptions: CouponRedemption[];
  hydrated: boolean;
  refresh: () => Promise<void>;
  addCoupon: (payload: AddCouponPayload) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  updateCoupon: (payload: UpdateCouponPayload) => Promise<{ ok: true } | { ok: false; error: string }>;
  setCouponEnabled: (id: string, enabled: boolean) => void;
  removeCoupon: (id: string) => void;
  recordCouponRedemption: (couponId: string, clientKey: string, at?: Date) => void;
  removeRedemptionsForClient: (
    couponId: string,
    clientKey: string,
  ) => Promise<{ ok: true; deletedCount: number } | { ok: false; error: string }>;
  clearRedemptions: () => Promise<{ ok: true } | { ok: false; error: string }>;
}

function tmpIdNow() {
  return `tmp_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

function isPersistedCouponId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function validateCouponPayload(payload: AddCouponPayload, existingCodes: string[], excludeCode?: string) {
  const codeRaw = payload.code.trim();
  const code = codeRaw.replaceAll(/\s+/g, '').toUpperCase();
  if (!code) return { ok: false as const, error: 'Le code est requis.' };
  if (existingCodes.some((c) => c === code && c !== excludeCode)) return { ok: false as const, error: 'Ce code existe déjà.' };
  if (!payload.validFrom?.trim()) return { ok: false as const, error: 'La date de début de validité est obligatoire.' };
  if (payload.discountKind === 'percent') {
    if (payload.discountValue < 1 || payload.discountValue > 100) {
      return { ok: false as const, error: 'Le pourcentage doit être entre 1 et 100 %.' };
    }
  } else if (payload.discountValue <= 0) {
    return { ok: false as const, error: 'Le montant fixe doit être supérieur à 0 €.' };
  }
  if (payload.seasonRule) {
    if (!Number.isInteger(payload.seasonRule.maxFullDiscountUsesPerClient) || payload.seasonRule.maxFullDiscountUsesPerClient < 1) {
      return { ok: false as const, error: 'Le nombre d’usages à remise pleine doit être un entier ≥ 1.' };
    }
    if (payload.seasonRule.degradedDiscountValue >= payload.discountValue) {
      return { ok: false as const, error: 'La remise dégradée doit être strictement inférieure à la remise pleine.' };
    }
  }
  return { ok: true as const, code };
}

function extractApiError(e: any, fallback: string): string {
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(' ') || fallback;
  if (typeof msg === 'string') return msg;
  return fallback;
}

function couponToApi(c: AddCouponPayload | Coupon) {
  return {
    code: c.code,
    internalLabel: c.internalLabel,
    discountKind: c.discountKind === 'fixed' ? 'FIXED' : 'PERCENT',
    discountValue: c.discountValue,
    validFrom: c.validFrom,
    validUntil: c.validUntil ?? null,
    enabled: c.enabled,
    seasonMaxFullUsesPerClient: c.seasonRule?.maxFullDiscountUsesPerClient ?? null,
    seasonDegradedDiscountValue: c.seasonRule?.degradedDiscountValue ?? null,
    requiresAirbusBadge: c.requiresAirbusBadge ?? false,
  };
}

function couponFromApi(x: any): Coupon {
  const validFrom = x?.validFrom ? new Date(x.validFrom).toISOString().slice(0, 10) : '';
  const validUntil = x?.validUntil ? new Date(x.validUntil).toISOString().slice(0, 10) : null;
  const seasonMax = x?.seasonMaxFullUsesPerClient;
  const seasonDeg = x?.seasonDegradedDiscountValue;
  const seasonRule: CouponSeasonRule | null =
    typeof seasonMax === 'number' && typeof seasonDeg === 'number'
      ? { maxFullDiscountUsesPerClient: seasonMax, degradedDiscountValue: seasonDeg }
      : null;
  return {
    id: String(x?.id ?? ''),
    code: String(x?.code ?? ''),
    internalLabel: String(x?.internalLabel ?? ''),
    discountKind: x?.discountKind === 'FIXED' ? 'fixed' : 'percent',
    discountValue: Number(x?.discountValue ?? 0),
    validFrom,
    validUntil,
    enabled: Boolean(x?.enabled ?? true),
    createdAt: x?.createdAt ? new Date(x.createdAt).toISOString() : new Date().toISOString(),
    seasonRule,
    requiresAirbusBadge: Boolean(x?.requiresAirbusBadge ?? false),
  };
}

function redemptionFromApi(x: any): CouponRedemption {
  return {
    id: String(x?.id ?? ''),
    couponId: String(x?.couponId ?? ''),
    clientKey: String(x?.clientKey ?? ''),
    redeemedAt: x?.redeemedAt ? new Date(x.redeemedAt).toISOString() : new Date().toISOString(),
  };
}

export const useCouponsStore = create<CouponsState>()((set, get) => ({
  coupons: [],
  redemptions: [],
  hydrated: false,

  refresh: async () => {
    try {
      const [c, r] = await Promise.all([api.get('/coupons'), api.get('/coupon-redemptions')]);
      const coupons = (Array.isArray(c.data) ? c.data : []).map(couponFromApi);
      const redemptions = (Array.isArray(r.data) ? r.data : []).map(redemptionFromApi);
      set({ coupons, redemptions, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  addCoupon: async (payload) => {
    const codes = get().coupons.map((c) => c.code);
    const v = validateCouponPayload(payload, codes);
    if (!v.ok) return v;
    const code = v.code;

    const tmpId = tmpIdNow();
    const optimistic: Coupon = { ...payload, code, id: tmpId, createdAt: new Date().toISOString() };
    set((s) => ({ coupons: [optimistic, ...s.coupons] }));

    try {
      const { data } = await api.post('/coupons', couponToApi({ ...payload, code }));
      const real = couponFromApi(data);
      set((s) => ({ coupons: s.coupons.map((c) => (c.id === tmpId ? real : c)) }));
      return { ok: true, id: real.id };
    } catch (e: any) {
      set((s) => ({ coupons: s.coupons.filter((c) => c.id !== tmpId) }));
      return { ok: false, error: extractApiError(e, 'Impossible de créer le coupon.') };
    }
  },

  updateCoupon: async (payload) => {
    const prev = get().coupons.find((c) => c.id === payload.id);
    if (!prev) return { ok: false, error: 'Coupon introuvable.' };

    const codes = get().coupons.map((c) => c.code);
    const v = validateCouponPayload(payload, codes, prev.code);
    if (!v.ok) return v;
    const code = v.code;
    const normalized: Coupon = { ...payload, code };

    set((s) => ({
      coupons: s.coupons.map((c) => (c.id === payload.id ? normalized : c)),
    }));

    if (!isPersistedCouponId(payload.id)) {
      return { ok: true };
    }

    try {
      const { data } = await api.patch(`/coupons/${payload.id}`, couponToApi(normalized));
      const real = couponFromApi(data);
      set((s) => ({ coupons: s.coupons.map((c) => (c.id === payload.id ? real : c)) }));
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: extractApiError(e, 'Impossible de modifier le coupon.') };
    }
  },

  setCouponEnabled: (id, enabled) => {
    const cur = get().coupons.find((c) => c.id === id);
    if (!cur) return;
    void get().updateCoupon({ ...cur, enabled });
  },

  removeCoupon: (id) => {
    set((s) => ({
      coupons: s.coupons.filter((c) => c.id !== id),
      redemptions: s.redemptions.filter((r) => r.couponId !== id),
    }));
    void api.delete(`/coupons/${id}`).catch(() => {
      void get().refresh();
    });
  },

  recordCouponRedemption: (couponId, clientKey, at = new Date()) => {
    const key = clientKey.trim();
    if (!key) return;
    const tmpId = tmpIdNow();
    set((s) => ({
      redemptions: [...s.redemptions, { id: tmpId, couponId, clientKey: key, redeemedAt: at.toISOString() }],
    }));
    void api
      .post(`/coupons/${couponId}/redemptions`, { clientKey: key, redeemedAt: at.toISOString() })
      .then(({ data }) => {
        const real = redemptionFromApi(data);
        set((s) => ({ redemptions: s.redemptions.map((r) => (r.id === tmpId ? real : r)) }));
      })
      .catch(() => {
        void get().refresh();
      });
  },

  removeRedemptionsForClient: async (couponId, clientKey) => {
    const key = clientKey.trim();
    if (!key) return { ok: false as const, error: 'Client invalide.' };
    if (!isPersistedCouponId(couponId)) {
      set((s) => ({
        redemptions: s.redemptions.filter((r) => !(r.couponId === couponId && r.clientKey === key)),
      }));
      return { ok: true as const, deletedCount: 0 };
    }
    try {
      const { data } = await api.post<{ deletedCount?: number }>('/coupon-redemptions/remove-by-client', {
        couponId,
        clientKey: key,
      });
      await get().refresh();
      return { ok: true as const, deletedCount: data?.deletedCount ?? 0 };
    } catch (e: unknown) {
      void get().refresh();
      return { ok: false as const, error: extractApiError(e, 'Impossible de supprimer les utilisations.') };
    }
  },

  clearRedemptions: async () => {
    try {
      await api.delete('/coupon-redemptions');
      await get().refresh();
      return { ok: true as const };
    } catch (e: unknown) {
      void get().refresh();
      return { ok: false as const, error: extractApiError(e, 'Impossible de vider les utilisations.') };
    }
  },
}));
