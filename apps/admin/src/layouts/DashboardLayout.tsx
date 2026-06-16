import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Bell, SlidersHorizontal, X } from 'lucide-react';
import { usePresence } from '@/lib/presence';
import { StoresHydrator } from '@/components/StoresHydrator';
import { MarineWeatherHeadlineProvider } from '@/contexts/MarineWeatherHeadlineContext';
import { PageFiltersProvider, usePageFiltersControl } from '@/contexts/PageFiltersContext';
import { MarineHeadlineHeaderButton } from '@/components/layout/MarineHeadlineHeaderButton';
import { NotificationsPanel } from '@/components/layout/NotificationsPanel';
import { InternalNotificationsPoller } from '@/components/InternalNotificationsPoller';
import { NotificationToastStack } from '@/components/layout/NotificationToastStack';
import { useNotificationsStore } from '@/stores/notifications';
import { useAppStoresReady, useCoreStoresReady } from '@/lib/useStoreHydration';
import { useAuthStore } from '@/stores/auth';
import { OwnerPortalOnboarding } from '@/components/owner/OwnerPortalOnboarding';
import { AdminOnboarding } from '@/components/admin/AdminOnboarding';
import { isOwnerUser } from '@/lib/userRoles';

export function DashboardLayout() {
  return (
    <PageFiltersProvider>
      <MarineWeatherHeadlineProvider>
        <DashboardLayoutInner />
      </MarineWeatherHeadlineProvider>
    </PageFiltersProvider>
  );
}

function DashboardLayoutInner() {
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';
  const { config, filtersOpen, setFiltersOpen } = usePageFiltersControl();
  const filtersPresence = usePresence(filtersOpen, 180);
  const notificationsOpen = useNotificationsStore((s) => s.panelOpen);
  const setNotificationsOpen = useNotificationsStore((s) => s.setPanelOpen);
  const unreadNotifications = useNotificationsStore((s) => s.items.filter((n) => !n.read).length);
  const notificationsPresence = usePresence(notificationsOpen, 180);
  const hasActiveFilters = (config?.activeFilterCount ?? 0) > 0;
  const isOwner = isOwnerUser(useAuthStore((s) => s.user.role));
  const appReady = isOwner ? useCoreStoresReady() : useAppStoresReady();

  useEffect(() => {
    setFiltersOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname, setFiltersOpen, setNotificationsOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-100 text-zinc-900">
      {!appReady ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-zinc-200/80"
          aria-hidden
        >
          <div className="bc-hydration-bar h-full w-1/3 bg-[#416B9F]" />
        </div>
      ) : null}
      <StoresHydrator />
      {isOwner ? <OwnerPortalOnboarding ready={appReady} /> : <AdminOnboarding ready={appReady} />}
      <InternalNotificationsPoller />
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-end bg-zinc-100/80 px-8 pt-6 backdrop-blur">
          <div className="relative flex items-center gap-3">
            <button
              type="button"
              data-tour={isOwner ? undefined : 'admin-header-notifications'}
              onClick={() => {
                setFiltersOpen(false);
                setNotificationsOpen(true);
              }}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200/90 bg-white shadow-sm transition-colors hover:bg-zinc-50"
              aria-label="Ouvrir les notifications"
              title="Notifications"
            >
              <Bell className="h-5 w-5 text-zinc-600" strokeWidth={1.75} aria-hidden />
              {unreadNotifications > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#416B9F] px-1 text-[10px] font-bold text-white ring-2 ring-zinc-100">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              ) : null}
            </button>
            {isDashboard ? (
              <MarineHeadlineHeaderButton />
            ) : (
              <button
                type="button"
                data-tour={isOwner ? undefined : 'admin-header-filters'}
                onClick={() => {
                  setNotificationsOpen(false);
                  setFiltersOpen(true);
                }}
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200/90 bg-white shadow-sm transition-colors hover:bg-zinc-50"
                aria-label="Ouvrir les filtres de la page"
                title="Filtres"
                aria-describedby={hasActiveFilters ? 'bc-filters-active-hint' : undefined}
              >
                <SlidersHorizontal className="h-5 w-5 text-zinc-600" strokeWidth={1.75} aria-hidden />
                {hasActiveFilters ? (
                  <span
                    className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#416B9F] ring-2 ring-white"
                    aria-hidden
                  />
                ) : null}
                {hasActiveFilters ? (
                  <span id="bc-filters-active-hint" className="sr-only">
                    Au moins un filtre est actif sur cette page.
                  </span>
                ) : null}
              </button>
            )}
            <NotificationToastStack />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-8">
          <div key={location.pathname} className="bc-animate bc-page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      <NotificationsPanel
        present={notificationsPresence.present}
        phase={notificationsPresence.phase}
        onClose={() => setNotificationsOpen(false)}
      />

      {filtersPresence.present ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className={[
              'absolute inset-0 bg-black/30 bc-animate',
              filtersPresence.phase === 'enter' ? 'bc-overlay-enter' : 'bc-overlay-exit',
            ].join(' ')}
            aria-label="Fermer les filtres"
            onClick={() => setFiltersOpen(false)}
          />
          <aside
            className={[
              'absolute right-0 top-0 h-full w-full max-w-md overflow-auto bg-white shadow-2xl bc-animate',
              filtersPresence.phase === 'enter' ? 'bc-panel-enter' : 'bc-panel-exit',
            ].join(' ')}
            aria-label="Panneau de filtres"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-zinc-200/80 bg-white/90 px-6 py-5 backdrop-blur">
              <div>
                <p className="text-lg font-bold tracking-tight text-zinc-900">{config?.title ?? 'Filtres'}</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {config?.subtitle ?? 'Sélectionne une page pour afficher des filtres adaptés.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200/90 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" strokeWidth={1.9} aria-hidden />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              {config?.panelBody ?? (
                <p className="text-sm text-zinc-500">Aucun filtre n’est défini pour cette page.</p>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-zinc-100 pt-5">
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="rounded-2xl bg-[#416B9F] px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-[#416B9F]/20 transition-colors hover:bg-[#365b87]"
                >
                  Appliquer
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
