import type { LucideIcon } from 'lucide-react';
import {
  CalendarPlus,
  CreditCard,
  LogIn,
  LogOut,
  Pencil,
  RotateCcw,
  Trash2,
  Undo2,
} from 'lucide-react';
import type { NotificationsSettings } from '@/stores/settings';

export type NotificationToggleKey = keyof Pick<
  NotificationsSettings,
  | 'onReservationCreated'
  | 'onReservationUpdated'
  | 'onReservationCancelled'
  | 'onReservationRestored'
  | 'onReservationDeleted'
  | 'onPaymentCaptured'
  | 'onRefundCreated'
  | 'onCheckInDone'
  | 'onCheckOutDone'
>;

export type NotificationGroupId = 'reservations' | 'payments' | 'checkflow';

export type NotificationToggleDef = {
  key: NotificationToggleKey;
  label: string;
  hint: string;
  Icon: LucideIcon;
};

export type NotificationGroupDef = {
  id: NotificationGroupId;
  title: string;
  description: string;
  theme: { border: string; bg: string; accent: string };
  items: NotificationToggleDef[];
};

export const NOTIFICATION_GROUPS: NotificationGroupDef[] = [
  {
    id: 'reservations',
    title: 'Réservations',
    description: 'Création, modification, annulation et suppression dans le calendrier.',
    theme: { border: 'border-sky-200', bg: 'bg-sky-50/50', accent: 'text-sky-800' },
    items: [
      { key: 'onReservationCreated', label: 'Nouvelle réservation', hint: 'Une réservation vient d’être créée.', Icon: CalendarPlus },
      { key: 'onReservationUpdated', label: 'Réservation modifiée', hint: 'Dates, bateau ou montants changés.', Icon: Pencil },
      { key: 'onReservationCancelled', label: 'Réservation annulée', hint: 'Statut annulé ou date d’annulation renseignée.', Icon: Trash2 },
      { key: 'onReservationRestored', label: 'Réservation rétablie', hint: 'Annulation retirée, réservation de nouveau active.', Icon: RotateCcw },
      { key: 'onReservationDeleted', label: 'Réservation supprimée', hint: 'Suppression définitive de la fiche.', Icon: Trash2 },
    ],
  },
  {
    id: 'payments',
    title: 'Paiements',
    description: 'Encaissements agence ou Stripe, remboursements.',
    theme: { border: 'border-emerald-200', bg: 'bg-emerald-50/50', accent: 'text-emerald-900' },
    items: [
      { key: 'onPaymentCaptured', label: 'Paiement encaissé', hint: 'Agence ou paiement en ligne Stripe confirmé.', Icon: CreditCard },
      { key: 'onRefundCreated', label: 'Remboursement', hint: 'Remboursement total ou partiel enregistré.', Icon: Undo2 },
    ],
  },
  {
    id: 'checkflow',
    title: 'Check-flow tablette',
    description: 'Départs et retours enregistrés sur tablette.',
    theme: { border: 'border-violet-200', bg: 'bg-violet-50/50', accent: 'text-violet-900' },
    items: [
      { key: 'onCheckInDone', label: 'Check-in effectué', hint: 'Formulaire de départ validé.', Icon: LogIn },
      { key: 'onCheckOutDone', label: 'Check-out effectué', hint: 'Retour bateau enregistré.', Icon: LogOut },
    ],
  },
];

export const ALL_NOTIFICATION_KEYS: NotificationToggleKey[] = NOTIFICATION_GROUPS.flatMap((g) =>
  g.items.map((i) => i.key),
);

export function countEnabledNotifications(n: NotificationsSettings): number {
  return ALL_NOTIFICATION_KEYS.filter((k) => n[k]).length;
}
