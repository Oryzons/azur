import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { usePageFiltersControl } from '@/contexts/PageFiltersContext';
import {
  NOTIFICATION_KIND_ACCENT_TOAST,
  NOTIFICATION_KIND_BORDER_TOAST,
  NOTIFICATION_KIND_ICON,
} from '@/lib/appNotificationUi';
import { usePresence } from '@/lib/presence';
import { useNotificationsStore } from '@/stores/notifications';

const TOAST_TTL_MS = 12_000;
const TOAST_EXIT_MS = 220;

type NotificationToastCardProps = Readonly<{
  id: string;
  open: boolean;
  onExited: (id: string) => void;
}>;

function NotificationToastCard({ id, open, onExited }: NotificationToastCardProps) {
  const navigate = useNavigate();
  const notification = useNotificationsStore((s) => s.items.find((n) => n.id === id));
  const markRead = useNotificationsStore((s) => s.markRead);
  const dismissToast = useNotificationsStore((s) => s.dismissToast);
  const openPanelForNotification = useNotificationsStore((s) => s.openPanelForNotification);
  const { setFiltersOpen } = usePageFiltersControl();
  const presence = usePresence(open, TOAST_EXIT_MS);
  const [paused, setPaused] = useState(false);
  const dismissAtRef = useRef<number | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!presence.present) onExited(id);
  }, [presence.present, id, onExited]);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      globalThis.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const scheduleDismiss = useCallback(() => {
    if (!open || !notification || notification.read) return;
    if (dismissAtRef.current === null) {
      dismissAtRef.current = Date.now() + TOAST_TTL_MS;
    }
    const remaining = dismissAtRef.current - Date.now();
    if (remaining <= 0) {
      dismissToast(id);
      return;
    }
    clearDismissTimer();
    dismissTimerRef.current = globalThis.setTimeout(() => dismissToast(id), remaining);
  }, [clearDismissTimer, dismissToast, id, notification, open]);

  useEffect(() => {
    if (!open) {
      dismissAtRef.current = null;
      clearDismissTimer();
      return;
    }
    if (paused) {
      clearDismissTimer();
      return;
    }
    scheduleDismiss();
    return clearDismissTimer;
  }, [clearDismissTimer, open, paused, scheduleDismiss]);

  if (!presence.present || !notification) return null;

  const Icon = NOTIFICATION_KIND_ICON[notification.kind];
  const accent = NOTIFICATION_KIND_ACCENT_TOAST[notification.kind];
  const border = NOTIFICATION_KIND_BORDER_TOAST[notification.kind];
  const boatName = notification.boatName || 'Bateau';
  const clientName = notification.clientName || 'Client';
  const whenLabel = notification.whenLabel || '';

  function notificationTargetHref() {
    if (!notification) return '/calendrier';
    if (notification.href.startsWith('/check-flow')) return notification.href;
    if (notification.reservationId) {
      return `/calendrier?open=${encodeURIComponent(notification.reservationId)}`;
    }
    return notification.href;
  }

  function handleOpenTarget() {
    if (!notification) return;
    markRead(notification.id);
    dismissToast(id);
    setFiltersOpen(false);
    navigate(notificationTargetHref());
  }

  function handleOpenPanel(e: React.MouseEvent) {
    e.stopPropagation();
    setFiltersOpen(false);
    openPanelForNotification(notification!.id);
  }

  function handleMarkRead(e: React.MouseEvent) {
    e.stopPropagation();
    markRead(notification!.id);
  }

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    dismissToast(notification!.id);
  }

  return (
    <article
      className={[
        'bc-animate pointer-events-auto relative w-full overflow-hidden rounded-xl border border-zinc-200/70 border-l-[3px] bg-white/95 shadow-md shadow-zinc-900/[0.06] backdrop-blur-md',
        border,
        presence.phase === 'enter' ? 'bc-toast-enter' : 'bc-toast-exit',
      ].join(' ')}
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpenTarget}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOpenTarget();
          }
        }}
        className="flex w-full cursor-pointer items-start gap-2.5 px-2.5 py-2 pr-14 text-left transition-colors hover:bg-zinc-50/90"
      >
        <span className={['mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', accent].join(' ')}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="truncate text-[11px] font-semibold leading-tight text-zinc-900">{notification.title}</span>
          <span className="mt-0.5 block truncate text-[11px] font-medium leading-snug text-zinc-700">
            {boatName}
            <span className="font-normal text-zinc-400"> · </span>
            {clientName}
          </span>
          {whenLabel ? (
            <span className="mt-0.5 block truncate text-[10px] leading-tight text-zinc-400">{whenLabel}</span>
          ) : null}
          <span className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={handleMarkRead}
              className="text-[10px] font-semibold text-[#416B9F] hover:text-[#365b87]"
            >
              Marquer lu
            </button>
            <span className="text-zinc-200" aria-hidden>
              |
            </span>
            <button
              type="button"
              onClick={handleOpenPanel}
              className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-800"
            >
              Toutes
            </button>
          </span>
        </span>
      </div>

      {!notification.read ? (
        <button
          type="button"
          onClick={handleMarkRead}
          className="absolute right-6 top-1 flex h-5 w-5 items-center justify-center rounded-md text-[#416B9F] transition-colors hover:bg-[#416B9F]/10"
          aria-label="Marquer comme lu"
          title="Marquer comme lu"
        >
          <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        </button>
      ) : null}

      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
        aria-label="Fermer l’alerte"
      >
        <X className="h-3 w-3" strokeWidth={2.5} aria-hidden />
      </button>

      {open ? (
        <span
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-[#416B9F]/30 bc-toast-progress"
          style={{
            animationDuration: `${TOAST_TTL_MS}ms`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
          aria-hidden
        />
      ) : null}
    </article>
  );
}

export function NotificationToastStack() {
  const toastIds = useNotificationsStore((s) => s.toastIds);
  const items = useNotificationsStore((s) => s.items);
  const [mountedIds, setMountedIds] = useState<string[]>([]);

  const activeIds = useMemo(
    () =>
      toastIds.filter((tid) => {
        const n = items.find((item) => item.id === tid);
        return Boolean(n && !n.read);
      }),
    [items, toastIds],
  );

  useEffect(() => {
    setMountedIds((prev) => {
      const merged = new Set([...prev, ...toastIds]);
      return [...merged];
    });
  }, [toastIds]);

  const handleExited = useCallback((id: string) => {
    setMountedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  if (mountedIds.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute right-0 top-[calc(100%+0.35rem)] z-30 flex w-[17.5rem] flex-col gap-1.5"
      aria-label="Alertes récentes"
    >
      {mountedIds.map((id) => (
        <NotificationToastCard key={id} id={id} open={activeIds.includes(id)} onExited={handleExited} />
      ))}
    </div>
  );
}
