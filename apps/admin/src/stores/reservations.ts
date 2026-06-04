import { create } from 'zustand';
import { api } from '@/lib/api';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import {
  emptyWizardDetails,
  type ReservationWizardDetails,
} from '@/pages/calendar/reservationWizardTypes';
import { resolveReservationStatus, statusFromApi, statusToApi } from '@/lib/reservationStatus';
import { resolveRentalContractStatus } from '@bleu-calanque/shared';

export type StoredReservation = {
  id: string;
  boatId: string;
  title: string;
  start: string;
  end: string;
  color?: string;
  details?: ReservationWizardDetails;
  totalDueCents?: number | null;
  /** Empreinte caution Stripe (PaymentIntent en requires_capture). */
  stripeDepositPaymentIntentId?: string | null;
  checkInDone?: boolean;
  checkOutDone?: boolean;
  rentalContractSigned?: boolean;
  rentalContractLocked?: boolean;
  rentalContractDataStale?: boolean;
  rentalContractStatus?: import('@bleu-calanque/shared').RentalContractStatus;
};

function serialize(r: Reservation): StoredReservation {
  return {
    ...r,
    start: r.start.toISOString(),
    end: r.end.toISOString(),
  };
}

export function deserializeReservation(s: StoredReservation): Reservation {
  return {
    ...s,
    start: new Date(s.start),
    end: new Date(s.end),
  };
}

interface ReservationsState {
  items: StoredReservation[];
  hydrated: boolean;
  refresh: () => Promise<void>;
  replace: (u: Reservation[] | ((prev: Reservation[]) => Reservation[])) => void;
  clearAll: () => void;
}

/** IDs persistés = UUID Prisma ; tout le reste (resa_*, tmp_*, etc.) = client avant POST. */
function isPersistedReservationId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function isLocalId(id: string) {
  return !isPersistedReservationId(id);
}

function parseAmountToCents(v: string | null | undefined): number | null {
  if (v == null) return null;
  const s = String(v).replaceAll(',', '.').trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function parseDisplayDateToIso(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  if (!s) return null;
  // jj/mm/aaaa
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
  }
  // déjà ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(`${s.slice(0, 10)}T00:00:00.000Z`).toISOString();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function clientTypeToApi(t: string | undefined | null): 'PARTICULIER' | 'PROFESSIONNEL' | 'ASSOCIATION' | null {
  if (t === 'professionnel') return 'PROFESSIONNEL';
  if (t === 'association') return 'ASSOCIATION';
  if (t === 'particulier') return 'PARTICULIER';
  return null;
}
function clientTypeFromApi(t: string | undefined | null): 'particulier' | 'professionnel' | 'association' {
  if (t === 'PROFESSIONNEL') return 'professionnel';
  if (t === 'ASSOCIATION') return 'association';
  return 'particulier';
}
function civilityToApi(c: string | undefined | null): 'M' | 'MME' | 'MX' | null {
  if (c === 'M.') return 'M';
  if (c === 'Mme') return 'MME';
  if (c === 'Mx') return 'MX';
  return null;
}
function civilityFromApi(c: string | undefined | null): '' | 'M.' | 'Mme' | 'Mx' {
  if (c === 'M') return 'M.';
  if (c === 'MME') return 'Mme';
  if (c === 'MX') return 'Mx';
  return '';
}

function mergeDetailsWithStatus(
  details: ReservationWizardDetails | undefined,
  apiStatus?: string | null,
): ReservationWizardDetails | undefined {
  if (!details) return undefined;
  const status = resolveReservationStatus(details, apiStatus);
  return { ...details, status };
}

