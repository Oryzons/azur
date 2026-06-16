import { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  History,
  IdCard,
  Plus,
  Search,
  Shield,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RoundCheckbox } from '@/components/RoundCheckbox';
import { ContentReveal } from '@/components/ui/ContentReveal';
import { ThreeStepGuide } from '@/components/ui/ThreeStepGuide';
import { MembersPageSkeleton } from '@/components/skeletons/MembersPageSkeleton';
import { MembersNauticImportModal } from '@/components/members/MembersNauticImportModal';
import { MemberAvatar, MemberRoleBadge } from '@/components/members/MemberRoleBadge';
import { ClientReservationHistory } from '@/components/reservations/ClientReservationHistory';
import {
  CONTRACT_DOCUMENT_ACCEPT,
  DocumentFilePreview,
} from '@/components/contract/DocumentFilePreview';
import {
  birthDateFromIso,
  birthDateToIso,
  extractApiErrorMessage,
  formatBirthDateInput,
  inputCls,
  memberSearchHaystack,
  ROLE_LABELS,
  ROLE_STYLES,
  todayIso,
} from '@/lib/memberUi';
import { documentUploadErrorMessage, fileToUploadDataUrl } from '@/lib/documentUpload';
import { formatPhoneInput } from '@/lib/phone';
import { api } from '@/lib/api';
import { usePageFiltersPanel, type PageFiltersConfig } from '@/contexts/PageFiltersContext';
import { usePersistedEnum, usePersistedString } from '@/lib/pageFilterStorage';
import { useAuthStore } from '@/stores/auth';
import { useBoatsStore } from '@/stores/boats';
import {
  useMembersStore,
  type Civility,
  type ClientType,
  type Member,
  type MemberRole,
  type UpdateMemberPayload,
} from '@/stores/members';

const CREATE_ID = '__new__';
const PSEUDO_ID = '__current_user__';

type EditorSection = 'identity' | 'profile' | 'documents' | 'history';
type RoleFilter = MemberRole | 'all';
type ActiveFilter = 'all' | 'active' | 'inactive';

type MemberDraft = {
  role: MemberRole;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isActive: boolean;
  clientType: ClientType;
  civility: Civility;
  birthDate: string;
  nationality: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  internalNote: string;
  cniFrontUrl: string;
  cniBackUrl: string;
  boatLicenseFrontUrl: string;
  boatLicenseBackUrl: string;
  airbusBadge: string;
  airbusBadgePhotoUrl: string;
  company: string;
  iban: string;
  ownerSince: string;
  ownerAddress: string;
  pManageMembers: boolean;
  pManageBoats: boolean;
  pManageReservations: boolean;
  pComptabilite: boolean;
  adminPassword: string;
};

function emptyDraft(role: MemberRole = 'client'): MemberDraft {
  return {
    role,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    isActive: true,
    clientType: 'particulier',
    civility: '',
    birthDate: '',
    nationality: 'France',
    address: '',
    city: '',
    postalCode: '',
    country: '',
    internalNote: '',
    cniFrontUrl: '',
    cniBackUrl: '',
    boatLicenseFrontUrl: '',
    boatLicenseBackUrl: '',
    airbusBadge: '',
    airbusBadgePhotoUrl: '',
    company: '',
    iban: '',
    ownerSince: todayIso(),
    ownerAddress: '',
    pManageMembers: true,
    pManageBoats: true,
    pManageReservations: true,
    pComptabilite: false,
    adminPassword: '',
  };
}

async function upsertOwnerPortalAccess(
  memberId: string,
  email: string,
  password: string,
): Promise<'created' | 'reset'> {
  try {
    await api.post('/users/owner-portal', {
      memberId,
      email: email.trim(),
      password,
      mustChangePassword: true,
    });
    return 'created';
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    const msg = extractApiErrorMessage(e);
    if (status === 409 && /compte portail existe déjà/i.test(msg)) {
      await api.patch(`/users/owner-portal/${memberId}/password`, {
        password,
        mustChangePassword: true,
      });
      return 'reset';
    }
    throw e;
  }
}

function memberToDraft(m: Member): MemberDraft {
  const base = emptyDraft(m.role);
  base.firstName = m.firstName;
  base.lastName = m.lastName;
  base.email = m.email;
  base.phone = m.phone ?? '';
  base.isActive = Boolean(m.isActive);

  if (m.role === 'client') {
    base.clientType = m.clientType;
    base.civility = m.civility;
    base.birthDate = birthDateFromIso(m.birthDate);
    base.nationality = m.nationality ?? 'France';
    base.address = m.address ?? '';
    base.city = m.city ?? '';
    base.postalCode = m.postalCode ?? '';
    base.country = m.country ?? '';
    base.internalNote = m.internalNote ?? '';
    base.cniFrontUrl = m.cniFrontUrl ?? '';
    base.cniBackUrl = m.cniBackUrl ?? '';
    base.boatLicenseFrontUrl = m.boatLicenseFrontUrl ?? '';
    base.boatLicenseBackUrl = m.boatLicenseBackUrl ?? '';
    base.airbusBadge = m.airbusBadge?.trim() ? m.airbusBadge.trim().toUpperCase() : '';
    base.airbusBadgePhotoUrl = m.airbusBadgePhotoUrl ?? '';
  }
  if (m.role === 'proprietaire') {
    base.ownerSince = m.ownerSince ?? todayIso();
    base.company = m.company ?? '';
    base.iban = m.iban ?? '';
    base.ownerAddress = m.address ?? '';
  }
  if (m.role === 'admin') {
    base.pManageMembers = Boolean(m.permissions.manageMembers);
    base.pManageBoats = Boolean(m.permissions.manageBoats);
    base.pManageReservations = Boolean(m.permissions.manageReservations);
    base.pComptabilite = Boolean(m.permissions.comptabilite);
  }
  return base;
}

