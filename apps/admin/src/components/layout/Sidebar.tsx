import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  CalendarDays,
  Calculator,
  Contact,
  LayoutDashboard,
  Megaphone,
  PackagePlus,
  Settings,
  Ship,
  TicketPercent,
  Users,
  Wallet,
  LogOut,
  ClipboardList,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { isDafUser, isOwnerUser, hasComptabiliteAccess } from '@/lib/userRoles';
import { api } from '@/lib/api';
import { AzurLogo } from '@/components/brand/AzurLogo';

const calendarNavChildren: {
  to: string;
  label: string;
  Icon: LucideIcon;
  end?: boolean;
  tourId: string;
}[] = [
  { to: '/calendrier', label: 'Planning', Icon: Calendar, end: true, tourId: 'admin-nav-calendar-planning' },
  { to: '/reservations', label: 'Réservations', Icon: CalendarDays, tourId: 'admin-nav-reservations' },
];

const dashboardNav: { to: string; label: string; Icon: LucideIcon; end?: boolean; tourId: string } = {
  to: '/dashboard',
  label: 'Dashboard',
  Icon: LayoutDashboard,
  end: true,
  tourId: 'admin-nav-dashboard',
};

const comptabiliteNavItem = {
  to: '/comptabilite',
  label: 'Comptabilité',
  Icon: Calculator,
  tourId: 'admin-nav-comptabilite',
} as const;

const navItems: { to: string; label: string; Icon: LucideIcon; end?: boolean; tourId: string }[] = [
  { to: '/annonces', label: 'Annonces', Icon: Megaphone, tourId: 'admin-nav-annonces' },
  { to: '/bateaux', label: 'Bateaux', Icon: Ship, tourId: 'admin-nav-bateaux' },
  { to: '/coupons', label: 'Coupons', Icon: TicketPercent, tourId: 'admin-nav-coupons' },
  { to: '/clients', label: 'Membres', Icon: Users, tourId: 'admin-nav-membres' },
  { to: '/extras', label: 'Extras', Icon: PackagePlus, tourId: 'admin-nav-extras' },
  { to: '/finances', label: 'Finances', Icon: Wallet, tourId: 'admin-nav-finances' },
  { to: '/check-flow/formulaires', label: 'Check-in/out', Icon: ClipboardList, tourId: 'admin-nav-checkflow' },
];

const iconSize = { className: 'h-5 w-5 shrink-0', strokeWidth: 1.75 } as const;

function userInitials(firstName: string, lastName: string): string {
  const f = firstName.trim().charAt(0);
  const l = lastName.trim().charAt(0);
  if (f || l) return `${f}${l}`.toUpperCase();
  return '?';
}

function navLinkClasses(active: boolean, sub = false) {
  return [
    'box-border flex w-full min-h-[48px] items-center gap-3.5 rounded-2xl font-medium tracking-tight transition-colors duration-150',
    sub ? 'px-4 py-2.5 pl-11 text-sm' : 'px-4 py-3 text-[15px]',
    active
      ? 'bg-[#416B9F] text-white shadow-sm shadow-[#416B9F]/25 [&_svg]:stroke-white'
      : 'text-zinc-600 [&_svg]:stroke-zinc-400 hover:bg-[#416B9F] hover:text-white hover:shadow-sm hover:shadow-[#416B9F]/20 hover:[&_svg]:stroke-white',
  ].join(' ');
}

const subIconSize = { className: 'h-4 w-4 shrink-0', strokeWidth: 1.75 } as const;