function reservationToApi(s: StoredReservation) {
  const d = mergeDetailsWithStatus(s.details);
  const extras = d?.extras
    ? Object.entries(d.extras)
        .filter(([, on]) => Boolean(on))
        .map(([extraId]) => ({ extraId, quantity: 1 }))
    : [];
  return {
    boatId: s.boatId,
    title: s.title,
    start: s.start,
    end: s.end,
    color: s.color ?? null,
    detailsJson: d ? JSON.stringify(d) : null,
    clientMemberId: d?.linkedMemberId?.trim() || null,
    clientType: clientTypeToApi(d?.clientType ?? null),
    civility: civilityToApi(d?.civility ?? null),
    clientEmail: d?.clientEmail ?? null,
    clientFirstName: d?.clientFirstName ?? null,
    clientLastName: d?.clientLastName ?? null,
    clientPhone: d?.clientPhone ?? null,
    clientBirthDate: parseDisplayDateToIso(d?.clientBirthDateDisplay ?? null),
    clientAddress: d?.clientAddress ?? null,
    clientPostalCode: d?.clientPostalCode ?? null,
    clientCity: d?.clientCity ?? null,
    clientCountry: d?.clientCountry ?? null,
    passengerCount: d?.passengerCount ?? null,
    hasChildren: Boolean(d?.hasChildren ?? false),
    childrenCount: d?.hasChildren ? (d.childrenCount ?? null) : null,
    internalNote: d?.internalNote ?? null,
    paymentChannel: (d?.paymentChannel === 'offline' ? 'OFFLINE' : 'ONLINE') as 'ONLINE' | 'OFFLINE',
    rentalPriceCents: parseAmountToCents(d?.rentalPrice ?? null),
    depositAmountCents: parseAmountToCents(d?.depositAmount ?? null),
    discountPercent: parseDiscountPercent(d?.discountPercent ?? null),
    couponCode: d?.couponCode?.trim() ? d.couponCode.trim().replaceAll(/\s+/g, '').toUpperCase() : null,
    airbusBadge: d?.airbusBadge?.trim() ? d.airbusBadge.trim().replaceAll(/\s+/g, '').toUpperCase() : null,
    installments: d?.installments ?? null,
    settlementNote: d?.settlementNote ?? null,
    paymentCapturedAt: d?.paymentCapturedAt ?? null,
    depositCapturedAt: d?.depositCapturedAt ?? null,
    confirmationEmailSentAt: d?.confirmationEmailSentAt ?? null,
    totalDueCents: s.totalDueCents ?? null,
    cancelledAt: d?.cancelledAt ?? null,
    status: statusToApi(resolveReservationStatus(d)),
    extras,
    refunds: d?.refunds ?? [],
  };
}

function parseDiscountPercent(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = Math.round(Number(String(v).replaceAll(',', '.')));
  return Number.isFinite(n) ? n : null;
}

function refundsFromApiRows(x: any): NonNullable<ReservationWizardDetails['refunds']> {
  if (!Array.isArray(x?.refunds)) return [];
  return x.refunds.map((r: any) => ({
    id: String(r?.id ?? ''),
    amount: Number((r?.amountCents ?? 0) / 100),
    at: r?.refundedAt ? new Date(r.refundedAt).toISOString() : new Date().toISOString(),
    note: r?.note ?? undefined,
  }));
}

