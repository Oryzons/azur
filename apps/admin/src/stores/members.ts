import { create } from 'zustand';
import { api } from '@/lib/api';

export type MemberRole = 'admin' | 'agent' | 'proprietaire' | 'client';

export type MemberBase = {
  id: string;
  role: MemberRole;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
  createdAt: string; // ISO
};

export type MemberAdmin = MemberBase & {
  role: 'admin';
  permissions: {
    manageMembers: boolean;
    manageBoats: boolean;
    manageReservations: boolean;
  };
};

export type MemberAgent = MemberBase & {
  role: 'agent';
  permissions: {
    manageMembers: boolean;
    manageBoats: boolean;
    manageReservations: boolean;
  };
};

export type MemberOwner = MemberBase & {
  role: 'proprietaire';
  ownerSince?: string | null;
  company?: string | null;
  iban?: string | null;
  address?: string | null;
};

export type ClientType = 'particulier' | 'professionnel' | 'association';
export type Civility = '' | 'M.' | 'Mme' | 'Mx';

export type MemberClient = MemberBase & {
  role: 'client';
  clientType: ClientType;
  civility: Civility;
  birthDate?: string | null;
  nationality?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  internalNote?: string | null;
  clientIdNumber?: string | null;
  licenseNumber?: string | null;
  cniFrontUrl?: string | null;
  cniBackUrl?: string | null;
  boatLicenseFrontUrl?: string | null;
  boatLicenseBackUrl?: string | null;
  airbusBadge?: string | null;
  airbusBadgePhotoUrl?: string | null;
};

export type Member = MemberAdmin | MemberAgent | MemberOwner | MemberClient;

export type AddMemberPayload = Omit<Member, 'id' | 'createdAt'>;
export type UpdateMemberPayload = Omit<Member, 'createdAt'>;

interface MembersState {
  members: Member[];
  hydrated: boolean;
  refresh: () => Promise<void>;
  addMember: (m: AddMemberPayload) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  updateMember: (m: UpdateMemberPayload) => Promise<{ ok: true } | { ok: false; error: string }>;
  removeMember: (id: string) => Promise<void>;
}

