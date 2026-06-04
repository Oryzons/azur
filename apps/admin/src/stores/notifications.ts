import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';
import type { AppNotificationKind } from '@/lib/appNotificationUi';
import { serverKindToAppKind } from '@/lib/appNotificationUi';
import {
  buildReservationNotification,
  diffReservationNotificationKinds,
  formatReservationWhen,
  type ReservationNotificationKind,
} from '@/lib/reservationNotifications';
import type { StoredReservation } from '@/stores/reservations';
import { useReservationsStore } from '@/stores/reservations';
import { useBoatsStore } from '@/stores/boats';

export type AppNotification = {
  id: string;
  kind: AppNotificationKind;
  title: string;
  message: string;
  clientName: string;
  boatName: string;
  whenLabel: string;
  reservationId: string;
  href: string;
  read: boolean;
  createdAt: string;
  /** ID notification serveur (check-in/out tablette). */
  serverId?: string;
};

type ServerNotificationRow = {
  id: string;
  kind:
    | 'CHECK_IN_DONE'
    | 'CHECK_OUT_DONE'
    | 'PAYMENT_ONLINE_CAPTURED'
    | 'RESERVATION_CREATED'
    | 'RESERVATION_UPDATED'
    | 'RESERVATION_CANCELLED'
    | 'RESERVATION_RESTORED'
    | 'RESERVATION_REFUNDED'
    | 'RESERVATION_PARTIAL_REFUND'
    | 'RESERVATION_DELETED'
    | 'RESERVATION_PAID'
    | 'RENTAL_CONTRACT_SIGNED';
  title: string;
  message: string;
  reservationId: string;
  boatName: string | null;
  clientName: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
};

const MAX_ITEMS = 120;
const MAX_TOASTS = 4;

const TOASTED_SERVER_IDS_STORAGE_KEY = 'bc-toasted-server-ids';

function loadToastedServerIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(TOASTED_SERVER_IDS_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function persistToastedServerIds(ids: Set<string>) {
  try {
    // on garde un historique raisonnable (anti quota)
    sessionStorage.setItem(TOASTED_SERVER_IDS_STORAGE_KEY, JSON.stringify([...ids].slice(-400)));
  } catch {
    /* quota */
  }
}

const toastedServerIds = loadToastedServerIds();
const handledPaymentNotificationIds = new Set<string>();
let lastStripeSyncAt = 0;
const STRIPE_SYNC_INTERVAL_MS = 10_000;
const PAYMENT_SEEN_STORAGE_KEY = 'bc-seen-payment-notif-ids';

function loadSeenPaymentIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(PAYMENT_SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function persistSeenPaymentIds(ids: Set<string>) {
  try {
    sessionStorage.setItem(PAYMENT_SEEN_STORAGE_KEY, JSON.stringify([...ids].slice(-200)));
  } catch {
    /* quota */
  }
}

function uid() {
  return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function boatNameFor(boatId: string) {
  return useBoatsStore.getState().boats.find((b) => b.id === boatId)?.name ?? '';
}

function clientNameFromReservation(reservation: StoredReservation) {
  const fromTitle = reservation.title?.trim();
  if (fromTitle) return fromTitle;
  const d = reservation.details;
  const full = [d?.clientFirstName, d?.clientLastName].filter(Boolean).join(' ').trim();
  return full || 'Client';
}

function mapServerRow(row: ServerNotificationRow): AppNotification {
  return {
    id: `srv_${row.id}`,
    serverId: row.id,
    kind: serverKindToAppKind(row.kind),
    title: row.title,
    message: row.message,
    clientName: row.clientName ?? 'Client',
    boatName: row.boatName ?? 'Bateau',
    whenLabel: new Date(row.createdAt).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
    reservationId: row.reservationId,
    href: row.href ?? `/check-flow/historique?id=${row.id}`,
    read: row.read,
    createdAt: row.createdAt,
  };
}

interface NotificationsState {
  items: AppNotification[];
  toastIds: string[];
  focusNotificationId: string | null;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  pushReservation: (kind: ReservationNotificationKind, reservation: StoredReservation) => void;
  processReservationChanges: (batch: {
    created: StoredReservation[];
    updated: { before: StoredReservation; after: StoredReservation }[];
    deleted: StoredReservation[];
  }) => void;
  pollServerNotifications: () => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
  dismissToast: (id: string) => void;
  openPanelForNotification: (id: string) => void;
  clearFocusNotification: () => void;
  unreadCount: () => number;
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      items: [],
      toastIds: [],
      focusNotificationId: null,
      panelOpen: false,

      setPanelOpen: (open) => set({ panelOpen: open }),
      togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

      pushReservation: (kind, reservation) => {
        const boatName = boatNameFor(reservation.boatId) || 'Bateau';
        const clientName = clientNameFromReservation(reservation);
        const whenLabel = formatReservationWhen(reservation.start);
        const { title, message } = buildReservationNotification(kind, reservation, boatName);
        set((s) => {
          const recentDuplicate = s.items.some(
            (n) =>
              n.reservationId === reservation.id &&
              n.kind === kind &&
              Date.now() - new Date(n.createdAt).getTime() < 60_000,
          );
          if (recentDuplicate) return s;

          const item: AppNotification = {
            id: uid(),
            kind,
            title,
            message,
            clientName,
            boatName,
            whenLabel,
            reservationId: reservation.id,
            href: `/calendrier?open=${encodeURIComponent(reservation.id)}`,
            read: false,
            createdAt: new Date().toISOString(),
          };
          return {
            items: [item, ...s.items].slice(0, MAX_ITEMS),
            toastIds: [item.id, ...s.toastIds.filter((tid) => tid !== item.id)].slice(0, MAX_TOASTS),
          };
        });
      },

      processReservationChanges: (batch) => {
        const push = get().pushReservation;
        for (const r of batch.created) push('reservation_created', r);
        for (const { before, after } of batch.updated) {
          for (const kind of diffReservationNotificationKinds(before, after)) {
            push(kind, after);
          }
        }
        for (const r of batch.deleted) push('reservation_deleted', r);
      },

      async pollServerNotifications() {
        let shouldRefreshReservations = false;

        const now = Date.now();
        if (now - lastStripeSyncAt >= STRIPE_SYNC_INTERVAL_MS) {
          lastStripeSyncAt = now;
          try {
            const { data: syncData } = await api.post<{ synced?: string[] }>(
              '/reservations/sync-pending-stripe-payments',
            );
            if (Array.isArray(syncData?.synced) && syncData.synced.length > 0) {
              shouldRefreshReservations = true;
            }
          } catch {
            /* Stripe non configuré ou indisponible */
          }
        }

        try {
          const { data } = await api.get<ServerNotificationRow[]>('/internal-notifications', {
            params: { limit: 80 },
          });
          const rows = Array.isArray(data) ? data : [];
          const byServerId = new Map(rows.map((r) => [r.id, mapServerRow(r)]));
          const newToastIds: string[] = [];
          const seenPaymentIds = loadSeenPaymentIds();

          const reservationRefreshKinds = new Set([
            'PAYMENT_ONLINE_CAPTURED',
            'RESERVATION_PAID',
            'RENTAL_CONTRACT_SIGNED',
            'RESERVATION_CREATED',
            'RESERVATION_UPDATED',
            'RESERVATION_CANCELLED',
            'RESERVATION_RESTORED',
            'RESERVATION_REFUNDED',
            'RESERVATION_PARTIAL_REFUND',
            'RESERVATION_DELETED',
            'CHECK_IN_DONE',
            'CHECK_OUT_DONE',
          ]);

          for (const row of rows) {
            if (reservationRefreshKinds.has(row.kind) && !handledPaymentNotificationIds.has(row.id)) {
              handledPaymentNotificationIds.add(row.id);
              shouldRefreshReservations = true;
            }
            if (!row.read && !toastedServerIds.has(row.id)) {
              toastedServerIds.add(row.id);
              newToastIds.push(`srv_${row.id}`);
            }
          }
          persistToastedServerIds(toastedServerIds);
          persistSeenPaymentIds(seenPaymentIds);

          if (shouldRefreshReservations) {
            void useReservationsStore.getState().refresh();
          }

          set((s) => {
            const localOnly = s.items.filter((n) => !n.serverId);
            const mergedServer = [...byServerId.values()].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            );
            const items = [...mergedServer, ...localOnly].slice(0, MAX_ITEMS);
            const toastIds =
              newToastIds.length > 0
                ? [...newToastIds, ...s.toastIds].slice(0, MAX_TOASTS)
                : s.toastIds;
            return { items, toastIds };
          });
        } catch {
          /* API indisponible ou non autorisé */
        }
      },

      markRead: (id) => {
        const item = get().items.find((n) => n.id === id);
        if (item?.serverId) {
          void api.patch(`/internal-notifications/${item.serverId}/read`).catch(() => undefined);
        }
        set((s) => ({
          items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
          toastIds: s.toastIds.filter((tid) => tid !== id),
        }));
      },

      markAllRead: () => {
        void api.patch('/internal-notifications/read-all').catch(() => undefined);
        set((s) => ({
          items: s.items.map((n) => ({ ...n, read: true })),
          toastIds: [],
        }));
      },

      remove: (id) => {
        set((s) => ({
          items: s.items.filter((n) => n.id !== id),
          toastIds: s.toastIds.filter((tid) => tid !== id),
        }));
      },

      clearAll: () => {
        void api.delete('/internal-notifications').catch(() => undefined);
        toastedServerIds.clear();
        persistToastedServerIds(toastedServerIds);
        set({ items: [], toastIds: [], focusNotificationId: null });
      },

      dismissToast: (id) =>
        set((s) => ({
          toastIds: s.toastIds.filter((tid) => tid !== id),
        })),

      openPanelForNotification: (id) =>
        set({
          panelOpen: true,
          focusNotificationId: id,
          toastIds: get().toastIds.filter((tid) => tid !== id),
        }),

      clearFocusNotification: () => set({ focusNotificationId: null }),

      unreadCount: () => get().items.filter((n) => !n.read).length,
    }),
    {
      name: 'bc-admin-notifications',
      partialize: (s) => ({ items: s.items }),
    },
  ),
);
