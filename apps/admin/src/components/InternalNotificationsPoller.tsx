import { useEffect } from 'react';
import { subscribeAdminBroadcast } from '@/lib/adminBroadcast';
import { useNotificationsStore } from '@/stores/notifications';
import { useReservationsStore } from '@/stores/reservations';
import { useUnavailabilitiesStore } from '@/stores/unavailabilities';

const POLL_MS = 6_000;

/** Notifications serveur + sync Stripe automatique. Rafraîchit le calendrier dès qu’un paiement est capturé. */
export function InternalNotificationsPoller() {
  const poll = useNotificationsStore((s) => s.pollServerNotifications);

  useEffect(() => {
    const runPoll = () => void poll();

    runPoll();
    const id = window.setInterval(runPoll, POLL_MS);

    const unsubBroadcast = subscribeAdminBroadcast((msg) => {
      if (msg.type === 'payment-captured' || msg.type === 'reservations-changed') {
        void useReservationsStore.getState().refresh();
        runPoll();
      } else if (msg.type === 'unavailabilities-changed') {
        void useUnavailabilitiesStore.getState().refresh();
        runPoll();
      } else if (msg.type === 'poll-notifications') {
        runPoll();
      }
    });

    const onVisible = () => {
      if (document.visibilityState === 'visible') runPoll();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(id);
      unsubBroadcast();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [poll]);

  return null;
}
