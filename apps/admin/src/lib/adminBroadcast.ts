/** Canal inter-onglets admin (ex. page succès paiement → calendrier). */
export const ADMIN_BROADCAST_CHANNEL = 'bc-admin-events';

export type AdminBroadcastMessage =
  | { type: 'payment-captured'; reservationId: string }
  | { type: 'poll-notifications' }
  | { type: 'reservations-changed' };

export function postAdminBroadcast(message: AdminBroadcastMessage) {
  try {
    const channel = new BroadcastChannel(ADMIN_BROADCAST_CHANNEL);
    channel.postMessage(message);
    channel.close();
  } catch {
    /* navigateur sans BroadcastChannel */
  }
}

export function subscribeAdminBroadcast(handler: (message: AdminBroadcastMessage) => void) {
  try {
    const channel = new BroadcastChannel(ADMIN_BROADCAST_CHANNEL);
    channel.onmessage = (e: MessageEvent<AdminBroadcastMessage>) => {
      if (e.data?.type) handler(e.data);
    };
    return () => channel.close();
  } catch {
    return () => undefined;
  }
}
