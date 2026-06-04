import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, CalendarDays, ClipboardList, LogOut } from 'lucide-react';
import { TabletRealtimePoller } from '@/components/tablet/TabletRealtimePoller';
import { TabletStoresHydrator } from '@/components/TabletStoresHydrator';
import { TB } from '@/lib/tabletTheme';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';

const navItems = [
  { to: '/tablette/aujourdhui', label: "Aujourd'hui", Icon: ClipboardList, end: true },
  { to: '/tablette/reservations', label: 'Réservations', Icon: CalendarDays, end: false },
  { to: '/tablette/calendrier', label: 'Calendrier', Icon: Calendar, end: false },
] as const;

function headerTitle(pathname: string): string {
  if (pathname.startsWith('/tablette/check-in')) return 'Check-in';
  if (pathname.startsWith('/tablette/check-out')) return 'Check-out';
  if (pathname.startsWith('/tablette/calendrier')) return 'Calendrier';
  if (pathname.startsWith('/tablette/reservations')) return 'Réservations';
  return 'Espace agent';
}

export function TabletLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const rt = useAuthStore((s) => s.refreshToken);
  const clear = useAuthStore((s) => s.clear);
  const hideNav =
    location.pathname.includes('/check-in/') || location.pathname.includes('/check-out/');

  async function logout() {
    try {
      if (rt) await api.post('/auth/logout', { refreshToken: rt });
    } catch {
      /* ignore */
    }
    clear();
    navigate('/login', { replace: true });
  }

  return (
    <div className={TB.shell}>
      <header className={TB.header}>
        <div className="min-w-0">
          <p className={TB.headerTitle}>{headerTitle(location.pathname)}</p>
          <p className={TB.headerSub}>
            {user.firstName} {user.lastName}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className={TB.iconBtn}
          aria-label="Déconnexion"
        >
          <LogOut className="h-5 w-5" strokeWidth={1.9} />
        </button>
      </header>
      <TabletStoresHydrator />
      <TabletRealtimePoller />
      <main
        className={[
          TB.main,
          hideNav ? 'pb-4' : 'pb-[calc(5.5rem+env(safe-area-inset-bottom))]',
        ].join(' ')}
      >
        <Outlet />
      </main>
      {!hideNav ? (
        <nav className={TB.nav}>
          {navItems.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [TB.navLink, isActive ? TB.navActive : TB.navIdle].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="h-5 w-5" aria-hidden strokeWidth={isActive ? 2.25 : 1.9} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
