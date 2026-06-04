import { useEffect } from 'react';
import { dispatchTabletCalendarRefresh, TABLET_REALTIME_POLL_MS } from '@/lib/tabletRealtime';
import { useReservationsStore } from '@/stores/reservations';

/** Sync calendrier agent ↔ modifications admin (polling léger). */
export function TabletRealtimePoller() {
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      dispatchTabletCalendarRefresh();
      const rs = useReservationsStore.getState();
      if (rs.hydrated) void rs.refresh();
    };

    tick();
    const id = window.setInterval(tick, TABLET_REALTIME_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