function tmpIdNow() {
  return `tmp_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

function isPersistedMemberId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function normalizeEmail(v: string) {
  return v.trim().toLowerCase();
}

export const useMembersStore = create<MembersState>()((set, get) => ({
  members: [],
  hydrated: false,

  refresh: async () => {
    const { data } = await api.get('/members');
    const members: Member[] = (Array.isArray(data) ? data : []).map(mapMemberFromApi);
    set({ members, hydrated: true });
  },

  addMember: async (m: AddMemberPayload) => {
    const firstName = m.firstName.trim();
    const lastName = m.lastName.trim();
    const email = normalizeEmail(m.email);
    if (!firstName || !lastName || !email) return { ok: false, error: 'Prénom, nom et email sont requis.' };
    if (!email.includes('@')) return { ok: false, error: 'Email invalide.' };

    const tmpId = tmpIdNow();
    const optimistic = {
      ...(m as any),
      id: tmpId,
      createdAt: new Date().toISOString(),
      firstName,
      lastName,
      email,
    } as Member;
    set((s) => ({ members: [optimistic, ...s.members] }));

    try {
      const { data } = await api.post('/members', memberToApiPayload({ ...m, firstName, lastName, email }));
      const real = mapMemberFromApi(data);
      set((s) => ({ members: s.members.map((x) => (x.id === tmpId ? real : x)) }));
      return { ok: true, id: real.id };
    } catch (e: any) {
      set((s) => ({ members: s.members.filter((x) => x.id !== tmpId) }));
      return { ok: false, error: extractApiError(e, 'Impossible de créer le membre.') };
    }
  },

  updateMember: async (m: UpdateMemberPayload) => {
    const firstName = m.firstName.trim();
    const lastName = m.lastName.trim();
    const email = normalizeEmail(m.email);
    if (!firstName || !lastName || !email) return { ok: false, error: 'Prénom, nom et email sont requis.' };
    if (!email.includes('@')) return { ok: false, error: 'Email invalide.' };

    const prev = get().members.find((x) => x.id === m.id);
    if (!prev) return { ok: false, error: 'Membre introuvable.' };

    set((s) => ({
      members: s.members.map((x) =>
        x.id === m.id ? ({ ...(x as any), ...(m as any), firstName, lastName, email } as Member) : x,
      ),
    }));

    if (!isPersistedMemberId(m.id)) {
      return { ok: true };
    }

    try {
      const { data } = await api.put(`/members/${m.id}`, memberToApiPayload({ ...m, firstName, lastName, email }));
      const real = mapMemberFromApi(data);
      set((s) => ({ members: s.members.map((x) => (x.id === m.id ? real : x)) }));
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: extractApiError(e, 'Impossible de modifier le membre.') };
    }
  },

  removeMember: async (id: string) => {
    set((s) => ({ members: s.members.filter((m) => m.id !== id) }));
    try {
      await api.delete(`/members/${id}`);
    } catch {
      void get().refresh();
    }
  },
}));

function extractApiError(e: any, fallback: string): string {
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(' ') || fallback;
  if (typeof msg === 'string') return msg;
  return fallback;
}

function roleToApi(r: MemberRole): 'ADMIN' | 'AGENT' | 'OWNER' | 'CLIENT' {
  if (r === 'admin') return 'ADMIN';
  if (r === 'agent') return 'AGENT';
  if (r === 'proprietaire') return 'OWNER';
  return 'CLIENT';
}
function roleFromApi(r: string): MemberRole {
  if (r === 'ADMIN') return 'admin';
  if (r === 'AGENT') return 'agent';
  if (r === 'OWNER') return 'proprietaire';
  return 'client';
}
function clientTypeToApi(t: ClientType | null | undefined): 'PARTICULIER' | 'PROFESSIONNEL' | 'ASSOCIATION' | null {
  if (t === 'professionnel') return 'PROFESSIONNEL';
  if (t === 'association') return 'ASSOCIATION';
  if (t === 'particulier') return 'PARTICULIER';
  return null;
}
function clientTypeFromApi(t: string | null | undefined): ClientType {
  if (t === 'PROFESSIONNEL') return 'professionnel';
  if (t === 'ASSOCIATION') return 'association';
  return 'particulier';
}
function civilityToApi(c: Civility | null | undefined): 'NONE' | 'M' | 'MME' | 'MX' | null {
  if (c === 'M.') return 'M';
  if (c === 'Mme') return 'MME';
  if (c === 'Mx') return 'MX';
  if (c === '' || c == null) return null;
  return null;
}
function civilityFromApi(c: string | null | undefined): Civility {
  if (c === 'M') return 'M.';
  if (c === 'MME') return 'Mme';
  if (c === 'MX') return 'Mx';
  return '';
}

function memberToApiPayload(m: any) {
  const role = roleToApi(m.role);
  const base: Record<string, unknown> = {
    role,
    firstName: m.firstName,
    lastName: m.lastName,
    email: m.email,
    phone: m.phone ?? null,
    isActive: m.isActive ?? true,
  };
  if (m.role === 'proprietaire') {
    base.ownerSince = m.ownerSince ? new Date(`${m.ownerSince}T00:00:00.000Z`).toISOString() : null;
    base.ownerCompany = m.company ?? null;
    base.ownerIban = m.iban ?? null;
    base.ownerAddress = m.address ?? null;
  }
  if (m.role === 'client') {
    base.clientType = clientTypeToApi(m.clientType);
    base.civility = civilityToApi(m.civility);
    base.birthDate = m.birthDate ? new Date(`${m.birthDate}T00:00:00.000Z`).toISOString() : null;
    base.nationality = m.nationality ?? null;
    base.address = m.address ?? null;
    base.city = m.city ?? null;
    base.postalCode = m.postalCode ?? null;
    base.country = m.country ?? null;
    base.internalNote = m.internalNote ?? null;
    base.cniFrontUrl = m.cniFrontUrl ?? null;
    base.cniBackUrl = m.cniBackUrl ?? null;
    base.boatLicenseFrontUrl = m.boatLicenseFrontUrl ?? null;
    base.boatLicenseBackUrl = m.boatLicenseBackUrl ?? null;
    base.airbusBadge = m.airbusBadge?.trim() || null;
    base.airbusBadgePhotoUrl = m.airbusBadgePhotoUrl ?? null;
  }
  if (m.role === 'admin') {
    const p = m.permissions ?? {};
    base.permManageMembers = Boolean(p.manageMembers);
    base.permManageBoats = Boolean(p.manageBoats);
    base.permManageReservations = Boolean(p.manageReservations);
  }
  if (m.role === 'agent') {
    base.permManageMembers = false;
    base.permManageBoats = false;
    base.permManageReservations = false;
  }
  return base;
}

function mapMemberFromApi(x: any): Member {
  const role = roleFromApi(String(x?.role ?? 'CLIENT'));
  const base: MemberBase = {
    id: String(x?.id ?? ''),
    role,
    firstName: String(x?.firstName ?? ''),
    lastName: String(x?.lastName ?? ''),
    email: String(x?.email ?? ''),
    phone: x?.phone ?? null,
    isActive: Boolean(x?.isActive ?? true),
    createdAt: x?.createdAt ? new Date(x.createdAt).toISOString() : new Date().toISOString(),
  };
  if (role === 'proprietaire') {
    return {
      ...base,
      role: 'proprietaire',
      ownerSince: x?.ownerSince ? new Date(x.ownerSince).toISOString().slice(0, 10) : null,
      company: x?.ownerCompany ?? null,
      iban: x?.ownerIban ?? null,
      address: x?.ownerAddress ?? null,
    };
  }
  if (role === 'client') {
    return {
      ...base,
      role: 'client',
      clientType: clientTypeFromApi(x?.clientType),
      civility: civilityFromApi(x?.civility),
      birthDate: x?.birthDate ? new Date(x.birthDate).toISOString().slice(0, 10) : null,
      nationality: x?.nationality ?? null,
      address: x?.address ?? null,
      city: x?.city ?? null,
      postalCode: x?.postalCode ?? null,
      country: x?.country ?? null,
      internalNote: x?.internalNote ?? null,
      clientIdNumber: x?.clientIdNumber ?? null,
      licenseNumber: x?.licenseNumber ?? null,
      cniFrontUrl: x?.cniFrontUrl ?? null,
      cniBackUrl: x?.cniBackUrl ?? null,
      boatLicenseFrontUrl: x?.boatLicenseFrontUrl ?? null,
      boatLicenseBackUrl: x?.boatLicenseBackUrl ?? null,
      airbusBadge: x?.airbusBadge ?? null,
      airbusBadgePhotoUrl: x?.airbusBadgePhotoUrl ?? null,
    };
  }
  return {
    ...base,
    role,
    permissions: {
      manageMembers: Boolean(x?.permManageMembers ?? false),
      manageBoats: Boolean(x?.permManageBoats ?? false),
      manageReservations: Boolean(x?.permManageReservations ?? false),
    },
  } as MemberAdmin | MemberAgent;
}