function CalendarNavSection() {
  return (
    <div className="space-y-0.5">
      <p className="px-4 pb-0.5 pt-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Calendrier</p>
      {calendarNavChildren.map((item) => {
        const { Icon } = item;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            data-tour={item.tourId}
            className={({ isActive }) => navLinkClasses(isActive, true)}
          >
            <Icon {...subIconSize} aria-hidden />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
}

function profileAvatarUrl(firstName: string, lastName: string, email: string) {
  const name = `${firstName} ${lastName}`.trim() || email;
  const params = new URLSearchParams({
    name,
    size: '128',
    background: '416B9F',
    color: 'fff',
    bold: 'true',
  });
  return `https://ui-avatars.com/api/?${params.toString()}`;
}

const dafNavItems: {
  to: string;
  label: string;
  Icon: LucideIcon;
  end?: boolean;
  tourId: string;
}[] = [
  { to: '/comptabilite', label: 'Comptabilité', Icon: Calculator, end: true, tourId: 'daf-nav-comptabilite' },
];

const ownerNavItems: {
  to: string;
  label: string;
  Icon: LucideIcon;
  end?: boolean;
  tourId: string;
}[] = [
  { to: '/calendrier', label: 'Mon calendrier', Icon: Calendar, end: true, tourId: 'owner-nav-calendar' },
  { to: '/reservations', label: 'Mes réservations', Icon: CalendarDays, tourId: 'owner-nav-reservations' },
  { to: '/contact', label: 'Contact', Icon: Contact, tourId: 'owner-nav-contact' },
  { to: '/parametres', label: 'Paramètres', Icon: Settings, tourId: 'owner-nav-settings' },
];

export function Sidebar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const ownerMode = isOwnerUser(user.role);
  const dafMode = isDafUser(user.role);
  const comptabiliteAccess = hasComptabiliteAccess(user.role, user.permComptabilite);
  const deskNavItems = comptabiliteAccess && !dafMode
    ? [...navItems, { ...comptabiliteNavItem, end: undefined }]
    : navItems;
  const rt = useAuthStore((s) => s.refreshToken);
  const clear = useAuthStore((s) => s.clear);
  const [avatarBroken, setAvatarBroken] = useState(false);

  async function handleLogout() {
    try {
      if (rt) await api.post('/auth/logout', { refreshToken: rt });
    } catch {
      /* ignore */
    }
    clear();
    navigate('/login', { replace: true });
  }

  const initials = userInitials(user.firstName, user.lastName);
  const avatarSrc = user.avatarUrl?.trim()
    ? user.avatarUrl
    : profileAvatarUrl(user.firstName, user.lastName, user.email);

  return (
    <aside className="flex h-screen w-[260px] shrink-0 flex-col border-r border-zinc-200/90 bg-[#f4f5f8]">
      {/* Marque */}
      <div className="px-5 pt-7 pb-2 shrink-0">
        <AzurLogo variant="full" className="h-9 w-auto" />
        <p className="mt-2 text-xs font-medium text-zinc-400">
          {dafMode ? 'Comptabilité' : ownerMode ? 'Espace propriétaire' : 'Gestion location'}
        </p>
      </div>

      {/* Navigation — la zone centrale absorbe l’espace (effet « air » sous le menu, réf. Invo) */}
      <nav className="flex overflow-y-auto flex-col flex-1 gap-1 px-4 pt-6 pb-4 min-h-0">
        {dafMode ? (
          dafNavItems.map((item) => {
            const { Icon } = item;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                data-tour={item.tourId}
                className={({ isActive }) => navLinkClasses(isActive)}
              >
                <Icon {...iconSize} aria-hidden />
                <span>{item.label}</span>
              </NavLink>
            );
          })
        ) : ownerMode ? (
          ownerNavItems.map((item) => {
            const { Icon } = item;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                data-tour={item.tourId}
                className={({ isActive }) => navLinkClasses(isActive)}
              >
                <Icon {...iconSize} aria-hidden />
                <span>{item.label}</span>
              </NavLink>
            );
          })
        ) : (
          <>
            <NavLink
              to={dashboardNav.to}
              end={dashboardNav.end}
              data-tour={dashboardNav.tourId}
              className={({ isActive }) => navLinkClasses(isActive)}
            >
              <dashboardNav.Icon {...iconSize} aria-hidden />
              <span>{dashboardNav.label}</span>
            </NavLink>
            <CalendarNavSection />
            {deskNavItems.map((item) => {
              const { Icon } = item;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  data-tour={item.tourId}
                  className={({ isActive }) => navLinkClasses(isActive)}
                >
                  <Icon {...iconSize} aria-hidden />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </>
        )}
      </nav>

      {/* Pied : profil + déconnexion style produit */}
      <div className="shrink-0 space-y-4 border-t border-zinc-200/80 bg-[#f4f5f8] px-4 pb-6 pt-5">
        {!ownerMode && !dafMode ? (
          <NavLink
            to="/parametres"
            data-tour="admin-nav-parametres"
            className={({ isActive }) => navLinkClasses(isActive)}
          >
            <Settings {...iconSize} aria-hidden />
            <span>Paramètres</span>
          </NavLink>
        ) : null}

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-left text-[15px] font-medium tracking-tight text-zinc-600 transition-colors duration-150 [&_svg]:stroke-zinc-400 hover:bg-red-50 hover:text-red-700 hover:[&_svg]:stroke-red-600"
        >
          <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
          <span>Déconnexion</span>
        </button>

        <div
          data-tour={dafMode ? 'daf-footer-profile' : ownerMode ? 'owner-footer-profile' : 'admin-footer-profile'}
          className="shrink-0"
        >
        <NavLink
          to="/profil"
          aria-label="Mon profil"
          className={({ isActive }) =>
            [
              'flex gap-3 items-center rounded-2xl p-2 transition-colors',
              isActive ? 'bg-white/90 ring-1 ring-zinc-200/80' : 'hover:bg-white/70',
            ].join(' ')
          }
        >
          {avatarBroken ? (
            <div
              className="flex justify-center items-center w-11 h-11 text-xs font-semibold text-white bg-[#416B9F] rounded-full ring-2 ring-white shadow-sm shrink-0"
              aria-hidden
            >
              {initials}
            </div>
          ) : (
            <img
              src={avatarSrc}
              alt=""
              width={44}
              height={44}
              className="object-cover w-11 h-11 rounded-full ring-2 ring-white shadow-sm shrink-0"
              referrerPolicy="no-referrer"
              onError={() => setAvatarBroken(true)}
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-zinc-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs truncate text-zinc-500" title={user.email}>
              {user.email}
            </p>
          </div>
        </NavLink>
        </div>
      </div>
    </aside>
  );
}
