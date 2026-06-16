import {
  DEFAULT_COMPANY_ADDRESS_LINE,
  DEFAULT_COMPANY_CITY,
  DEFAULT_COMPANY_COUNTRY,
  DEFAULT_COMPANY_POSTAL_CODE,
  DEFAULT_RENTAL_ARRIVAL_LOCATION,
  DEFAULT_RENTAL_DEPARTURE_LOCATION,
  filterContractRequiredDocuments,
  DEFAULT_BRAND_NAME,
} from '@bleu-calanque/shared';
import { create } from 'zustand';
import { api } from '@/lib/api';

export type NauticManagerSettings = {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  webhookSecret: string;
  syncOwners: boolean;
  syncBoats: boolean;
  syncReservations: boolean;
};

export type PublicSiteSettings = {
  publicSiteUrl: string;
  brandName: string;
  contactEmail: string;
  contactPhone: string;
  addressLine: string;
  city: string;
  postalCode: string;
  country: string;
  departureLocation: string;
  arrivalLocation: string;
};

export type BookingSettings = {
  defaultNavalBase: string;
  departureLocation: string;
  arrivalLocation: string;
  requireDeposit: boolean;
  depositDefaultAmount: string;
  paymentsOnlineEnabled: boolean;
};

export type EmailSettings = {
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  confirmationsEnabled: boolean;
};

export type SeoSettings = {
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
};

export type CompanySettings = {
  legalName: string;
  tradeName: string;
  professionalPhone: string;
  domiciliation: string;
  companyType: string;
  vatNumber: string;
  siret: string;
  rcsRegistration: string;
  nafCode: string;
  shareCapital: string;
  addressLine: string;
  city: string;
  postalCode: string;
  country: string;
  contactEmail: string;
  contactPhone: string;
  publicSiteUrl: string;
  brandName: string;
  adsVatRatePercent: number;
  vatBasePercent: number;
  vatPercent: number;
  contractOperatorSignatureDataUrl: string | null;
  departureLocation: string;
  arrivalLocation: string;
  contactOpeningHours: string;
};

export type PartnerLinkedOffering = 'boat_license' | 'fluvial' | 'boat_rental';

export type Partner = {
  id: string;
  name: string;
  kind: 'nautic_base' | 'maintenance' | 'insurance' | 'other';
  linkedOfferings: PartnerLinkedOffering[];
  description: string;
  logoUrl: string;
  price: string;
  active: boolean;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  note: string;
  createdAt: string;
};

export type Contract = {
  id: string;
  name: string;
  title: string;
  description: string;
  requiredDocuments: string[];
  cancellationTerms: string;
  rentalTerms: string;
  active: boolean;
  createdAt: string;
  /** Contrats de réservation liés à ce modèle. */
  linkedReservationsCount?: number;
};

export type BankSettings = {
  accountHolder: string;
  iban: string;
  bic: string;
  bankName: string;
};

export type NotificationsSettings = {
  adminEmails: string;
  onReservationCreated: boolean;
  onReservationUpdated: boolean;
  onPaymentCaptured: boolean;
  onRefundCreated: boolean;
  onReservationCancelled: boolean;
  onReservationRestored: boolean;
  onReservationDeleted: boolean;
  onCheckInDone: boolean;
  onCheckOutDone: boolean;
};

export type AdminSettings = {
  nauticManager: NauticManagerSettings;
  publicSite: PublicSiteSettings;
  company: CompanySettings;
  partners: Partner[];
  contracts: Contract[];
  bank: BankSettings;
  notifications: NotificationsSettings;
  booking: BookingSettings;
  emails: EmailSettings;
  seo: SeoSettings;
  updatedAt: string;
};

function todayIso() {
  return new Date().toISOString();
}

