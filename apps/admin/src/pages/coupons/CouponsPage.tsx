import { useEffect, useMemo, useState } from 'react';
import {
  buildCouponUsageGroupsFromReservations,
  formatUsageDiscountBadge,
  formatUsageTierBadges,
  type CouponUsageGroup,
} from '@/lib/couponUsageFromReservations';
import { deserializeReservation } from '@/stores/reservations';
import {
  Banknote,
  CalendarClock,
  CalendarRange,
  ChevronDown,
  Percent,
  Plus,
  Search,
  TicketPercent,
  Download,
  Trash2,
  Users,
} from 'lucide-react';
import { RoundCheckbox } from '@/components/RoundCheckbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ContentReveal } from '@/components/ui/ContentReveal';
import { ThreeStepGuide } from '@/components/ui/ThreeStepGuide';
import { CouponsPageSkeleton } from '@/components/skeletons/CouponsPageSkeleton';
import {
  couponListStatus,
  couponSearchHaystack,
  CREATE_COUPON_ID,
  discountKindLabel,
  formatDiscountLine,
  formatRange,
  formatSeasonRuleLine,
  inputCls,
  normalizeForSearch,
  parseDiscountValue,
  todayIso,
} from '@/lib/couponUi';
import { usePageFiltersPanel, type PageFiltersConfig } from '@/contexts/PageFiltersContext';
import { usePersistedBoolean, usePersistedEnum, usePersistedString } from '@/lib/pageFilterStorage';
import { couponRequiresAirbusBadge } from '@/lib/airbusCoupon';
import { api } from '@/lib/api';
import { useCouponsStore, type Coupon, type CouponDiscountKind, type CouponSeasonRule } from '@/stores/coupons';
import { useExtrasStore } from '@/stores/extras';
import { useMembersStore, type Member } from '@/stores/members';
import { useReservationsStore } from '@/stores/reservations';

type EditorSection = 'general' | 'discount' | 'validity' | 'season' | 'usage';
type ListFilter = 'all' | 'active' | 'disabled' | 'out_of_range';

type UsageConfirmState =
  | {
      kind: 'client';
      couponId: string;
      clientKey: string;
      clientLabel: string;
      count: number;
      couponCode: string;
    }
  | { kind: 'clearAll' };

type CouponDraft = {
  code: string;
  internalLabel: string;
  discountKind: CouponDiscountKind;
  discountValue: number;
  validFrom: string;
  validUntil: string;
  enabled: boolean;
  seasonRuleEnabled: boolean;
  seasonMaxFullUses: number;
  seasonDegradedValue: number;
  requiresAirbusBadge: boolean;
};

function emptyDraft(): CouponDraft {
  return {
    code: '',
    internalLabel: '',
    discountKind: 'percent',
    discountValue: 10,
    validFrom: todayIso(),
    validUntil: '',
    enabled: true,
    seasonRuleEnabled: false,
    seasonMaxFullUses: 3,
    seasonDegradedValue: 20,
    requiresAirbusBadge: false,
  };
}

function couponToDraft(c: Coupon): CouponDraft {
  return {
    code: c.code,
    internalLabel: c.internalLabel,
    discountKind: c.discountKind,
    discountValue: c.discountValue,
    validFrom: c.validFrom,
    validUntil: c.validUntil ?? '',
    enabled: c.enabled,
    seasonRuleEnabled: Boolean(c.seasonRule),
    seasonMaxFullUses: c.seasonRule?.maxFullDiscountUsesPerClient ?? 3,
    seasonDegradedValue: c.seasonRule?.degradedDiscountValue ?? 20,
    requiresAirbusBadge: c.requiresAirbusBadge,
  };
}

function draftToCouponPayload(d: CouponDraft, id: string, createdAt: string): Coupon {
  let seasonRule: CouponSeasonRule | null = null;
  if (d.seasonRuleEnabled) {
    seasonRule = {
      maxFullDiscountUsesPerClient: Math.floor(d.seasonMaxFullUses),
      degradedDiscountValue: d.seasonDegradedValue,
    };
  }
  return {
    id,
    code: d.code,
    internalLabel: d.internalLabel,
    discountKind: d.discountKind,
    discountValue: d.discountValue,
    validFrom: d.validFrom.trim(),
    validUntil: d.validUntil.trim() || null,
    enabled: d.enabled,
    seasonRule,
    createdAt,
    requiresAirbusBadge: d.requiresAirbusBadge,
  };
}

function draftToAddPayload(d: CouponDraft) {
  const c = draftToCouponPayload(d, '', new Date().toISOString());
  const { id: _id, createdAt: _ca, ...rest } = c;
  return rest;
}

function FieldLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{children}</span>;
}

