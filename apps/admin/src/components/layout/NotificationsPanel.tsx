import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, ChevronRight, X } from 'lucide-react';
import { NOTIFICATION_KIND_ACCENT_PANEL, NOTIFICATION_KIND_ICON } from '@/lib/appNotificationUi';
import { useNotificationsStore, type AppNotification } from '@/stores/notifications';

function groupLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startItem = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((startToday.getTime() - startItem.getTime()) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

type ReadFilter = 'unread' | 'read';

type NotificationsPanelProps = Readonly<{
  present: boolean;
  phase: 'enter' | 'exit';
  onClose: () => void;
}>;

export function NotificationsPanel({ present, phase, onClose }: NotificationsPanelProps) {
  const navigate = useNavigate();
  const items = useNotificationsStore((s) => s.items);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const clearAll = useNotificationsStore((s) => s.clearAll);
  const focusNotificationId = useNotificationsStore((s) => s.focusNotificationId);
  const clearFocusNotification = useNotificationsStore((s) => s.clearFocusNotification);
  const [readFilter, setReadFilter] = useState<ReadFilter>('unread');
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (!present || !focusNotificationId) return;
    const target = useNotificationsStore.getState().items.find((n) => n.id === focusNotificationId);
    if (target) setReadFilter(target.read ? 'read' : 'unread');
    setHighlightId(focusNotificationId);
    clearFocusNotification();
    const scrollTimer = globalThis.setTimeout(() => {
      document.getElementById(`bc-notif-${focusNotificationId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 280);
    const clearTimer = globalThis.setTimeout(() => setHighlightId(null), 2400);
    return () => {
      globalThis.clearTimeout(scrollTimer);
      globalThis.clearTimeout(clearTimer);
    };
  }, [present, focusNotificationId, clearFocusNotification]);

  if (!present) return null;

  const unreadCount = items.filter((n) => !n.read).length;
  const readCount = items.length - unreadCount;
  const filteredItems = items.filter((n) => (readFilter === 'unread' ? !n.read : n.read));

  const groups = new Map<string, AppNotification[]>();
  for (const n of filteredItems) {
    const key = new Date(n.createdAt).toDateString();
    const list = groups.get(key) ?? [];
    list.push(n);
    groups.set(key, list);
  }

  function notificationHref(n: AppNotification) {
    if (n.href.startsWith('/check-flow')) return n.href;
    if (n.reservationId) return `/calendrier?open=${encodeURIComponent(n.reservationId)}`;
    return n.href;
  }

  function openNotification(n: AppNotification) {
    if (!n.read) markRead(n.id);
    onClose();
    navigate(notificationHref(n));
  }

  function markNotificationRead(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    markRead(id);
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        className={[
          'absolute inset-0 bg-black/30 bc-animate',
          phase === 'enter' ? 'bc-overlay-enter' : 'bc-overlay-exit',
        ].join(' ')}
        aria-label="Fermer les notifications"
        onClick={onClose}
      />
      <aside
        className={[
          'absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl bc-animate',
          phase === 'enter' ? 'bc-panel-enter' : 'bc-panel-exit',
        ].join(' ')}
        aria-label="Notifications"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-zinc-200/80 bg-white/90 px-6 py-5 backdrop-blur">
          <div>
            <p className="text-lg font-bold tracking-tight text-zinc-900">Notifications</p>
            <p className="mt-1 text-sm text-zinc-500">
              {unreadCount > 0
                ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
                : readCount > 0
                  ? 'Tout est lu'
                  : 'Aucune activité récente'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200/90 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" strokeWidth={1.9} aria-hidden />
          </button>
        </header>

        {items.length > 0 ? (
          <div className="border-b border-zinc-100 px-6 py-3">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrer par statut de lecture">
              <button
                type="button"
                role="tab"
                aria-selected={readFilter === 'unread'}
                onClick={() => setReadFilter('unread')}
                className={[
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                  readFilter === 'unread'
                    ? 'bg-[#416B9F] text-white shadow-sm'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200',
                ].join(' ')}
              >
                Non lus <span className="tabular-nums opacity-90">({unreadCount})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={readFilter === 'read'}
                onClick={() => setReadFilter('read')}
                className={[
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                  readFilter === 'read'
                    ? 'bg-[#416B9F] text-white shadow-sm'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200',
                ].join(' ')}
              >
                Lus <span className="tabular-nums opacity-90">({readCount})</span>
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => markAllRead()}
                disabled={unreadCount === 0}
                className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#416B9F] hover:bg-[#416B9F]/10 disabled:opacity-40"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                Tout marquer lu
              </button>
              <button
                type="button"
                onClick={() => clearAll()}
                className="ml-auto rounded-xl px-2.5 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-100"
              >
                Effacer tout
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-auto px-4 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
                <Bell className="h-7 w-7 text-zinc-400" strokeWidth={1.5} aria-hidden />
              </div>
              <p className="text-sm font-medium text-zinc-700">Aucune notification</p>
              <p className="max-w-xs text-sm text-zinc-500">
                Réservations, check-in et check-out tablette apparaîtront ici.
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
              <p className="text-sm font-medium text-zinc-700">
                {readFilter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification lue'}
              </p>
              <p className="max-w-xs text-sm text-zinc-500">
                {readFilter === 'unread'
                  ? 'Les nouvelles alertes apparaîtront ici.'
                  : 'Les notifications consultées seront listées ici.'}
              </p>
              {readFilter === 'unread' && readCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setReadFilter('read')}
                  className="mt-2 text-sm font-semibold text-[#416B9F] hover:underline"
                >
                  Voir les {readCount} notification{readCount > 1 ? 's' : ''} lue{readCount > 1 ? 's' : ''}
                </button>
              ) : null}
              {readFilter === 'read' && unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setReadFilter('unread')}
                  className="mt-2 text-sm font-semibold text-[#416B9F] hover:underline"
                >
                  Voir les {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-6">
              {[...groups.entries()].map(([dayKey, groupItems]) => (
                <section key={dayKey}>
                  <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    {groupLabel(groupItems[0]!.createdAt)}
                  </h3>
                  <ul className="space-y-1">
                    {groupItems.map((n) => {
                      const Icon = NOTIFICATION_KIND_ICON[n.kind];
                      const accent = NOTIFICATION_KIND_ACCENT_PANEL[n.kind];
                      return (
                        <li key={n.id} id={`bc-notif-${n.id}`}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => openNotification(n)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openNotification(n);
                              }
                            }}
                            className={[
                              'group flex w-full cursor-pointer gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-zinc-50',
                              n.read ? 'opacity-75' : 'bg-[#416B9F]/[0.04]',
                              highlightId === n.id ? 'ring-2 ring-[#416B9F]/50 ring-offset-2' : '',
                            ].join(' ')}
                          >
                            <span
                              className={[
                                'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                                accent,
                              ].join(' ')}
                            >
                              <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-start justify-between gap-2">
                                <span className="text-sm font-semibold text-zinc-900">{n.title}</span>
                                <span className="shrink-0 text-xs text-zinc-400">{formatTime(n.createdAt)}</span>
                              </span>
                              <span className="mt-0.5 block text-sm text-zinc-600">
                                {n.boatName && n.clientName
                                  ? `${n.boatName} · ${n.clientName}`
                                  : n.message}
                              </span>
                            </span>
                            <span className="mt-0.5 flex shrink-0 flex-col items-end gap-1.5">
                              {!n.read ? (
                                <button
                                  type="button"
                                  onClick={(e) => markNotificationRead(e, n.id)}
                                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200/90 bg-white text-zinc-500 shadow-sm transition-colors hover:border-[#416B9F]/30 hover:bg-[#416B9F]/5 hover:text-[#416B9F]"
                                  aria-label="Marquer comme lu"
                                  title="Marquer comme lu"
                                >
                                  <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
                                </button>
                              ) : null}
                              <span className="flex items-center gap-0.5 text-zinc-300 transition-colors group-hover:text-[#416B9F]">
                                <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden />
                              </span>
                              {!n.read ? (
                                <span className="h-2 w-2 rounded-full bg-[#416B9F]" aria-hidden />
                              ) : null}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