function reservationFromApi(x: any): StoredReservation {
  let details: ReservationWizardDetails | undefined;
  const apiRefunds = refundsFromApiRows(x);
  if (typeof x?.detailsJson === 'string' && x.detailsJson) {
    try {
      const parsed = JSON.parse(x.detailsJson) as ReservationWizardDetails;
      details = { ...emptyWizardDetails(), ...parsed };
    } catch {
      details = undefined;
    }
  }
  const apiStatus = statusFromApi(x?.status);
  if (!details) {
    const extrasMap: Record<string, boolean> = {};
    if (Array.isArray(x?.extras)) for (const e of x.extras) extrasMap[String(e?.extraId)] = true;
    const base: ReservationWizardDetails = {
      passengerCount: Number(x?.passengerCount ?? 1),
      hasChildren: Boolean(x?.hasChildren ?? false),
      childrenCount: Number(x?.childrenCount ?? 0),
      internalNote: String(x?.internalNote ?? ''),
      clientType: clientTypeFromApi(x?.clientType),
      civility: civilityFromApi(x?.civility),
      clientEmail: String(x?.clientEmail ?? ''),
      clientFirstName: String(x?.clientFirstName ?? ''),
      clientLastName: String(x?.clientLastName ?? ''),
      clientPhone: String(x?.clientPhone ?? ''),
      clientBirthDateDisplay: x?.clientBirthDate ? new Date(x.clientBirthDate).toISOString().slice(0, 10) : '',
      clientAddress: String(x?.clientAddress ?? ''),
      clientPostalCode: String(x?.clientPostalCode ?? ''),
      clientCity: String(x?.clientCity ?? ''),
      clientCountry: String(x?.clientCountry ?? 'France'),
      clientIdType: "Carte d'identité",
      clientIdNumber: '',
      licenseType: '',
      licenseNumber: '',
      licenseCountry: String(x?.clientCountry ?? 'France'),
      licenseYear: '',
      paymentChannel: x?.paymentChannel === 'OFFLINE' ? 'offline' : 'online',
      linkedMemberId: x?.clientMemberId ?? null,
      rentalPrice: x?.rentalPriceCents != null ? String((x.rentalPriceCents / 100).toFixed(2)) : '',
      depositAmount: x?.depositAmountCents != null ? String((x.depositAmountCents / 100).toFixed(2)) : '',
      discountPercent: x?.discountPercent != null ? String(x.discountPercent) : '',
      couponCode: String(x?.couponCode ?? ''),
      airbusBadge: String(x?.airbusBadge ?? ''),
      extras: extrasMap,
      installments: (x?.installments === 2 ? 2 : 1),
      settlementNote: String(x?.settlementNote ?? ''),
      paymentCapturedAt: x?.paymentCapturedAt ? new Date(x.paymentCapturedAt).toISOString() : null,
      depositCapturedAt: x?.depositCapturedAt ? new Date(x.depositCapturedAt).toISOString() : null,
      confirmationEmailSentAt: x?.confirmationEmailSentAt ? new Date(x.confirmationEmailSentAt).toISOString() : null,
      refunds: Array.isArray(x?.refunds)
        ? x.refunds.map((r: any) => ({
            id: String(r?.id ?? ''),
            amount: Number((r?.amountCents ?? 0) / 100),
            at: r?.refundedAt ? new Date(r.refundedAt).toISOString() : new Date().toISOString(),
            note: r?.note ?? undefined,
          }))
        : [],
      cancelledAt: x?.cancelledAt ? new Date(x.cancelledAt).toISOString() : null,
      status: 'pending_payment',
    };
    details = { ...base, status: resolveReservationStatus(base, x?.status) };
  } else {
    if (x?.passengerCount != null) {
      details = { ...details, passengerCount: Number(x.passengerCount) };
    }
    if (x?.hasChildren != null) {
      details = { ...details, hasChildren: Boolean(x.hasChildren) };
    }
    if (x?.childrenCount != null) {
      details = { ...details, childrenCount: Number(x.childrenCount) };
    }
    if (x?.airbusBadge != null && x.airbusBadge !== '') {
      details = { ...details, airbusBadge: String(x.airbusBadge) };
    }
    details = mergeDetailsWithStatus(details, x?.status) ?? details;
    if (x?.cancelledAt) {
      details = {
        ...details,
        cancelledAt: new Date(x.cancelledAt).toISOString(),
        status: 'cancelled',
      };
    } else if (apiStatus) {
      details = { ...details, status: apiStatus };
    }
    const resolved = resolveReservationStatus(details, x?.status);
    if (x?.paymentCapturedAt && resolved !== 'cancelled' && apiStatus !== 'cancelled') {
      const paidStatus =
        resolved === 'refunded' || resolved === 'partially_refunded' ? resolved : 'reserved_paid';
      details = {
        ...details,
        paymentCapturedAt: new Date(x.paymentCapturedAt).toISOString(),
        status: paidStatus,
      };
    }
  }

  if (details && apiRefunds.length > 0) {
    details = { ...details, refunds: apiRefunds };
    if (apiStatus === 'refunded' || apiStatus === 'partially_refunded') {
      details = { ...details, status: apiStatus };
    }
  }
  return {
    id: String(x?.id ?? ''),
    boatId: String(x?.boatId ?? ''),
    title: String(x?.title ?? ''),
    start: x?.startAt ? new Date(x.startAt).toISOString() : new Date().toISOString(),
    end: x?.endAt ? new Date(x.endAt).toISOString() : new Date().toISOString(),
    color: x?.color ?? undefined,
    details,
    stripeDepositPaymentIntentId: x?.stripeDepositPaymentIntentId
      ? String(x.stripeDepositPaymentIntentId)
      : null,
    checkInDone: Array.isArray(x?.checkFlowSubmissions)
      ? x.checkFlowSubmissions.some((s: { kind?: string }) => s.kind === 'CHECK_IN')
      : Boolean(x?.checkInDone),
    checkOutDone: Array.isArray(x?.checkFlowSubmissions)
      ? x.checkFlowSubmissions.some((s: { kind?: string }) => s.kind === 'CHECK_OUT')
      : Boolean(x?.checkOutDone),
    rentalContractSigned: Boolean(x?.rentalContract?.signed ?? x?.rentalContract?.signedAt),
    rentalContractLocked: Boolean(x?.rentalContract?.contractLocked ?? x?.rentalContract?.signedAt),
    rentalContractDataStale: Boolean(x?.rentalContract?.contractDataStale),
    rentalContractStatus:
      x?.rentalContract?.status ??
      resolveRentalContractStatus({
        signedAt: x?.rentalContract?.signedAt ?? null,
        contractSignEmailSentAt: x?.rentalContract?.contractSignEmailSentAt ?? null,
        paymentCapturedAt: details?.paymentCapturedAt ?? x?.paymentCapturedAt ?? null,
        adminStatus: details?.status ?? (details ? resolveReservationStatus(details) : null),
        apiStatus: apiStatus ?? null,
      }),
    totalDueCents: x?.totalDueCents != null ? Number(x.totalDueCents) : null,
  };
}

