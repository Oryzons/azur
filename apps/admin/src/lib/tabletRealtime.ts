/** Rafraîchissement calendrier agent (polling + même onglet). */
export const TABLET_REALTIME_POLL_MS = 5_000;

const TABLET_REFRESH_EVENT = 'bc-tablet-calendar-refresh';

export function dispatchTabletCalendarRefresh() {
  window.dispatchEvent(new CustomEvent(TABLET_REFRESH_EVENT));
}

export function subscribeTabletCalendarRefresh(handler: () => void) {
  const fn = () => handler();
  window.addEventListener(TABLET_REFRESH_EVENT, fn);
  return () => window.removeEventListener(TABLET_REFRESH_EVENT, fn);
}