function tmpIdNow(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export const DEFAULT_SETTINGS: AdminSettings = {
  nauticManager: {
    enabled: false,
    baseUrl: '',
    apiKey: '',
    webhookSecret: '',
    syncOwners: true,
    syncBoats: true,
    syncReservations: true,
  },
  publicSite: {
    publicSiteUrl: '',
    brandName: DEFAULT_BRAND_NAME,
    contactEmail: '',
    contactPhone: '',
    addressLine: DEFAULT_COMPANY_ADDRESS_LINE,
    city: DEFAULT_COMPANY_CITY,
    postalCode: DEFAULT_COMPANY_POSTAL_CODE,
    country: DEFAULT_COMPANY_COUNTRY,
    departureLocation: DEFAULT_RENTAL_DEPARTURE_LOCATION,
    arrivalLocation: DEFAULT_RENTAL_ARRIVAL_LOCATION,
  },
  company: {
    legalName: DEFAULT_BRAND_NAME,
    tradeName: DEFAULT_BRAND_NAME,
    professionalPhone: '',
    domiciliation: '',
    companyType: '',
    vatNumber: '',
    siret: '',
    rcsRegistration: '',
    nafCode: '',
    shareCapital: '',
    addressLine: DEFAULT_COMPANY_ADDRESS_LINE,
    city: DEFAULT_COMPANY_CITY,
    postalCode: DEFAULT_COMPANY_POSTAL_CODE,
    country: DEFAULT_COMPANY_COUNTRY,
    contactEmail: '',
    contactPhone: '',
    publicSiteUrl: '',
    brandName: DEFAULT_BRAND_NAME,
    adsVatRatePercent: 20,
    vatBasePercent: 100,
    vatPercent: 20,
    contractOperatorSignatureDataUrl: null,
    departureLocation: DEFAULT_RENTAL_DEPARTURE_LOCATION,
    arrivalLocation: DEFAULT_RENTAL_ARRIVAL_LOCATION,
    contactOpeningHours: 'Lundi – vendredi : 9h – 18h\nSamedi : 9h – 12h',
  },
  partners: [],
  contracts: [],
  bank: { accountHolder: '', iban: '', bic: '', bankName: '' },
  notifications: {
    adminEmails: '',
    onReservationCreated: true,
    onReservationUpdated: true,
    onPaymentCaptured: true,
    onRefundCreated: true,
    onReservationCancelled: true,
    onReservationRestored: true,
    onReservationDeleted: true,
    onCheckInDone: true,
    onCheckOutDone: true,
  },
  booking: {
    defaultNavalBase: DEFAULT_RENTAL_DEPARTURE_LOCATION,
    departureLocation: DEFAULT_RENTAL_DEPARTURE_LOCATION,
    arrivalLocation: DEFAULT_RENTAL_ARRIVAL_LOCATION,
    requireDeposit: true,
    depositDefaultAmount: '1500',
    paymentsOnlineEnabled: true,
  },
  emails: {
    fromName: DEFAULT_BRAND_NAME,
    fromEmail: '',
    replyToEmail: '',
    confirmationsEnabled: true,
  },
  seo: {
    metaTitle: `Location bateau — ${DEFAULT_BRAND_NAME}`,
    metaDescription: 'Réservez votre bateau en quelques clics.',
    ogImageUrl: '',
  },
  updatedAt: todayIso(),
};

type SettingsState = AdminSettings & {
  hydrated: boolean;
  refresh: () => Promise<void>;
  setSettings: (u: {
    nauticManager?: Partial<NauticManagerSettings>;
    publicSite?: Partial<PublicSiteSettings>;
    company?: Partial<CompanySettings>;
    bank?: Partial<BankSettings>;
    notifications?: Partial<NotificationsSettings>;
    booking?: Partial<BookingSettings>;
    emails?: Partial<EmailSettings>;
    seo?: Partial<SeoSettings>;
  }) => void;
  addPartner: (p: Omit<Partner, 'id' | 'createdAt'>) => string;
  updatePartner: (p: Omit<Partner, 'createdAt'>) => void;
  removePartner: (id: string) => void;
  addContract: (c: Omit<Contract, 'id' | 'createdAt'>) => string;
  updateContract: (c: Omit<Contract, 'createdAt'>) => void;
  removeContract: (id: string) => void;
  applyDefaultContractTemplate: (id: string) => Promise<Contract>;
  resetSettings: () => void;
};

function partnerKindToApi(k: Partner['kind']): 'NAUTIC_BASE' | 'MAINTENANCE' | 'INSURANCE' | 'OTHER' {
  if (k === 'nautic_base') return 'NAUTIC_BASE';
  if (k === 'maintenance') return 'MAINTENANCE';
  if (k === 'insurance') return 'INSURANCE';
  return 'OTHER';
}
function partnerKindFromApi(k: string): Partner['kind'] {
  if (k === 'NAUTIC_BASE') return 'nautic_base';
  if (k === 'MAINTENANCE') return 'maintenance';
  if (k === 'INSURANCE') return 'insurance';
  return 'other';
}

const PARTNER_OFFERING_ORDER: PartnerLinkedOffering[] = ['boat_license', 'fluvial', 'boat_rental'];

function parseLinkedOfferingsFromApi(json: string | undefined | null): PartnerLinkedOffering[] {
  const raw = typeof json === 'string' ? json.trim() : '';
  if (!raw) return ['boat_license'];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return ['boat_license'];
    const out: PartnerLinkedOffering[] = [];
    for (const x of arr) {
      const u = String(x).toUpperCase();
      if (u === 'FLUVIAL') out.push('fluvial');
      else if (u === 'BOAT_RENTAL') out.push('boat_rental');
      else if (u === 'BOAT_LICENSE') out.push('boat_license');
    }
    const uniq = [...new Set(out)];
    if (!uniq.length) return ['boat_license'];
    return PARTNER_OFFERING_ORDER.filter((o) => uniq.includes(o));
  } catch {
    return ['boat_license'];
  }
}

