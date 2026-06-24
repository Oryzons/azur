import { LogOut } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TabletRealtimePoller } from '@/components/tablet/TabletRealtimePoller';
import { TabletFloatingNav } from '@/components/tablet/TabletFloatingNav';
import { TabletPageTransition } from '@/components/tablet/TabletPageTransition';
import { TabletPwaInstallBanner } from '@/components/tablet/TabletPwaInstallBanner';
import { TabletStoresHydrator } from '@/components/TabletStoresHydrator';
import { TB } from '@/lib/tabletTheme';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';

function headerTitle(pathname: string): string {
  if (pathname.startsWith('/tablette/check-in')) return 'Check-in';
  if (pathname.startsWith('/tablette/check-out')) return 'Check-out';
  if (pathname.startsWith('/tablette/calendrier')) return 'Calendrier';
  if (pathname.startsWith('/tablette/reservations')) return 'Réservations';
  return 'Espace agent';
}

function isCheckFlowRoute(pathname: string): boolean {
  return pathname.includes('/check-in/') || pathname.includes('/check-out/');
}

function isImmersiveTabletRoute(pathname: string): boolean {
  return isCheckFlowRoute(pathname) || pathname.includes('/tablette/reservation/');
}

export function TabletLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const rt = useAuthStore((s) => s.refreshToken);
  const clear = useAuthStore((s) => s.clear);
  const inCheckFlow = isCheckFlowRoute(location.pathname);
  const immersive = isImmersiveTabletRoute(location.pathname);

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
      {inCheckFlow ? (
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
            className={TB.iconBtnRound}
            aria-label="Déconnexion"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.9} />
          </button>
        </header>
      ) : null}
      <TabletStoresHydrator />
      <TabletRealtimePoller />
      {!immersive ? <TabletPwaInstallBanner /> : null}
      <main
        className={[
          TB.main,
          'relative overflow-x-hidden',
          immersive ? 'bg-white pb-0' : 'bg-white',
          inCheckFlow ? 'bg-gradient-to-b from-zinc-100/90 to-white' : '',
        ].join(' ')}
      >
        <TabletPageTransition />
      </main>
      {!immersive ? <TabletFloatingNav /> : null}
    </div>
  );
}