function buildPayloadFromDraft(d: MemberDraft) {
  const base = {
    role: d.role,
    firstName: d.firstName,
    lastName: d.lastName,
    email: d.email,
    phone: d.phone.trim() ? d.phone.trim() : null,
    isActive: d.isActive,
  } as const;

  if (d.role === 'client') {
    return {
      ...base,
      role: 'client' as const,
      clientType: d.clientType,
      civility: d.civility,
      birthDate: birthDateToIso(d.birthDate),
      nationality: d.nationality.trim() || null,
      address: d.address.trim() || null,
      city: d.city.trim() || null,
      postalCode: d.postalCode.trim() || null,
      country: d.country.trim() || null,
      internalNote: d.internalNote.trim() || null,
      cniFrontUrl: d.cniFrontUrl.trim() || null,
      cniBackUrl: d.cniBackUrl.trim() || null,
      boatLicenseFrontUrl: d.boatLicenseFrontUrl.trim() || null,
      boatLicenseBackUrl: d.boatLicenseBackUrl.trim() || null,
      airbusBadge: d.airbusBadge.trim() ? d.airbusBadge.trim().replaceAll(/\s+/g, '').toUpperCase() : null,
      airbusBadgePhotoUrl: d.airbusBadgePhotoUrl.trim() || null,
    };
  }
  if (d.role === 'proprietaire') {
    return {
      ...base,
      role: 'proprietaire' as const,
      ownerSince: d.ownerSince.trim() || todayIso(),
      company: d.company.trim() || null,
      iban: d.iban.trim() || null,
      address: d.ownerAddress.trim() || null,
    };
  }
  if (d.role === 'admin') {
    return {
      ...base,
      role: 'admin' as const,
      permissions: {
        manageMembers: d.pManageMembers,
        manageBoats: d.pManageBoats,
        manageReservations: d.pManageReservations,
        comptabilite: d.pComptabilite,
      },
    };
  }
  if (d.role === 'daf') {
    return { ...base, role: 'daf' as const };
  }
  return {
    ...base,
    role: 'agent' as const,
    permissions: { manageMembers: false, manageBoats: false, manageReservations: false },
  };
}

function draftToUpdatePayload(d: MemberDraft, id: string): UpdateMemberPayload {
  return { ...buildPayloadFromDraft(d), id } as UpdateMemberPayload;
}

function FieldLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{children}</span>;
}

function sectionsForRole(role: MemberRole, isCreating: boolean): { id: EditorSection; label: string; Icon: typeof User }[] {
  const tabs: { id: EditorSection; label: string; Icon: typeof User }[] = [
    { id: 'identity', label: 'Identité', Icon: User },
    { id: 'profile', label: role === 'client' ? 'Client' : role === 'proprietaire' ? 'Propriétaire' : role === 'admin' ? 'Permissions' : role === 'daf' ? 'Comptabilité' : 'Agent', Icon: Shield },
  ];
  if (role === 'client') {
    tabs.push({ id: 'documents', label: 'Pièces', Icon: IdCard });
    if (!isCreating) tabs.push({ id: 'history', label: 'Réservations', Icon: History });
  }
  return tabs;
}