function linkedOfferingsToApi(vals: PartnerLinkedOffering[]): ('BOAT_LICENSE' | 'FLUVIAL' | 'BOAT_RENTAL')[] {
  return vals.map((k) => (k === 'fluvial' ? 'FLUVIAL' : k === 'boat_rental' ? 'BOAT_RENTAL' : 'BOAT_LICENSE'));
}

function partnerFromApi(x: any): Partner {
  return {
    id: String(x?.id ?? ''),
    name: String(x?.name ?? ''),
    kind: partnerKindFromApi(String(x?.kind ?? 'OTHER')),
    linkedOfferings: parseLinkedOfferingsFromApi(x?.linkedOfferingsJson),
    description: String(x?.description ?? ''),
    logoUrl: String(x?.logoUrl ?? ''),
    price: String(x?.price ?? ''),
    active: Boolean(x?.active ?? true),
    contactName: String(x?.contactName ?? ''),
    contactEmail: String(x?.contactEmail ?? ''),
    contactPhone: String(x?.contactPhone ?? ''),
    note: String(x?.note ?? ''),
    createdAt: x?.createdAt ? new Date(x.createdAt).toISOString() : new Date().toISOString(),
  };
}

function contractFromApi(x: any): Contract {
  let docs: string[] = [];
  try {
    const parsed = typeof x?.requiredDocuments === 'string' ? JSON.parse(x.requiredDocuments) : x?.requiredDocuments;
    if (Array.isArray(parsed)) docs = filterContractRequiredDocuments(parsed.map((d) => String(d)));
  } catch {
    docs = [];
  }
  return {
    id: String(x?.id ?? ''),
    name: String(x?.name ?? ''),
    title: String(x?.title ?? ''),
    description: String(x?.description ?? ''),
    requiredDocuments: docs,
    cancellationTerms: String(x?.cancellationTerms ?? ''),
    rentalTerms: String(x?.rentalTerms ?? ''),
    active: Boolean(x?.active ?? true),
    createdAt: x?.createdAt ? new Date(x.createdAt).toISOString() : new Date().toISOString(),
    linkedReservationsCount:
      typeof x?.linkedReservationsCount === 'number' ? x.linkedReservationsCount : undefined,
  };
}