export const useReservationsStore = create<ReservationsState>()((set, get) => ({
  items: [],
  hydrated: false,

  refresh: async () => {
    try {
      const { data } = await api.get('/reservations');
      const fromApi = (Array.isArray(data) ? data : []).map(reservationFromApi);
      set((state) => {
        const apiIds = new Set(fromApi.map((x) => x.id));
        const pendingLocal = state.items
          .map(deserializeReservation)
          .filter((r) => isLocalId(r.id) && !apiIds.has(r.id))
          .map(serialize);
        return { items: [...fromApi, ...pendingLocal], hydrated: true };
      });
    } catch {
      set({ hydrated: true });
    }
  },

  replace: (u) => {
    set((state) => {
      const prev = state.items.map(deserializeReservation);
      const next = typeof u === 'function' ? (u as (p: Reservation[]) => Reservation[])(prev) : u;
      const nextSerialized = next.map(serialize);

      const prevById = new Map(state.items.map((it) => [it.id, it]));
      const nextById = new Map(nextSerialized.map((it) => [it.id, it]));

      const created: StoredReservation[] = [];
      const updated: StoredReservation[] = [];
      const deletedIds: string[] = [];

      for (const id of nextById.keys()) {
        const after = nextById.get(id)!;
        const before = prevById.get(id);
        if (!before) {
          created.push(after);
        } else if (JSON.stringify(before) !== JSON.stringify(after)) {
          updated.push(after);
        }
      }
      for (const id of prevById.keys()) {
        if (!nextById.has(id)) {
          deletedIds.push(id);
        }
      }

      for (const r of created) void persistCreate(r, set, get);
      for (const r of updated) void persistUpdate(r, set, get);
      for (const id of deletedIds) void persistDelete(id, get);

      if (created.length > 0 || updated.length > 0 || deletedIds.length > 0) {
        const batch = {
          created,
          updated: updated
            .map((after) => {
              const before = prevById.get(after.id);
              return before ? { before, after } : null;
            })
            .filter((x): x is { before: StoredReservation; after: StoredReservation } => x != null),
          deleted: deletedIds
            .map((id) => prevById.get(id))
            .filter((x): x is StoredReservation => x != null),
        };
        void import('@/stores/notifications').then(({ useNotificationsStore }) => {
          useNotificationsStore.getState().processReservationChanges(batch);
        });
      }

      return { items: nextSerialized };
    });
  },

  clearAll: () => {
    set({ items: [] });
    void api.delete('/reservations').catch(() => {
      void get().refresh();
    });
  },
}));

async function persistCreate(
  r: StoredReservation,
  set: (fn: any) => void,
  get: () => ReservationsState,
) {
  try {
    if (isLocalId(r.id)) {
      const { data } = await api.post('/reservations', reservationToApi(r));
      const real = reservationFromApi(data);
      set((s: ReservationsState) => ({
        items: s.items.map((x) => (x.id === r.id ? real : x)),
      }));
    } else {
      await api.put(`/reservations/${r.id}`, reservationToApi(r));
    }
  } catch {
    set((s: ReservationsState) => ({
      items: s.items.filter((x) => x.id !== r.id),
    }));
    void get().refresh();
  }
}

async function persistUpdate(
  r: StoredReservation,
  set: (fn: any) => void,
  get: () => ReservationsState,
) {
  try {
    if (isLocalId(r.id)) {
      // Pas encore confirmé côté serveur ; le create en cours s'en chargera.
      return;
    }
    const { data } = await api.put(`/reservations/${r.id}`, reservationToApi(r));
    const real = reservationFromApi(data);
    set((s: ReservationsState) => ({
      items: s.items.map((x) => (x.id === r.id ? real : x)),
    }));
    const { postAdminBroadcast } = await import('@/lib/adminBroadcast');
    postAdminBroadcast({ type: 'reservations-changed' });
  } catch {
    void get().refresh();
  }
}

async function persistDelete(id: string, get: () => ReservationsState) {
  if (isLocalId(id)) return;
  try {
    await api.delete(`/reservations/${id}`);
  } catch {
    void get().refresh();
  }
}

// Bootstrap helper conservé pour compatibilité.
export function seedDemoReservationsIfEmpty() {
  // pas de seed
}