function CouponStatusBadge({ coupon }: Readonly<{ coupon: Coupon }>) {
  const status = couponListStatus(coupon);
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Actif
      </span>
    );
  }
  if (status === 'disabled') {
    return (
      <span className="inline-flex rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
        Désactivé
      </span>
    );
  }
  if (status === 'scheduled') {
    return (
      <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800 ring-1 ring-blue-200/80">
        À venir
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200/80">
      Hors période
    </span>
  );
}

function resolveMemberForCouponClientKey(
  clientKey: string,
  byId: ReadonlyMap<string, Member>,
  byEmail: ReadonlyMap<string, Member>,
): Member | undefined {
  const k = clientKey.trim();
  if (!k) return undefined;
  if (k.includes('@')) return byEmail.get(k.toLowerCase());
  return byId.get(k);
}

function redemptionClientHaystack(clientKey: string, member: Member | undefined): string {
  const parts =
    member ?
      [clientKey, member.firstName, member.lastName, member.email, `${member.firstName} ${member.lastName}`]
    : [clientKey];
  return normalizeForSearch(parts.join(' '));
}

function redemptionMatchesClientSearch(clientKey: string, member: Member | undefined, query: string): boolean {
  const nq = normalizeForSearch(query);
  if (!nq) return true;
  const hay = redemptionClientHaystack(clientKey, member);
  return nq.split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

function formatCouponUsageWhen(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function couponClientInitials(member: Member | undefined, clientKey: string): string {
  if (member) {
    const first = member.firstName?.trim()[0] ?? '';
    const last = member.lastName?.trim()[0] ?? '';
    if (first || last) return `${first}${last}`.toUpperCase();
  }
  return clientKey.trim().slice(0, 2).toUpperCase() || '?';
}

function usageStatusPillClass(status: CouponUsageGroup['usages'][number]['status']): string {
  if (status === 'reserved_paid') return 'bg-emerald-50 text-emerald-800 ring-emerald-200/80';
  if (status === 'cancelled' || status === 'refunded' || status === 'partially_refunded') {
    return 'bg-zinc-100 text-zinc-600 ring-zinc-200/80';
  }
  return 'bg-sky-50 text-sky-900 ring-sky-200/80';
}

function isCouponUsageUpcoming(startAt: string): boolean {
  const start = new Date(startAt);
  return Number.isFinite(start.getTime()) && start.getTime() > Date.now();
}

type CouponUsageGroupRowProps = Readonly<{
  group: CouponUsageGroup;
  member: Member | undefined;
  coupon: Coupon;
  expanded: boolean;
  onToggleExpanded: () => void;
  onDelete: () => void;
}>;

function CouponUsageGroupRow(props: CouponUsageGroupRowProps) {
  const { group: g, member, coupon, expanded, onToggleExpanded, onDelete } = props;
  const tierBadges = formatUsageTierBadges(coupon, g);
  const discountLabel = formatUsageDiscountBadge(coupon, g.lastEffectivePercent);
  const clientLabel = member ? `${member.firstName} ${member.lastName}` : g.clientKey;
  const lastUseLabel = formatCouponUsageWhen(g.lastStartAt);

  return (
    <li className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-sm">
      <div className="flex gap-3 p-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#416B9F]/10 text-sm font-bold text-[#416B9F]"
          aria-hidden
        >
          {couponClientInitials(member, g.clientKey)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900">{clientLabel}</p>
              {member ? <p className="truncate text-xs text-zinc-500">{member.email}</p> : null}
              {member?.role === 'client' && member.airbusBadge?.trim() ? (
                <p className="mt-0.5 text-[11px] font-mono text-zinc-400">
                  Badge {member.airbusBadge.trim().toUpperCase()}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200/80 bg-red-50 text-red-600 transition hover:bg-red-100"
              aria-label={`Supprimer les utilisations pour ${clientLabel}`}
              title="Supprimer les utilisations de ce client"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-800 ring-1 ring-emerald-200/70">
              {discountLabel}
            </span>
            {tierBadges.fullLabel ? (
              <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-sky-900 ring-1 ring-sky-200/70">
                {tierBadges.fullLabel}
              </span>
            ) : null}
            {tierBadges.degradedLabel ? (
              <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-900 ring-1 ring-amber-200/70">
                {tierBadges.degradedLabel}
              </span>
            ) : null}
            <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-700 ring-1 ring-zinc-200/80">
              {tierBadges.totalLabel}
            </span>
            <span className="hidden text-[11px] text-zinc-400 sm:inline">·</span>
            <time className="text-[11px] text-zinc-400" dateTime={g.lastStartAt}>
              Dernière : {lastUseLabel}
            </time>
          </div>

          {g.outOfSeasonCount > 0 ? (
            <p className="mt-2 text-[11px] text-zinc-400">
              +{g.outOfSeasonCount} hors saison {g.seasonYear ?? ''} (non comptée)
            </p>
          ) : null}
        </div>
      </div>

      {g.usages.length > 0 ? (
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-3">
          <button
            type="button"
            onClick={onToggleExpanded}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-200/80 bg-white px-3 py-2.5 text-left text-sm font-medium text-zinc-700 shadow-sm transition hover:border-[#416B9F]/30 hover:bg-[#416B9F]/5"
            aria-expanded={expanded}
          >
            <span className="flex min-w-0 items-center gap-2">
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[#416B9F] transition-transform ${expanded ? 'rotate-180' : ''}`}
                aria-hidden
              />
              <span className="whitespace-nowrap">
                {expanded ? 'Masquer le détail' : 'Voir les utilisations'}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-600">
              {g.usages.length}
            </span>
          </button>

          {expanded ? (
            <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200/80 bg-white">
              <div className="hidden grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:grid">
                <span>Date</span>
                <span>Statut</span>
                <span className="text-right">Remise</span>
              </div>
              <ul className="divide-y divide-zinc-100">
                {g.usages.map((u) => {
                  const pct = u.percent != null ? `−${u.percent} %` : '—';
                  return (
                    <li
                      key={u.reservationId}
                      className="grid grid-cols-1 gap-2 px-3 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-x-4 sm:gap-y-0"
                    >
                      <time className="font-medium text-zinc-800" dateTime={u.startAt}>
                        {formatCouponUsageWhen(u.startAt)}
                      </time>
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${usageStatusPillClass(u.status)}`}
                        >
                          {u.statusLabel}
                        </span>
                        {isCouponUsageUpcoming(u.startAt) ? (
                          <span className="inline-flex w-fit rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-800 ring-1 ring-violet-200/80">
                            À venir
                          </span>
                        ) : null}
                      </div>
                      <span className="font-semibold tabular-nums text-zinc-900 sm:text-right">{pct}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function CouponsPage() {
  const coupons = useCouponsStore((s) => s.coupons);
  const redemptions = useCouponsStore((s) => s.redemptions);
  const hydrated = useCouponsStore((s) => s.hydrated);
  const refresh = useCouponsStore((s) => s.refresh);
  const reservationItems = useReservationsStore((s) => s.items);
  const reservationsHydrated = useReservationsStore((s) => s.hydrated);
  const refreshReservations = useReservationsStore((s) => s.refresh);
  const extrasCatalog = useExtrasStore((s) => s.extras);
  const addCoupon = useCouponsStore((s) => s.addCoupon);
  const updateCoupon = useCouponsStore((s) => s.updateCoupon);
  const removeCoupon = useCouponsStore((s) => s.removeCoupon);
  const clearRedemptions = useCouponsStore((s) => s.clearRedemptions);
  const removeRedemptionsForClient = useCouponsStore((s) => s.removeRedemptionsForClient);
  const members = useMembersStore((s) => s.members);

  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = usePersistedString('coupons.search');
  const [listFilter, setListFilter] = usePersistedEnum<ListFilter>(
    'coupons.listFilter',
    'all',
    ['all', 'active', 'disabled', 'out_of_range'],
  );
  const [hideDisabledCoupons, setHideDisabledCoupons] = usePersistedBoolean('coupons.hideDisabled', false);
  const [section, setSection] = useState<EditorSection>('general');
  const [formError, setFormError] = useState('');
  const [createDraft, setCreateDraft] = useState<CouponDraft>(emptyDraft);
  const [discountValueDraft, setDiscountValueDraft] = useState('10');
  const [seasonDegradedDraft, setSeasonDegradedDraft] = useState('20');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [usageConfirm, setUsageConfirm] = useState<UsageConfirmState | null>(null);
  const [exportingAirbus, setExportingAirbus] = useState(false);
  const [usageConfirmLoading, setUsageConfirmLoading] = useState(false);
  const [redemptionClientSearch, setRedemptionClientSearch] = useState('');
  const [expandedUsageKeys, setExpandedUsageKeys] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hydrated) void refresh();
  }, [hydrated, refresh]);

  useEffect(() => {
    setExpandedUsageKeys(new Set());
  }, [selectedId]);

  const sorted = useMemo(() => {
    const rank = (c: Coupon) => {
      const s = couponListStatus(c);
      if (s === 'active') return 0;
      if (s === 'scheduled') return 1;
      if (s === 'out_of_range') return 2;
      return 3;
    };
    return [...coupons].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [coupons]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((c) => {
      if (hideDisabledCoupons && !c.enabled) return false;
      const status = couponListStatus(c);
      if (listFilter === 'active' && status !== 'active') return false;
      if (listFilter === 'disabled' && status !== 'disabled') return false;
      if (listFilter === 'out_of_range' && status !== 'out_of_range' && status !== 'scheduled') return false;
      if (!q) return true;
      return couponSearchHaystack(c).includes(q);
    });
  }, [sorted, search, listFilter, hideDisabledCoupons]);

  const isCreating = selectedId === CREATE_COUPON_ID;
  const selected = useMemo(() => {
    if (isCreating) return null;
    return coupons.find((c) => c.id === selectedId) ?? null;
  }, [coupons, selectedId, isCreating]);

  useEffect(() => {
    if (coupons.length === 0 && !isCreating) {
      setSelectedId('');
      return;
    }
    if (!isCreating && selectedId && !coupons.some((c) => c.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? sorted[0]?.id ?? '');
    }
  }, [coupons, selectedId, filtered, sorted, isCreating]);

  useEffect(() => {
    if (isCreating) {
      setDiscountValueDraft(String(createDraft.discountValue));
      setSeasonDegradedDraft(String(createDraft.seasonDegradedValue));
      return;
    }
    if (!selected) return;
    setDiscountValueDraft(
      selected.discountKind === 'fixed'
        ? selected.discountValue.toFixed(2).replace('.', ',')
        : String(selected.discountValue),
    );
    setSeasonDegradedDraft(
      selected.seasonRule
        ? selected.discountKind === 'fixed'
          ? selected.seasonRule.degradedDiscountValue.toFixed(2).replace('.', ',')
          : String(selected.seasonRule.degradedDiscountValue)
        : '20',
    );
  }, [selected?.id, selected?.discountKind, selected?.discountValue, selected?.seasonRule, isCreating, createDraft.discountValue, createDraft.discountKind, createDraft.seasonDegradedValue]);

  const stats = useMemo(
    () => ({
      total: coupons.length,
      active: coupons.filter((c) => couponListStatus(c) === 'active').length,
      redemptions: redemptions.length,
    }),
    [coupons, redemptions.length],
  );

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const memberByEmailLower = useMemo(
    () => new Map(members.map((m) => [m.email.trim().toLowerCase(), m])),
    [members],
  );

  const reservations = useMemo(
    () => reservationItems.map((s) => deserializeReservation(s)),
    [reservationItems],
  );

  const usageGroupsForSelected = useMemo(() => {
    if (!selected) return [];
    return buildCouponUsageGroupsFromReservations(reservations, selected.code, selected, extrasCatalog);
  }, [reservations, selected, extrasCatalog]);

  useEffect(() => {
    if (!reservationsHydrated) void refreshReservations();
  }, [reservationsHydrated, refreshReservations]);

  useEffect(() => {
    if (section !== 'usage' || !selected?.id) return;
    void api.post(`/coupons/${selected.id}/sync-redemptions`).then(() => refresh());
  }, [section, selected?.id, refresh]);

  const filteredUsageGroups = useMemo(() => {
    if (!redemptionClientSearch.trim()) return usageGroupsForSelected;
    return usageGroupsForSelected.filter((g) => {
      const m = resolveMemberForCouponClientKey(g.clientKey, memberById, memberByEmailLower);
      return redemptionMatchesClientSearch(g.clientKey, m, redemptionClientSearch);
    });
  }, [memberByEmailLower, memberById, redemptionClientSearch, usageGroupsForSelected]);

  const couponsFiltersPanel = useMemo(
    () => (
      <div className="space-y-4">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200/90 bg-zinc-50/80 px-4 py-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-[#416B9F] accent-[#416B9F]"
            checked={hideDisabledCoupons}
            onChange={(e) => setHideDisabledCoupons(e.target.checked)}
          />
          <span className="text-sm font-medium text-zinc-800">Masquer les coupons désactivés</span>
        </label>
        <button
          type="button"
          onClick={() => setHideDisabledCoupons(false)}
          className="w-full rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          Réinitialiser
        </button>
      </div>
    ),
    [hideDisabledCoupons],
  );

  usePageFiltersPanel(
    useMemo(
      () =>
        ({
          title: 'Coupons',
          subtitle: 'Contrôle ce qui apparaît dans la liste.',
          activeFilterCount: hideDisabledCoupons ? 1 : 0,
          panelBody: couponsFiltersPanel,
        }) as PageFiltersConfig,
      [hideDisabledCoupons, couponsFiltersPanel],
    ),
  );

  async function downloadAirbusRegistrations(couponId: string, code: string) {
    setExportingAirbus(true);
    setFormError('');
    try {
      const res = await api.get(`/coupons/${couponId}/export/airbus-registrations`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `airbus-${code.replaceAll(/[^A-Za-z0-9_-]+/g, '_')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const err = e as { response?: { data?: Blob } };
      let msg = 'Impossible de télécharger le tableau Airbus.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text) as { message?: string | string[] };
          if (typeof parsed.message === 'string') msg = parsed.message;
          else if (Array.isArray(parsed.message)) msg = parsed.message.join(' ');
        } catch {
          /* ignore */
        }
      }
      setFormError(msg);
    } finally {
      setExportingAirbus(false);
    }
  }

  async function handleUsageConfirm() {
    if (!usageConfirm) return;
    setUsageConfirmLoading(true);
    setFormError('');
    try {
      if (usageConfirm.kind === 'client') {
        const res = await removeRedemptionsForClient(usageConfirm.couponId, usageConfirm.clientKey);
        if (!res.ok) {
          setFormError(res.error);
          return;
        }
      } else {
        const res = await clearRedemptions();
        if (!res.ok) {
          setFormError(res.error);
          return;
        }
      }
      setUsageConfirm(null);
    } finally {
      setUsageConfirmLoading(false);
    }
  }

  function startCreate() {
    setFormError('');
    setConfirmDeleteId(null);
    setUsageConfirm(null);
    setCreateDraft(emptyDraft());
    setSelectedId(CREATE_COUPON_ID);
    setSection('general');
  }

  async function patchSelected(patch: Partial<Coupon>) {
    if (!selected) return;
    setFormError('');
    const res = await updateCoupon({ ...selected, ...patch });
    if (!res.ok) setFormError(res.error);
  }

  function applyDraftPatch(patch: Partial<CouponDraft>) {
    if (isCreating) {
      setCreateDraft((d) => ({ ...d, ...patch }));
      return;
    }
    if (!selected) return;
    const next = { ...couponToDraft(selected), ...patch };
    const coupon = draftToCouponPayload(next, selected.id, selected.createdAt);
    void patchSelected(coupon);
  }

  async function handleCreate() {
    setFormError('');
    setSaving(true);
    try {
      const res = await addCoupon(draftToAddPayload(createDraft));
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      setSelectedId(res.id);
      setSection('general');
    } finally {
      setSaving(false);
    }
  }

  function renderGeneral(d: CouponDraft, onPatch: (p: Partial<CouponDraft>) => void) {
    return (
      <div className="space-y-4">
        <label className="block">
          <FieldLabel>Code promo *</FieldLabel>
          <input
            value={d.code}
            onChange={(e) => onPatch({ code: e.target.value.toUpperCase() })}
            className={[inputCls(), 'font-mono font-semibold tracking-wide'].join(' ')}
            placeholder="ÉTÉ2026"
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <label className="block">
          <FieldLabel>Libellé interne</FieldLabel>
          <input
            value={d.internalLabel}
            onChange={(e) => onPatch({ internalLabel: e.target.value })}
            className={inputCls()}
            placeholder="Campagne newsletters mai"
          />
        </label>
        <RoundCheckbox
          checked={d.requiresAirbusBadge}
          onChange={(v) => onPatch({ requiresAirbusBadge: v })}
          label="Badge Airbus obligatoire à la réservation"
        />
        <p className="text-xs leading-relaxed text-zinc-500">
          Active le champ « N° badge Airbus » dans le wizard (ex. partenaire CSE Airbus). Les codes contenant « AIRBUS »
          l&apos;activent aussi automatiquement.
        </p>
      </div>
    );
  }

  function renderDiscount(d: CouponDraft, onPatch: (p: Partial<CouponDraft>) => void) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              onPatch({ discountKind: 'percent' });
              setDiscountValueDraft(String(d.discountValue));
            }}
            className={[
              'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
              d.discountKind === 'percent'
                ? 'border-[#416B9F] bg-[#416B9F]/10 ring-1 ring-[#416B9F]/25'
                : 'border-zinc-200 bg-white hover:bg-zinc-50',
            ].join(' ')}
          >
            <Percent className="h-5 w-5 text-[#416B9F]" />
            <div>
              <p className="text-sm font-semibold text-zinc-900">Pourcentage</p>
              <p className="text-xs text-zinc-500">Remise en %</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              onPatch({ discountKind: 'fixed' });
              setDiscountValueDraft(d.discountValue.toFixed(2).replace('.', ','));
            }}
            className={[
              'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
              d.discountKind === 'fixed'
                ? 'border-[#416B9F] bg-[#416B9F]/10 ring-1 ring-[#416B9F]/25'
                : 'border-zinc-200 bg-white hover:bg-zinc-50',
            ].join(' ')}
          >
            <Banknote className="h-5 w-5 text-[#416B9F]" />
            <div>
              <p className="text-sm font-semibold text-zinc-900">Montant fixe</p>
              <p className="text-xs text-zinc-500">Remise en euros</p>
            </div>
          </button>
        </div>
        <label className="block">
          <FieldLabel>{d.discountKind === 'percent' ? 'Remise (%) *' : 'Montant (€) *'}</FieldLabel>
          <input
            value={discountValueDraft}
            onChange={(e) => setDiscountValueDraft(e.target.value)}
            onBlur={() => onPatch({ discountValue: parseDiscountValue(discountValueDraft) })}
            className={inputCls()}
            inputMode="decimal"
          />
        </label>
      </div>
    );
  }

  function renderValidity(d: CouponDraft, onPatch: (p: Partial<CouponDraft>) => void) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <FieldLabel>Valide à partir du *</FieldLabel>
          <input
            type="date"
            value={d.validFrom}
            onChange={(e) => onPatch({ validFrom: e.target.value })}
            className={inputCls()}
          />
        </label>
        <label className="block">
          <FieldLabel>Valide jusqu&apos;au</FieldLabel>
          <input
            type="date"
            value={d.validUntil}
            onChange={(e) => onPatch({ validUntil: e.target.value })}
            className={inputCls()}
          />
          <p className="mt-1 text-xs text-zinc-400">Facultatif : vide = sans date de fin.</p>
        </label>
      </div>
    );
  }

  function renderSeason(d: CouponDraft, onPatch: (p: Partial<CouponDraft>) => void) {
    return (
      <div className="space-y-4 rounded-xl border border-amber-200/80 bg-amber-50/40 p-4">
        <p className="text-sm font-semibold text-zinc-900">
          Limite usages en saison <span className="font-normal text-zinc-600">(1er avr. → 30 sept.)</span>
        </p>
        <RoundCheckbox
          checked={d.seasonRuleEnabled}
          onChange={(v) => onPatch({ seasonRuleEnabled: v })}
          label="Activer la règle de limite d'usages en saison"
        />
        {d.seasonRuleEnabled ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>Utilisations pleine remise / saison</FieldLabel>
              <input
                inputMode="numeric"
                value={String(d.seasonMaxFullUses)}
                onChange={(e) => {
                  const n = Math.floor(Number.parseFloat(e.target.value.replaceAll(',', '.')));
                  if (Number.isFinite(n)) onPatch({ seasonMaxFullUses: n });
                }}
                className={inputCls()}
              />
            </label>
            <label className="block">
              <FieldLabel>Remise après dépassement</FieldLabel>
              <input
                inputMode="decimal"
                value={seasonDegradedDraft}
                onChange={(e) => setSeasonDegradedDraft(e.target.value)}
                onBlur={() => onPatch({ seasonDegradedValue: parseDiscountValue(seasonDegradedDraft) })}
                className={inputCls()}
              />
            </label>
          </div>
        ) : null}
      </div>
    );
  }

  const editorDraft = isCreating ? createDraft : selected ? couponToDraft(selected) : null;
  const onDraftPatch = (p: Partial<CouponDraft>) => applyDraftPatch(p);

  const tabs: { id: EditorSection; label: string; Icon: typeof TicketPercent }[] = [
    { id: 'general', label: 'Général', Icon: TicketPercent },
    { id: 'discount', label: 'Remise', Icon: Percent },
    { id: 'validity', label: 'Validité', Icon: CalendarRange },
    { id: 'season', label: 'Saison', Icon: CalendarClock },
  ];
  if (!isCreating && selected) {
    tabs.push({ id: 'usage', label: 'Utilisations', Icon: Users });
  }

  return (
    <ContentReveal ready={hydrated} skeleton={<CouponsPageSkeleton />}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Coupons</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-zinc-500">
            Codes promo pour le wizard de réservation — remise en % ou en euros, validité et règles saisonnières.
          </p>
        </div>

        <ThreeStepGuide
          guideKey="coupons"
          title="Configurer un coupon en 3 étapes"
          steps={[
            <>Code et libellé interne pour retrouver la campagne.</>,
            <>Type de remise (% ou €) et période de validité.</>,
            <>Option saison : limite d&apos;usages pleine remise par client.</>,
          ]}
        />

        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
          <span className="rounded-xl border border-zinc-200/90 bg-white px-3 py-2 shadow-sm">
            <span className="font-semibold text-zinc-900">{stats.total}</span> coupon{stats.total !== 1 ? 's' : ''}
          </span>
          <span className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2">
            <span className="font-semibold text-emerald-800">{stats.active}</span> actif{stats.active !== 1 ? 's' : ''}
          </span>
          <span className="rounded-xl border border-zinc-200/90 bg-white px-3 py-2 shadow-sm">
            <span className="font-semibold text-zinc-800">{stats.redemptions}</span> utilisation{stats.redemptions !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={startCreate}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#365b87]"
          >
            <Plus className="h-4 w-4" />
            Nouveau coupon
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
                placeholder="Rechercher un coupon…"
                className="w-full rounded-xl border border-zinc-200/90 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all' as const, label: 'Tous' },
                  { id: 'active' as const, label: 'Actifs' },
                  { id: 'out_of_range' as const, label: 'Hors période' },
                  { id: 'disabled' as const, label: 'Désactivés' },
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

            <div className="max-h-[min(32rem,58vh)] space-y-2 overflow-y-auto pr-0.5">
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-xs text-zinc-500">
                  {coupons.length === 0
                    ? 'Aucun coupon. Créez le premier via le bouton ci-dessus.'
                    : 'Aucun résultat pour ces filtres.'}
                </div>
              ) : (
                filtered.map((c) => {
                  const active = c.id === selectedId;
                  const seasonLine = formatSeasonRuleLine(c);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(c.id);
                        setConfirmDeleteId(null);
                        setFormError('');
                        setSection('general');
                      }}
                      className={[
                        'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                        active
                          ? 'border-[#416B9F]/50 bg-[#416B9F]/10 ring-1 ring-[#416B9F]/20'
                          : 'border-zinc-200/90 bg-white hover:bg-zinc-50',
                        !c.enabled ? 'opacity-75' : '',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                          c.enabled ? 'bg-[#416B9F]/12 text-[#416B9F]' : 'bg-zinc-100 text-zinc-400',
                        ].join(' ')}
                      >
                        <TicketPercent className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-sm font-semibold tracking-wide text-zinc-900">{c.code}</p>
                        {c.internalLabel ? (
                          <p className="truncate text-[11px] text-zinc-500">{c.internalLabel}</p>
                        ) : (
                          <p className="text-[11px] text-zinc-400">{formatRange(c)}</p>
                        )}
                        {seasonLine ? (
                          <p className="mt-0.5 truncate text-[10px] text-amber-800/90">{seasonLine}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-800">
                          {formatDiscountLine(c)}
                        </span>
                        <CouponStatusBadge coupon={c} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="lg:col-span-8">
            {!selected && !isCreating ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-16 text-center">
                <TicketPercent className="h-10 w-10 text-zinc-300" strokeWidth={1.5} />
                <p className="mt-3 text-sm font-medium text-zinc-700">Aucun coupon sélectionné</p>
                <p className="mt-1 max-w-sm text-xs text-zinc-500">
                  Choisissez un coupon dans la liste ou créez-en un nouveau.
                </p>
                <button
                  type="button"
                  onClick={startCreate}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2 text-sm font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Nouveau coupon
                </button>
              </div>
            ) : editorDraft ? (
              <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-2 ring-[#416B9F]/15 ring-offset-2">
                <div className="flex flex-wrap items-start gap-4 border-b border-zinc-100 p-4 sm:p-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#416B9F]/12 text-[#416B9F]">
                    <TicketPercent className="h-6 w-6" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-mono text-base font-semibold tracking-wide text-zinc-900">
                        {editorDraft.code || 'NOUVEAU'}
                      </h3>
                      {isCreating ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
                          Brouillon
                        </span>
                      ) : selected ? (
                        <CouponStatusBadge coupon={selected} />
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-medium text-[#416B9F]">
                      {formatDiscountLine({
                        discountKind: editorDraft.discountKind,
                        discountValue: editorDraft.discountValue,
                      })}{' '}
                      · {discountKindLabel(editorDraft.discountKind)}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {formatRange({
                        validFrom: editorDraft.validFrom,
                        validUntil: editorDraft.validUntil || null,
                      })}
                    </p>
                  </div>
                  <RoundCheckbox
                    checked={editorDraft.enabled}
                    onChange={(v) => onDraftPatch({ enabled: v })}
                    label={editorDraft.enabled ? 'Coupon activé' : 'Coupon désactivé'}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                  />
                </div>

                <div className="flex gap-1 overflow-x-auto border-b border-zinc-100 px-4 sm:px-5">
                  {tabs.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSection(id)}
                      className={[
                        'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition',
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

                <div className="space-y-4 p-4 sm:p-5">
                  {formError ? (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                      {formError}
                    </p>
                  ) : null}

                  {section === 'general' ? renderGeneral(editorDraft, onDraftPatch) : null}
                  {section === 'discount' ? renderDiscount(editorDraft, onDraftPatch) : null}
                  {section === 'validity' ? renderValidity(editorDraft, onDraftPatch) : null}
                  {section === 'season' ? renderSeason(editorDraft, onDraftPatch) : null}

                  {section === 'usage' && selected ? (
                    <div className="space-y-4">
                      {couponRequiresAirbusBadge(selected) ? (
                        <div className="rounded-xl border border-[#416B9F]/25 bg-[#416B9F]/5 px-4 py-3">
                          <p className="text-sm font-semibold text-zinc-900">Export partenaire Airbus</p>
                          <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                            Télécharge un CSV des réservations (hors annulées), trié par date : badge, client, tarifs,
                            nombre de locations et remises à 20 %.
                          </p>
                          <button
                            type="button"
                            disabled={exportingAirbus}
                            onClick={() => void downloadAirbusRegistrations(selected.id, selected.code)}
                            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#416B9F]/40 bg-white px-4 py-2 text-sm font-semibold text-[#416B9F] shadow-sm transition hover:bg-[#416B9F]/10 disabled:opacity-60"
                          >
                            <Download className="h-4 w-4" />
                            {exportingAirbus ? 'Téléchargement…' : 'Télécharger le tableau Airbus'}
                          </button>
                        </div>
                      ) : null}
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <input
                          type="search"
                          value={redemptionClientSearch}
                          onChange={(e) => setRedemptionClientSearch(e.target.value)}
                          placeholder="Filtrer par nom ou e-mail…"
                          className="w-full rounded-xl border border-zinc-200/90 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15"
                        />
                      </div>
                      {filteredUsageGroups.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                          Aucune réservation active avec ce coupon.
                        </p>
                      ) : (
                        <ul className="space-y-3">
                          {filteredUsageGroups.map((g) => {
                            const member = resolveMemberForCouponClientKey(g.clientKey, memberById, memberByEmailLower);
                            return (
                              <CouponUsageGroupRow
                                key={g.key}
                                group={g}
                                member={member}
                                coupon={selected}
                                expanded={expandedUsageKeys.has(g.key)}
                                onToggleExpanded={() =>
                                  setExpandedUsageKeys((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(g.key)) next.delete(g.key);
                                    else next.add(g.key);
                                    return next;
                                  })
                                }
                                onDelete={() =>
                                  setUsageConfirm({
                                    kind: 'client',
                                    couponId: selected.id,
                                    clientKey: g.clientKey,
                                    clientLabel: member
                                      ? `${member.firstName} ${member.lastName}`
                                      : g.clientKey,
                                    count: g.count,
                                    couponCode: selected.code,
                                  })
                                }
                              />
                            );
                          })}
                        </ul>
                      )}
                      {redemptions.length > 0 ? (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setUsageConfirm({ kind: 'clearAll' })}
                            className="text-xs font-semibold text-zinc-500 hover:text-red-700"
                          >
                            Vider toutes les utilisations
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {isCreating ? (
                    <div className="flex justify-end border-t border-zinc-100 pt-4">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleCreate()}
                        className="rounded-xl bg-[#416B9F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#365b87] disabled:opacity-60"
                      >
                        {saving ? 'Enregistrement…' : 'Créer le coupon'}
                      </button>
                    </div>
                  ) : selected ? (
                    <div className="flex justify-end border-t border-zinc-100 pt-4">
                      {confirmDeleteId === selected.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-zinc-600">Supprimer {selected.code} ?</span>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              removeCoupon(selected.id);
                              setConfirmDeleteId(null);
                              setSelectedId('');
                            }}
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
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                        >
                          <Trash2 className="h-4 w-4" />
                          Supprimer
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={usageConfirm !== null}
        title={
          usageConfirm?.kind === 'client'
            ? 'Supprimer les utilisations ?'
            : 'Vider toutes les utilisations ?'
        }
        description={
          usageConfirm?.kind === 'client' ? (
            <>
              <p>
                Supprimer les{' '}
                <strong className="font-semibold text-zinc-800">
                  {usageConfirm.count} utilisation{usageConfirm.count > 1 ? 's' : ''}
                </strong>{' '}
                du coupon{' '}
                <strong className="font-mono font-semibold text-zinc-800">{usageConfirm.couponCode}</strong> pour{' '}
                <strong className="font-semibold text-zinc-800">{usageConfirm.clientLabel}</strong> ?
              </p>
              <p className="mt-2">
                Le client retrouvera la remise pleine selon les règles saison. Les réservations du planning ne sont
                pas annulées.
              </p>
            </>
          ) : usageConfirm?.kind === 'clearAll' ? (
            <p>
              Toutes les utilisations enregistrées pour tous les coupons seront supprimées. Les réservations ne sont
              pas modifiées. Cette action est irréversible.
            </p>
          ) : null
        }
        confirmLabel={usageConfirm?.kind === 'clearAll' ? 'Tout vider' : 'Supprimer'}
        onCancel={() => {
          if (!usageConfirmLoading) setUsageConfirm(null);
        }}
        onConfirm={() => void handleUsageConfirm()}
        loading={usageConfirmLoading}
      />
    </ContentReveal>
  );
}
