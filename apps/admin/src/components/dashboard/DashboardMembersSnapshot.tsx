import { useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import type { ActiveSessionUser } from '@bleu-calanque/shared';
import { MemberAvatar } from '@/components/members/MemberRoleBadge';
import { DashboardSectionCard } from '@/components/dashboard/DashboardSectionCard';
import { labelForRole, memberInitials } from '@/lib/memberUi';
import { formatLastSeen, UserRoleBadge } from '@/lib/userRoleLabels';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import { reservationClientLabel } from '@/lib/reservationUi';
import { api } from '@/lib/api';
import { useMembersStore, type Member } from '@/stores/members';

type Props = {
  dayReservations: Reservation[];
};

export function DashboardMembersSnapshot(props: Readonly<Props>) {
  const { dayReservations } = props;
  const members = useMembersStore((s) => s.members);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionUser[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data } = await api.get<ActiveSessionUser[]>('/auth/active-sessions');
        if (!cancelled) setActiveSessions(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setActiveSessions([]);
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    }

    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const clientsOnDay = useMemo(() => {
    const byId = new Map<string, Member>();
    const guests: string[] = [];

    for (const r of dayReservations) {
      const memberId = r.details?.linkedMemberId?.trim();
      if (memberId) {
        const m = members.find((x) => x.id === memberId);
        if (m) byId.set(m.id, m);
      } else {
        const label = reservationClientLabel(r);
        if (label && !guests.includes(label)) guests.push(label);
      }
    }

    return {
      linked: [...byId.values()].sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr')),
      guests,
    };
  }, [dayReservations, members]);

  const sessionsPreview = activeSessions.slice(0, 6);
  const sessionsRest = activeSessions.length - sessionsPreview.length;

  return (
    <DashboardSectionCard
      title="Membres"
      description="Comptes connectés (session en cours) et clients des locations affichées."
      icon={Users}
      href="/clients"
      hrefLabel="Gérer"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Connectés maintenant ({sessionsLoading ? '…' : activeSessions.length})
          </p>
          {sessionsLoading ? (
            <p className="mt-3 text-sm text-zinc-500">Chargement des sessions…</p>
          ) : activeSessions.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              Aucune session active (admin, agent ou propriétaire) sur les 30 dernières minutes.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {sessionsPreview.map((u) => (
                <li key={u.userId} className="flex items-center gap-3">
                  <MemberAvatar firstName={u.firstName} lastName={u.lastName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-zinc-800">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="truncate text-sm text-zinc-500">{u.email}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      {formatLastSeen(u.lastSeenAt)}
                      {u.sessionCount > 1 ? ` · ${u.sessionCount} sessions` : ''}
                    </p>
                  </div>
                  <UserRoleBadge role={u.role} />
                </li>
              ))}
              {sessionsRest > 0 ? (
                <li className="text-sm font-medium text-zinc-500">
                  + {sessionsRest} autre{sessionsRest > 1 ? 's' : ''}
                </li>
              ) : null}
            </ul>
          )}
        </div>

        <div className="sm:border-l sm:border-zinc-100 sm:pl-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Clients du jour ({clientsOnDay.linked.length + clientsOnDay.guests.length})
          </p>
          {clientsOnDay.linked.length === 0 && clientsOnDay.guests.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Aucun client sur les locations de ce jour.</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {clientsOnDay.linked.map((m) => (
                <li key={m.id} className="flex items-center gap-3 text-base text-zinc-700">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600">
                    {memberInitials(m.firstName, m.lastName)}
                  </span>
                  <span className="min-w-0 truncate">
                    {m.firstName} {m.lastName}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-zinc-400">{labelForRole(m.role)}</span>
                </li>
              ))}
              {clientsOnDay.guests.map((name) => (
                <li key={name} className="flex items-center gap-3 text-base text-zinc-600">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500">
                    ?
                  </span>
                  <span className="min-w-0 truncate">{name}</span>
                  <span className="ml-auto shrink-0 text-xs text-zinc-400">Invité</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardSectionCard>
  );
}