function MembersFiltersSheetBody(props: Readonly<{
  roleFilter: RoleFilter;
  setRoleFilter: (v: RoleFilter) => void;
  activeFilter: ActiveFilter;
  setActiveFilter: (v: ActiveFilter) => void;
  search: string;
  setSearch: (v: string) => void;
  counts: Record<'all' | MemberRole, number>;
}>) {
  const { roleFilter, setRoleFilter, activeFilter, setActiveFilter, search, setSearch, counts } = props;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Rôle</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['all', 'admin', 'agent', 'daf', 'proprietaire', 'client'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setRoleFilter(k)}
              className={[
                'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                roleFilter === k ? 'bg-[#416B9F] text-white shadow-sm' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200',
              ].join(' ')}
            >
              {k === 'all' ? 'Tous' : ROLE_LABELS[k]} ({counts[k]})
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Statut</p>
        <div className="mt-2 flex flex-wrap gap-2">
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
              onClick={() => setActiveFilter(f.id)}
              className={[
                'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                activeFilter === f.id ? 'bg-[#416B9F] text-white' : 'bg-zinc-100 text-zinc-700',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Recherche</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} className={inputCls()} placeholder="Email, prénom ou nom…" />
      </label>
      <button
        type="button"
        onClick={() => {
          setRoleFilter('all');
          setActiveFilter('all');
          setSearch('');
        }}
        className="w-full rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
      >
        Réinitialiser les filtres
      </button>
    </div>
  );
}

export function MembersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const authUser = useAuthStore((s) => s.user);
  const members = useMembersStore((s) => s.members);
  const hydrated = useMembersStore((s) => s.hydrated);
  const refresh = useMembersStore((s) => s.refresh);
  const addMember = useMembersStore((s) => s.addMember);
  const updateMember = useMembersStore((s) => s.updateMember);
  const removeMember = useMembersStore((s) => s.removeMember);
  const boats = useBoatsStore((s) => s.boats);
  const boatsHydrated = useBoatsStore((s) => s.hydrated);
  const refreshBoats = useBoatsStore((s) => s.refresh);

  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = usePersistedString('members.search');
  const [roleFilter, setRoleFilter] = usePersistedEnum<RoleFilter>(
    'members.roleFilter',
    'all',
    ['all', 'admin', 'agent', 'daf', 'proprietaire', 'client'],
  );
  const [activeFilter, setActiveFilter] = usePersistedEnum<ActiveFilter>(
    'members.activeFilter',
    'all',
    ['all', 'active', 'inactive'],
  );
  const [section, setSection] = useState<EditorSection>('identity');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState<MemberDraft>(() => emptyDraft());
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [ownerPortalPassword, setOwnerPortalPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [portalSaving, setPortalSaving] = useState(false);

  useEffect(() => {
    if (!hydrated) void refresh();
  }, [hydrated, refresh]);

  useEffect(() => {
    if (!boatsHydrated) void refreshBoats();
  }, [boatsHydrated, refreshBoats]);

  const currentUserEmail = authUser?.email ?? '';
  const currentUserDisplayId = useMemo(() => {
    if (!currentUserEmail) return null;
    const inStore = members.some((m) => m.email.toLowerCase() === currentUserEmail.toLowerCase());
    return inStore ? null : PSEUDO_ID;
  }, [currentUserEmail, members]);

  const membersForDisplay = useMemo(() => {
    if (!currentUserDisplayId) return members;
    const pseudo: Member = {
      id: currentUserDisplayId,
      role: 'admin',
      firstName: authUser?.firstName || 'Utilisateur',
      lastName: authUser?.lastName || 'connecté',
      email: currentUserEmail,
      phone: authUser?.phone ?? null,
      isActive: Boolean(authUser?.isActive ?? true),
      createdAt: new Date().toISOString(),
      permissions: { manageMembers: true, manageBoats: true, manageReservations: true, comptabilite: false },
    };
    return [pseudo, ...members];
  }, [authUser, currentUserDisplayId, currentUserEmail, members]);

  const sorted = useMemo(
    () =>
      [...membersForDisplay].sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr'),
      ),
    [membersForDisplay],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((m) => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;
      if (activeFilter === 'active' && !m.isActive) return false;
      if (activeFilter === 'inactive' && m.isActive) return false;
      if (!q) return true;
      return memberSearchHaystack(m).includes(q);
    });
  }, [sorted, roleFilter, activeFilter, search]);

  const isCreating = selectedId === CREATE_ID;
  const selected = useMemo(() => {
    if (isCreating) return null;
    return membersForDisplay.find((m) => m.id === selectedId) ?? null;
  }, [isCreating, membersForDisplay, selectedId]);

  const readOnly = Boolean(selected?.id === PSEUDO_ID || (currentUserDisplayId && selected?.id === currentUserDisplayId));

  useEffect(() => {
    if (membersForDisplay.length === 0 && !isCreating) {
      setSelectedId('');
      return;
    }
    if (!isCreating && selectedId && !membersForDisplay.some((m) => m.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? sorted[0]?.id ?? '');
    }
  }, [membersForDisplay, selectedId, filtered, sorted, isCreating]);

  const boatNamesByOwnerId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const b of boats) {
      if (!b.ownerId) continue;
      const label = b.name?.trim() || `${b.brand ?? ''} ${b.model ?? ''}`.trim() || b.id;
      const prev = map.get(b.ownerId);
      if (prev) prev.push(label);
      else map.set(b.ownerId, [label]);
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => a.localeCompare(b, 'fr'));
      map.set(k, list);
    }
    return map;
  }, [boats]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: membersForDisplay.length, admin: 0, agent: 0, daf: 0, proprietaire: 0, client: 0 };
    for (const m of membersForDisplay) c[m.role] += 1;
    return c as Record<'all' | MemberRole, number>;
  }, [membersForDisplay]);

  const stats = useMemo(
    () => ({
      total: membersForDisplay.length,
      active: membersForDisplay.filter((m) => m.isActive).length,
      clients: membersForDisplay.filter((m) => m.role === 'client').length,
    }),
    [membersForDisplay],
  );

  const membersFiltersActiveCount =
    (roleFilter === 'all' ? 0 : 1) + (activeFilter === 'all' ? 0 : 1) + (search.trim() ? 1 : 0);

  function resetMembersFilters() {
    setRoleFilter('all');
    setActiveFilter('all');
    setSearch('');
  }

  const membersFiltersPanel = useMemo(
    () => (
      <MembersFiltersSheetBody
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        search={search}
        setSearch={setSearch}
        counts={counts}
      />
    ),
    [roleFilter, activeFilter, search, counts],
  );

  const membersFiltersConfig = useMemo<PageFiltersConfig>(
    () => ({
      title: 'Membres',
      subtitle: 'Rôle, statut et recherche.',
      activeFilterCount: membersFiltersActiveCount,
      panelBody: membersFiltersPanel,
    }),
    [membersFiltersActiveCount, membersFiltersPanel],
  );

  usePageFiltersPanel(membersFiltersConfig);

  const editorRole = isCreating ? createDraft.role : (selected?.role ?? 'client');
  const tabs = sectionsForRole(editorRole, isCreating);

  useEffect(() => {
    if (!tabs.some((t) => t.id === section)) setSection('identity');
  }, [tabs, section]);

  useEffect(() => {
    setOwnerPortalPassword('');
  }, [selectedId]);

  function startCreate(role: MemberRole = 'client') {
    setFormError('');
    setSuccess('');
    setConfirmDeleteId(null);
    setCreateDraft(emptyDraft(role));
    setSelectedId(CREATE_ID);
    setSection('identity');
    setShowAdminPassword(false);
    setOwnerPortalPassword('');
  }

  async function handleSaveOwnerPortal() {
    if (!selected || selected.role !== 'proprietaire' || readOnly) return;
    const pwd = ownerPortalPassword.trim();
    if (pwd.length < 8) {
      setFormError('Mot de passe portail : au moins 8 caractères.');
      return;
    }
    setFormError('');
    setSuccess('');
    setPortalSaving(true);
    try {
      const kind = await upsertOwnerPortalAccess(selected.id, selected.email, pwd);
      setSuccess(
        kind === 'created'
          ? 'Accès portail créé. Le propriétaire devra changer son mot de passe à la première connexion.'
          : 'Mot de passe portail mis à jour (changement demandé à la prochaine connexion).',
      );
      setOwnerPortalPassword('');
    } catch (e: unknown) {
      setFormError(`Accès portail : ${extractApiErrorMessage(e)}`);
    } finally {
      setPortalSaving(false);
    }
  }

  async function patchSelected(patch: Partial<UpdateMemberPayload>) {
    if (!selected || readOnly) return;
    setFormError('');
    const res = await updateMember({ ...selected, ...patch } as UpdateMemberPayload);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    if (currentUserEmail && selected.email.trim().toLowerCase() === currentUserEmail.toLowerCase()) {
      try {
        const { data } = await api.get('/auth/me');
        const { accessToken, refreshToken } = useAuthStore.getState();
        if (accessToken && refreshToken) {
          useAuthStore.getState().setSession({ accessToken, refreshToken, user: data });
        }
      } catch {
        /* ignore */
      }
    }
  }

  async function handleCreate() {
    setFormError('');
    setSuccess('');
    const payload = buildPayloadFromDraft(createDraft);
    setSaving(true);
    try {
      if (payload.role === 'admin' || payload.role === 'agent') {
        const staffRole = payload.role === 'admin' ? 'ADMIN' : 'AGENT';
        const roleLabel = payload.role === 'admin' ? 'Admin' : 'Agent';
        if (createDraft.adminPassword.trim().length < 8) {
          setFormError(`${roleLabel} : le mot de passe doit faire au moins 8 caractères.`);
          return;
        }
        try {
          await api.post('/users/staff', {
            email: payload.email,
            password: createDraft.adminPassword,
            firstName: payload.firstName,
            lastName: payload.lastName,
            role: staffRole,
            mustChangePassword: true,
          });
        } catch (e: unknown) {
          const status = (e as { response?: { status?: number } })?.response?.status;
          if (status !== 409) {
            setFormError(`Création du compte de connexion impossible : ${extractApiErrorMessage(e)}`);
            return;
          }
          setSuccess('Un compte de connexion existait déjà pour cet email — réutilisé.');
        }
      }
      if (payload.role === 'proprietaire') {
        if (createDraft.adminPassword.trim().length < 8) {
          setFormError('Propriétaire : le mot de passe portail doit faire au moins 8 caractères.');
          return;
        }
      }
      const res = await addMember(payload);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      if (payload.role === 'proprietaire') {
        try {
          const kind = await upsertOwnerPortalAccess(res.id, payload.email, createDraft.adminPassword.trim());
          setSuccess(
            kind === 'created'
              ? 'Propriétaire et accès portail créés (changement de mot de passe à la première connexion).'
              : 'Propriétaire ajouté, mot de passe portail mis à jour.',
          );
        } catch (e: unknown) {
          setFormError(
            `Propriétaire enregistré, mais accès portail impossible : ${extractApiErrorMessage(e)}`,
          );
          setSelectedId(res.id);
          return;
        }
      } else {
        setSuccess('Membre ajouté.');
      }
      setSelectedId(res.id);
    } finally {
      setSaving(false);
    }
  }

  function removeMemberSafe(id: string) {
    if (id === PSEUDO_ID || (currentUserDisplayId && id === currentUserDisplayId)) return;
    const m = members.find((x) => x.id === id);
    if (currentUserEmail && m?.email.toLowerCase() === currentUserEmail.toLowerCase()) return;
    void removeMember(id);
    setConfirmDeleteId(null);
    if (selectedId === id) setSelectedId('');
  }

  useEffect(() => {
    const create = searchParams.get('create');
    if (create !== '1') return;
    const roleParam = searchParams.get('role');
    const role: MemberRole =
      roleParam === 'proprietaire' || roleParam === 'client' || roleParam === 'admin' || roleParam === 'agent' || roleParam === 'daf'
        ? roleParam
        : 'client';
    const draft = emptyDraft(role);
    draft.firstName = searchParams.get('firstName') ?? '';
    draft.lastName = searchParams.get('lastName') ?? '';
    draft.email = searchParams.get('email') ?? '';
    draft.phone = searchParams.get('phone') ?? '';
    draft.ownerSince = searchParams.get('ownerSince') ?? todayIso();
    draft.company = searchParams.get('company') ?? '';
    draft.iban = searchParams.get('iban') ?? '';
    draft.ownerAddress = searchParams.get('address') ?? '';
    setCreateDraft(draft);
    setSelectedId(CREATE_ID);
    setSection('identity');

    const next = new URLSearchParams(searchParams);
    for (const k of ['create', 'role', 'firstName', 'lastName', 'email', 'phone', 'ownerSince', 'company', 'iban', 'address']) {
      next.delete(k);
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Permet d'ouvrir directement un membre depuis une autre page (ex: détail réservation).
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId) return;
    setSelectedId(openId);
    setSection('identity');
    const next = new URLSearchParams(searchParams);
    next.delete('open');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const displayName = isCreating
    ? `${createDraft.firstName} ${createDraft.lastName}`.trim() || 'Nouveau membre'
    : selected
      ? `${selected.firstName} ${selected.lastName}`.trim()
      : '';

  function renderIdentityFields(
    data: MemberDraft,
    onChange: (patch: Partial<MemberDraft>) => void,
    disabled: boolean,
  ) {
    return (
      <div className="space-y-4">
        <label className="block">
          <FieldLabel>Rôle</FieldLabel>
          <select
            value={data.role}
            disabled={disabled || (!isCreating && Boolean(selected))}
            onChange={(e) => onChange({ role: e.target.value as MemberRole })}
            className={inputCls()}
          >
            <option value="client">Client</option>
            <option value="proprietaire">Propriétaire</option>
            <option value="admin">Admin</option>
            <option value="agent">Agent</option>
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <FieldLabel>Prénom *</FieldLabel>
            <input
              value={data.firstName}
              disabled={disabled}
              onChange={(e) => onChange({ firstName: e.target.value })}
              className={inputCls()}
            />
          </label>
          <label className="block">
            <FieldLabel>Nom *</FieldLabel>
            <input
              value={data.lastName}
              disabled={disabled}
              onChange={(e) => onChange({ lastName: e.target.value })}
              className={inputCls()}
            />
          </label>
          <label className="block sm:col-span-2">
            <FieldLabel>Email *</FieldLabel>
            <input
              value={data.email}
              disabled={disabled}
              onChange={(e) => onChange({ email: e.target.value })}
              className={inputCls()}
              placeholder="ex: prenom.nom@email.com"
            />
          </label>
          <label className="block sm:col-span-2">
            <FieldLabel>Téléphone</FieldLabel>
            <input
              value={data.phone}
              disabled={disabled}
              onChange={(e) => onChange({ phone: formatPhoneInput(e.target.value) })}
              className={inputCls()}
              inputMode="tel"
            />
          </label>
        </div>

        {(data.role === 'admin' || data.role === 'agent' || data.role === 'proprietaire') && isCreating ? (
          <div className="rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Connexion</p>
            <p className="mt-1 text-xs text-zinc-500">
              {data.role === 'agent'
                ? 'Mot de passe tablette (check-in / check-out). Changement demandé à la première connexion.'
                : data.role === 'proprietaire'
                  ? 'Accès portail (calendrier et indisponibilités). Le propriétaire devra changer ce mot de passe à la première connexion.'
                  : 'Mot de passe back-office. Changement demandé à la première connexion.'}
            </p>
            <label className="mt-3 block">
              <FieldLabel>Mot de passe *</FieldLabel>
              <div className="relative">
                <input
                  value={data.adminPassword}
                  onChange={(e) => onChange({ adminPassword: e.target.value })}
                  className={[inputCls(), 'pr-11'].join(' ')}
                  type={showAdminPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Au moins 8 caractères"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-500 hover:bg-white"
                  aria-label={showAdminPassword ? 'Masquer' : 'Afficher'}
                >
                  {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
          </div>
        ) : null}
      </div>
    );
  }

  function renderProfileFields(
    data: MemberDraft,
    onChange: (patch: Partial<MemberDraft>) => void,
    disabled: boolean,
  ) {
    if (data.role === 'client') {
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <FieldLabel>Type de client</FieldLabel>
            <select
              value={data.clientType}
              disabled={disabled}
              onChange={(e) => onChange({ clientType: e.target.value as ClientType })}
              className={inputCls()}
            >
              <option value="particulier">Particulier</option>
              <option value="professionnel">Professionnel</option>
              <option value="association">Association</option>
            </select>
          </label>
          <label className="block">
            <FieldLabel>Civilité</FieldLabel>
            <select
              value={data.civility}
              disabled={disabled}
              onChange={(e) => onChange({ civility: e.target.value as Civility })}
              className={inputCls()}
            >
              <option value="">—</option>
              <option value="M.">M.</option>
              <option value="Mme">Mme</option>
              <option value="Mx">Mx</option>
            </select>
          </label>
          <label className="block">
            <FieldLabel>Date de naissance</FieldLabel>
            <input
              value={data.birthDate}
              disabled={disabled}
              onChange={(e) => onChange({ birthDate: formatBirthDateInput(e.target.value) })}
              className={inputCls()}
              placeholder="JJ/MM/AAAA"
              inputMode="numeric"
            />
          </label>
          <label className="block">
            <FieldLabel>Nationalité</FieldLabel>
            <input value={data.nationality} disabled={disabled} onChange={(e) => onChange({ nationality: e.target.value })} className={inputCls()} />
          </label>
          <label className="block sm:col-span-2">
            <FieldLabel>Adresse</FieldLabel>
            <input value={data.address} disabled={disabled} onChange={(e) => onChange({ address: e.target.value })} className={inputCls()} />
          </label>
          <label className="block">
            <FieldLabel>Ville</FieldLabel>
            <input value={data.city} disabled={disabled} onChange={(e) => onChange({ city: e.target.value })} className={inputCls()} />
          </label>
          <label className="block">
            <FieldLabel>Code postal</FieldLabel>
            <input value={data.postalCode} disabled={disabled} onChange={(e) => onChange({ postalCode: e.target.value })} className={inputCls()} />
          </label>
          <label className="block sm:col-span-2">
            <FieldLabel>Pays</FieldLabel>
            <input value={data.country} disabled={disabled} onChange={(e) => onChange({ country: e.target.value })} className={inputCls()} />
          </label>
          <label className="block sm:col-span-2">
            <FieldLabel>Note interne</FieldLabel>
            <textarea
              value={data.internalNote}
              disabled={disabled}
              onChange={(e) => onChange({ internalNote: e.target.value })}
              rows={4}
              className={inputCls()}
            />
          </label>
          <label className="block sm:col-span-2">
            <FieldLabel>N° badge Airbus</FieldLabel>
            <input
              value={data.airbusBadge}
              disabled={disabled}
              onChange={(e) =>
                onChange({ airbusBadge: e.target.value.toUpperCase().replaceAll(/\s+/g, '') })
              }
              className={`${inputCls()} font-mono`}
              placeholder="Ex. A345678"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Numéro texte pour les coupons partenaire Airbus. La photo du badge se joint ci-dessous.
            </p>
          </label>
        </div>
      );
    }
    if (data.role === 'proprietaire') {
      return (
        <div className="grid gap-4">
          <label className="block">
            <FieldLabel>Propriétaire depuis</FieldLabel>
            <input
              type="date"
              value={data.ownerSince}
              disabled={disabled}
              onChange={(e) => onChange({ ownerSince: e.target.value })}
              className={inputCls()}
            />
          </label>
          <label className="block">
            <FieldLabel>Société</FieldLabel>
            <input value={data.company} disabled={disabled} onChange={(e) => onChange({ company: e.target.value })} className={inputCls()} />
          </label>
          <label className="block">
            <FieldLabel>IBAN</FieldLabel>
            <input value={data.iban} disabled={disabled} onChange={(e) => onChange({ iban: e.target.value })} className={inputCls()} />
          </label>
          <label className="block">
            <FieldLabel>Adresse</FieldLabel>
            <input value={data.ownerAddress} disabled={disabled} onChange={(e) => onChange({ ownerAddress: e.target.value })} className={inputCls()} />
          </label>
          {!disabled && !isCreating && selected?.role === 'proprietaire' ? (
            <div className="rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-4 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Accès portail</p>
              <p className="mt-1 text-xs text-zinc-500">
                Connexion avec l’email du membre ({selected.email}). Crée le compte ou réinitialise le mot de passe.
                Changement obligatoire à la prochaine connexion.
              </p>
              <label className="mt-3 block">
                <FieldLabel>Nouveau mot de passe portail</FieldLabel>
                <div className="relative">
                  <input
                    value={ownerPortalPassword}
                    onChange={(e) => setOwnerPortalPassword(e.target.value)}
                    className={[inputCls(), 'pr-11'].join(' ')}
                    type={showAdminPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Au moins 8 caractères"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-500 hover:bg-white"
                    aria-label={showAdminPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <button
                type="button"
                disabled={portalSaving}
                onClick={() => void handleSaveOwnerPortal()}
                className="mt-3 rounded-xl bg-[#416B9F] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#365b87] disabled:opacity-60"
              >
                {portalSaving ? 'Enregistrement…' : 'Créer ou réinitialiser l’accès portail'}
              </button>
            </div>
          ) : null}
        </div>
      );
    }
    if (data.role === 'admin') {
      return (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500">Permissions back-office</p>
          {[
            { label: 'Gérer les membres', v: data.pManageMembers, k: 'pManageMembers' as const },
            { label: 'Gérer les bateaux', v: data.pManageBoats, k: 'pManageBoats' as const },
            { label: 'Gérer les réservations', v: data.pManageReservations, k: 'pManageReservations' as const },
            {
              label: 'Accès comptabilité (DAF)',
              v: data.pComptabilite,
              k: 'pComptabilite' as const,
              hint: 'Menu Comptabilité : rapports financiers et encaissements Stripe.',
            },
          ].map((p) => (
            <RoundCheckbox
              key={p.k}
              checked={p.v}
              disabled={disabled}
              onChange={(v) => onChange({ [p.k]: v })}
              label={p.label}
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
            />
          ))}
        </div>
      );
    }
    if (data.role === 'daf') {
      return (
        <p className="text-sm text-zinc-600">
          Accès au module <strong>Comptabilité</strong> (rapports financiers, encaissements Stripe). Aucun autre menu
          back-office.
        </p>
      );
    }
    return (
      <p className="text-sm text-zinc-600">
        Accès tablette (calendrier, check-in / check-out). Les permissions CRM du back-office ne s&apos;appliquent pas à ce rôle.
      </p>
    );
  }

  function renderDocumentsFields(
    data: MemberDraft,
    onChange: (patch: Partial<MemberDraft>) => void,
    disabled: boolean,
  ) {
    const slots = [
      { label: 'CNI recto', key: 'cniFrontUrl' as const },
      { label: 'CNI verso', key: 'cniBackUrl' as const },
      { label: 'Permis bateau recto', key: 'boatLicenseFrontUrl' as const },
      { label: 'Permis bateau verso', key: 'boatLicenseBackUrl' as const },
      { label: 'Badge Airbus (photo)', key: 'airbusBadgePhotoUrl' as const },
    ];
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {slots.map((s) => (
          <label key={s.key} className="block">
            <FieldLabel>{s.label}</FieldLabel>
            <input
              type="file"
              accept={CONTRACT_DOCUMENT_ACCEPT}
              disabled={disabled}
              className={inputCls()}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void fileToUploadDataUrl(f)
                  .then((url) => onChange({ [s.key]: url }))
                  .catch((err) => setFormError(documentUploadErrorMessage(err)));
                e.target.value = '';
              }}
            />
            {data[s.key] ? <DocumentFilePreview url={data[s.key]} label={s.label} /> : null}
          </label>
        ))}
      </div>
    );
  }

  return (
    <ContentReveal ready={hydrated} skeleton={<MembersPageSkeleton />}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Membres</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-zinc-500">
            Clients, propriétaires, agents et administrateurs — fiche unifiée avec édition directe.
          </p>
        </div>

        <ThreeStepGuide
          guideKey="members"
          title="Gérer un membre en 3 étapes"
          steps={[
            <>Identité : nom, email, téléphone et rôle.</>,
            <>Profil selon le rôle (client, propriétaire, permissions…).</>,
            <>Pièces et historique des réservations pour les clients.</>,
          ]}
        />

        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
          {membersFiltersActiveCount > 0 ? (
            <span className="rounded-xl border border-[#416B9F]/25 bg-[#416B9F]/8 px-3 py-2 shadow-sm">
              <span className="font-semibold text-[#416B9F]">{filtered.length}</span> affiché
              {filtered.length !== 1 ? 's' : ''} sur{' '}
              <span className="font-semibold text-zinc-900">{stats.total}</span> membre{stats.total !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="rounded-xl border border-zinc-200/90 bg-white px-3 py-2 shadow-sm">
              <span className="font-semibold text-zinc-900">{stats.total}</span> membre{stats.total !== 1 ? 's' : ''}
            </span>
          )}
          <span className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2">
            <span className="font-semibold text-emerald-800">{stats.active}</span> actif{stats.active !== 1 ? 's' : ''}
          </span>
          <span className="rounded-xl border border-zinc-200/90 bg-white px-3 py-2 shadow-sm">
            <span className="font-semibold text-zinc-800">{stats.clients}</span> client{stats.clients !== 1 ? 's' : ''}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              <Upload className="h-4 w-4" />
              Importer CSV
            </button>
            <button
              type="button"
              onClick={() => startCreate('client')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#365b87]"
            >
              <Plus className="h-4 w-4" />
              Nouveau membre
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un membre…"
                className="w-full rounded-xl border border-zinc-200/90 bg-white py-2.5 pl-9 pr-9 text-sm shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15"
              />
              {search.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                  aria-label="Effacer la recherche"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'admin', 'agent', 'proprietaire', 'client'] as const).map((k) => {
                const active = roleFilter === k;
                const dot = k === 'all' ? null : ROLE_STYLES[k].dot;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setRoleFilter(k)}
                    className={[
                      'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition',
                      active ? 'bg-[#416B9F] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80',
                    ].join(' ')}
                  >
                    {dot ? <span className={['h-1.5 w-1.5 rounded-full', active ? 'bg-white' : dot].join(' ')} /> : null}
                    {k === 'all' ? 'Tous' : ROLE_LABELS[k]}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all' as const, label: 'Tous statuts' },
                  { id: 'active' as const, label: 'Actifs' },
                  { id: 'inactive' as const, label: 'Inactifs' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFilter(f.id)}
                  className={[
                    'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition',
                    activeFilter === f.id ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-600',
                  ].join(' ')}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="max-h-[min(32rem,58vh)] space-y-2 overflow-y-auto pr-0.5">
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-xs text-zinc-500">
                  {sorted.length > 0 ? (
                    <>
                      <p>
                        Aucun membre ne correspond aux filtres
                        {search.trim() ? (
                          <>
                            {' '}
                            (recherche « <span className="font-semibold text-zinc-700">{search.trim()}</span> »)
                          </>
                        ) : null}
                        .
                      </p>
                      <p className="mt-1">
                        {sorted.length} membre{sorted.length !== 1 ? 's' : ''} au total dans le catalogue.
                      </p>
                      <button
                        type="button"
                        onClick={resetMembersFilters}
                        className="mt-3 inline-flex items-center rounded-lg bg-[#416B9F] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#365b87]"
                      >
                        Réinitialiser les filtres
                      </button>
                    </>
                  ) : (
                    <p>Aucun membre. Créez-en un avec le bouton ci-dessus.</p>
                  )}
                </div>
              ) : (
                filtered.map((m) => {
                  const active = m.id === selectedId;
                  const boatsOwned = m.role === 'proprietaire' ? (boatNamesByOwnerId.get(m.id) ?? []) : [];
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(m.id);
                        setConfirmDeleteId(null);
                        setFormError('');
                        setSection('identity');
                      }}
                      className={[
                        'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                        active ? 'border-[#416B9F]/50 bg-[#416B9F]/10 ring-1 ring-[#416B9F]/20' : 'border-zinc-200/90 bg-white hover:bg-zinc-50',
                        !m.isActive ? 'opacity-75' : '',
                      ].join(' ')}
                    >
                      <MemberAvatar firstName={m.firstName} lastName={m.lastName} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-zinc-900">
                          {m.firstName} {m.lastName}
                        </p>
                        <p className="truncate text-[11px] text-zinc-500">{m.email}</p>
                        {boatsOwned.length > 0 ? (
                          <p className="mt-0.5 truncate text-[10px] font-medium text-[#416B9F]">
                            {boatsOwned.slice(0, 2).join(' · ')}
                            {boatsOwned.length > 2 ? ` +${boatsOwned.length - 2}` : ''}
                          </p>
                        ) : null}
                      </div>
                      <MemberRoleBadge role={m.role} />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="lg:col-span-8">
            {!selected && !isCreating ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-16 text-center">
                <Users className="h-10 w-10 text-zinc-300" strokeWidth={1.5} />
                <p className="mt-3 text-sm font-medium text-zinc-700">Aucun membre sélectionné</p>
                <p className="mt-1 max-w-sm text-xs text-zinc-500">Choisissez un membre dans la liste ou créez-en un nouveau.</p>
                <button
                  type="button"
                  onClick={() => startCreate('client')}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2 text-sm font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Nouveau membre
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-2 ring-[#416B9F]/15 ring-offset-2">
                <div className="flex flex-wrap items-start gap-4 border-b border-zinc-100 p-4 sm:p-5">
                  <MemberAvatar
                    firstName={isCreating ? createDraft.firstName : selected!.firstName}
                    lastName={isCreating ? createDraft.lastName : selected!.lastName}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-zinc-900">{displayName}</h3>
                      <MemberRoleBadge role={editorRole} />
                      {isCreating ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
                          Brouillon
                        </span>
                      ) : null}
                      {!isCreating && selected && !selected.isActive ? (
                        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">Inactif</span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-zinc-500">
                      {isCreating ? createDraft.email || 'Email à renseigner' : selected!.email}
                    </p>
                    {readOnly ? (
                      <p className="mt-2 text-xs text-amber-700">Compte connecté — lecture seule depuis cette page.</p>
                    ) : null}
                  </div>
                  {!isCreating && selected && !readOnly ? (
                    <RoundCheckbox
                      checked={selected.isActive}
                      onChange={(v) => void patchSelected({ isActive: v })}
                      label={selected.isActive ? 'Compte actif' : 'Compte inactif'}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                    />
                  ) : isCreating ? (
                    <RoundCheckbox
                      checked={createDraft.isActive}
                      onChange={(v) => setCreateDraft((d) => ({ ...d, isActive: v }))}
                      label="Compte actif"
                      className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                    />
                  ) : null}
                </div>

                <div className="flex gap-1 overflow-x-auto border-b border-zinc-100 px-4 sm:px-5">
                  {tabs.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSection(id)}
                      className={[
                        'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition',
                        section === id ? 'border-[#416B9F] text-[#416B9F]' : 'border-transparent text-zinc-500 hover:text-zinc-800',
                      ].join(' ')}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="space-y-4 p-4 sm:p-5">
                  {formError ? (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{formError}</p>
                  ) : null}
                  {success ? (
                    <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{success}</p>
                  ) : null}

                  {section === 'identity'
                    ? isCreating
                      ? renderIdentityFields(createDraft, (p) => setCreateDraft((d) => ({ ...d, ...p })), false)
                      : selected
                        ? renderIdentityFields(memberToDraft(selected), (p) => void patchSelected(draftToUpdatePayload({ ...memberToDraft(selected), ...p }, selected.id)), readOnly)
                        : null
                    : null}

                  {section === 'profile'
                    ? isCreating
                      ? renderProfileFields(createDraft, (p) => setCreateDraft((d) => ({ ...d, ...p })), false)
                      : selected
                        ? renderProfileFields(
                            memberToDraft(selected),
                            (p) => void patchSelected(draftToUpdatePayload({ ...memberToDraft(selected), ...p }, selected.id)),
                            readOnly,
                          )
                        : null
                    : null}

                  {section === 'documents' && editorRole === 'client'
                    ? isCreating
                      ? renderDocumentsFields(createDraft, (p) => setCreateDraft((d) => ({ ...d, ...p })), false)
                      : selected
                        ? renderDocumentsFields(
                            memberToDraft(selected),
                            (p) => void patchSelected(draftToUpdatePayload({ ...memberToDraft(selected), ...p }, selected.id)),
                            readOnly,
                          )
                        : null
                    : null}

                  {section === 'history' && !isCreating && selected?.role === 'client' ? (
                    <ClientReservationHistory
                      memberId={selected.id}
                      clientEmail={selected.email}
                      onOpenReservation={(id) => navigate(`/calendrier?open=${encodeURIComponent(id)}`)}
                    />
                  ) : null}

                  {isCreating ? (
                    <div className="flex justify-end border-t border-zinc-100 pt-4">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleCreate()}
                        className="rounded-xl bg-[#416B9F] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#365b87] disabled:opacity-60"
                      >
                        {saving ? 'Enregistrement…' : 'Créer le membre'}
                      </button>
                    </div>
                  ) : null}

                  {!isCreating && selected && !readOnly ? (
                    <div className="flex justify-end border-t border-zinc-100 pt-4">
                      {confirmDeleteId === selected.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-zinc-600">Supprimer ce membre ?</span>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            onClick={() => removeMemberSafe(selected.id)}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                          >
                            <Trash2 className="h-4 w-4" />
                            Confirmer
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(selected.id)}
                          disabled={
                            Boolean(
                              (currentUserDisplayId && selected.id === currentUserDisplayId) ||
                                (currentUserEmail && selected.email.toLowerCase() === currentUserEmail.toLowerCase()),
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                          Supprimer
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <MembersNauticImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          void refresh();
          setRoleFilter('client');
          setSuccess('Import clients terminé.');
        }}
      />
    </ContentReveal>
  );
}