function notifPayloadFromState(n: NotificationsSettings) {
  return {
    adminEmailsCsv: n.adminEmails,
    onReservationCreated: n.onReservationCreated,
    onReservationUpdated: n.onReservationUpdated,
    onPaymentCaptured: n.onPaymentCaptured,
    onRefundCreated: n.onRefundCreated,
    onReservationCancelled: n.onReservationCancelled,
    onReservationRestored: n.onReservationRestored,
    onReservationDeleted: n.onReservationDeleted,
    onCheckInDone: n.onCheckInDone,
    onCheckOutDone: n.onCheckOutDone,
  };
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  ...DEFAULT_SETTINGS,
  hydrated: false,

  refresh: async () => {
    const { data } = await api.get('/settings');
    set({
      company: { ...DEFAULT_SETTINGS.company, ...stripIdAndUpdatedAt(data?.company) },
      bank: { ...DEFAULT_SETTINGS.bank, ...stripIdAndUpdatedAt(data?.bank) },
      notifications: {
        ...DEFAULT_SETTINGS.notifications,
        adminEmails: String(data?.notifications?.adminEmailsCsv ?? ''),
        onReservationCreated: Boolean(data?.notifications?.onReservationCreated ?? true),
        onReservationUpdated: Boolean(data?.notifications?.onReservationUpdated ?? true),
        onPaymentCaptured: Boolean(data?.notifications?.onPaymentCaptured ?? true),
        onRefundCreated: Boolean(data?.notifications?.onRefundCreated ?? true),
        onReservationCancelled: Boolean(data?.notifications?.onReservationCancelled ?? true),
        onReservationRestored: Boolean(data?.notifications?.onReservationRestored ?? true),
        onReservationDeleted: Boolean(data?.notifications?.onReservationDeleted ?? true),
        onCheckInDone: Boolean(data?.notifications?.onCheckInDone ?? true),
        onCheckOutDone: Boolean(data?.notifications?.onCheckOutDone ?? true),
      },
      booking: { ...DEFAULT_SETTINGS.booking, ...stripIdAndUpdatedAt(data?.booking) },
      emails: { ...DEFAULT_SETTINGS.emails, ...stripIdAndUpdatedAt(data?.email) },
      publicSite: { ...DEFAULT_SETTINGS.publicSite, ...stripIdAndUpdatedAt(data?.publicSite) },
      seo: { ...DEFAULT_SETTINGS.seo, ...stripIdAndUpdatedAt(data?.seo) },
      nauticManager: { ...DEFAULT_SETTINGS.nauticManager, ...stripIdAndUpdatedAt(data?.nauticManager) },
      partners: Array.isArray(data?.partners) ? data.partners.map(partnerFromApi) : [],
      contracts: Array.isArray(data?.contracts) ? data.contracts.map(contractFromApi) : [],
      updatedAt: todayIso(),
      hydrated: true,
    });
  },

  setSettings: (u) => {
    set((s) => ({
      ...s,
      nauticManager: u.nauticManager ? { ...s.nauticManager, ...u.nauticManager } : s.nauticManager,
      publicSite: u.publicSite ? { ...s.publicSite, ...u.publicSite } : s.publicSite,
      company: u.company ? { ...s.company, ...u.company } : s.company,
      bank: u.bank ? { ...s.bank, ...u.bank } : s.bank,
      notifications: u.notifications ? { ...s.notifications, ...u.notifications } : s.notifications,
      booking: u.booking ? { ...s.booking, ...u.booking } : s.booking,
      emails: u.emails ? { ...s.emails, ...u.emails } : s.emails,
      seo: u.seo ? { ...s.seo, ...u.seo } : s.seo,
      updatedAt: todayIso(),
    }));

    const payload: Record<string, unknown> = {};
    if (u.company) payload.company = u.company;
    if (u.bank) payload.bank = u.bank;
    if (u.notifications) {
      payload.notifications = notifPayloadFromState({ ...get().notifications, ...u.notifications });
    }
    if (u.booking) payload.booking = u.booking;
    if (u.emails) payload.email = u.emails;
    if (u.publicSite) payload.publicSite = u.publicSite;
    if (u.seo) payload.seo = u.seo;
    if (u.nauticManager) payload.nauticManager = u.nauticManager;

    if (Object.keys(payload).length > 0) {
      void api.patch('/settings', payload).catch(() => {
        void get().refresh();
      });
    }
  },

  addPartner: (p) => {
    const tmpId = tmpIdNow('partner');
    const optimistic: Partner = { id: tmpId, createdAt: new Date().toISOString(), ...p };
    set((s) => ({ partners: [optimistic, ...s.partners], updatedAt: todayIso() }));

    void api
      .post('/partners', {
        name: p.name,
        linkedOfferings: linkedOfferingsToApi(p.linkedOfferings),
        description: p.description ?? '',
        logoUrl: p.logoUrl ?? '',
        price: p.price ?? '',
        active: p.active ?? true,
        contactName: p.contactName ?? '',
        contactEmail: p.contactEmail ?? '',
        contactPhone: p.contactPhone ?? '',
        note: p.note ?? '',
        kind: partnerKindToApi(p.kind),
      })
      .then(({ data }) => {
        const real = partnerFromApi(data);
        set((s) => ({ partners: s.partners.map((x) => (x.id === tmpId ? real : x)) }));
      })
      .catch(() => {
        void get().refresh();
      });

    return tmpId;
  },
  updatePartner: (p) => {
    set((s) => ({
      partners: s.partners.map((x) => (x.id === p.id ? { ...x, ...p } : x)),
      updatedAt: todayIso(),
    }));
    void api
      .patch(`/partners/${p.id}`, {
        name: p.name,
        linkedOfferings: linkedOfferingsToApi(p.linkedOfferings),
        description: p.description,
        logoUrl: p.logoUrl,
        price: p.price,
        active: p.active,
        contactName: p.contactName,
        contactEmail: p.contactEmail,
        contactPhone: p.contactPhone,
        note: p.note,
        kind: partnerKindToApi(p.kind),
      })
      .catch(() => {
        void get().refresh();
      });
  },
  removePartner: (id) => {
    set((s) => ({ partners: s.partners.filter((x) => x.id !== id), updatedAt: todayIso() }));
    void api.delete(`/partners/${id}`).catch(() => {
      void get().refresh();
    });
  },

  addContract: (c) => {
    const tmpId = tmpIdNow('contract');
    const optimistic: Contract = { id: tmpId, createdAt: new Date().toISOString(), ...c };
    set((s) => ({ contracts: [optimistic, ...s.contracts], updatedAt: todayIso() }));
    void api
      .post('/contracts', c)
      .then(async ({ data }) => {
        const real = contractFromApi(data);
        const needsDefaults =
          !c.cancellationTerms?.trim() && !c.rentalTerms?.trim() && !c.description?.trim();
        if (needsDefaults) {
          try {
            const { data: filled } = await api.post(`/contracts/${real.id}/apply-default-template`);
            const withDefaults = contractFromApi(filled);
            set((s) => ({ contracts: s.contracts.map((x) => (x.id === tmpId ? withDefaults : x)) }));
            return;
          } catch {
            /* garde le contrat vide si l’API échoue */
          }
        }
        set((s) => ({ contracts: s.contracts.map((x) => (x.id === tmpId ? real : x)) }));
      })
      .catch(() => {
        void get().refresh();
      });
    return tmpId;
  },
  updateContract: (c) => {
    set((s) => ({
      contracts: s.contracts.map((x) => (x.id === c.id ? { ...x, ...c } : x)),
      updatedAt: todayIso(),
    }));
    void api.patch(`/contracts/${c.id}`, c).catch(() => {
      void get().refresh();
    });
  },
  removeContract: (id) => {
    set((s) => ({ contracts: s.contracts.filter((x) => x.id !== id), updatedAt: todayIso() }));
    void api.delete(`/contracts/${id}`).catch(() => {
      void get().refresh();
    });
  },
  applyDefaultContractTemplate: async (id) => {
    const { data } = await api.post(`/contracts/${id}/apply-default-template`);
    const updated = contractFromApi(data);
    set((s) => ({
      contracts: s.contracts.map((x) =>
        x.id === id
          ? { ...updated, linkedReservationsCount: x.linkedReservationsCount ?? updated.linkedReservationsCount }
          : x,
      ),
      updatedAt: todayIso(),
    }));
    return updated;
  },

  resetSettings: () => {
    set(() => ({ ...DEFAULT_SETTINGS, partners: [], contracts: [], hydrated: get().hydrated, updatedAt: todayIso() }));
    void api
      .patch('/settings', {
        company: DEFAULT_SETTINGS.company,
        bank: DEFAULT_SETTINGS.bank,
        notifications: notifPayloadFromState(DEFAULT_SETTINGS.notifications),
        booking: DEFAULT_SETTINGS.booking,
        email: DEFAULT_SETTINGS.emails,
        publicSite: DEFAULT_SETTINGS.publicSite,
        seo: DEFAULT_SETTINGS.seo,
        nauticManager: DEFAULT_SETTINGS.nauticManager,
      })
      .catch(() => {
        void get().refresh();
      });
  },
}));

function stripIdAndUpdatedAt<T extends Record<string, unknown>>(o: T | null | undefined): Partial<T> {
  if (!o) return {};
  const { id: _id, updatedAt: _u, ...rest } = o as any;
  return rest as Partial<T>;
}
