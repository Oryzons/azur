import {
  CalendarPlus,
  CreditCard,
  FileCheck,
  LogIn,
  LogOut,
  Pencil,
  RotateCcw,
  Trash2,
  Undo2,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReservationNotificationKind } from '@/lib/reservationNotifications';

export type CheckFlowNotificationKind = 'check_in_done' | 'check_out_done';

export type AppNotificationKind = ReservationNotificationKind | CheckFlowNotificationKind;

export const NOTIFICATION_KIND_ICON: Record<AppNotificationKind, LucideIcon> = {
  reservation_created: CalendarPlus,
  reservation_updated: Pencil,
  reservation_paid: CreditCard,
  reservation_contract_signed: FileCheck,
  reservation_cancelled: Trash2,
  reservation_restored: RotateCcw,
  reservation_refunded: Undo2,
  reservation_partial_refund: Wallet,
  reservation_deleted: Trash2,
  check_in_done: LogIn,
  check_out_done: LogOut,
};

export const NOTIFICATION_KIND_ACCENT_PANEL: Record<AppNotificationKind, string> = {
  reservation_created: 'bg-emerald-50 text-emerald-700',
  reservation_updated: 'bg-sky-50 text-sky-700',
  reservation_paid: 'bg-green-50 text-green-700',
  reservation_contract_signed: 'bg-emerald-50 text-emerald-800',
  reservation_cancelled: 'bg-red-50 text-red-700',
  reservation_restored: 'bg-amber-50 text-amber-800',
  reservation_refunded: 'bg-indigo-50 text-indigo-700',
  reservation_partial_refund: 'bg-fuchsia-50 text-fuchsia-800',
  reservation_deleted: 'bg-zinc-100 text-zinc-600',
  check_in_done: 'bg-[#416B9F]/15 text-[#416B9F]',
  check_out_done: 'bg-teal-50 text-teal-700',
};

export const NOTIFICATION_KIND_ACCENT_TOAST: Record<AppNotificationKind, string> = {
  reservation_created: 'bg-emerald-500/10 text-emerald-600',
  reservation_updated: 'bg-sky-500/10 text-sky-600',
  reservation_paid: 'bg-green-500/10 text-green-600',
  reservation_contract_signed: 'bg-emerald-500/10 text-emerald-600',
  reservation_cancelled: 'bg-red-500/10 text-red-600',
  reservation_restored: 'bg-amber-500/10 text-amber-700',
  reservation_refunded: 'bg-indigo-500/10 text-indigo-600',
  reservation_partial_refund: 'bg-fuchsia-500/10 text-fuchsia-600',
  reservation_deleted: 'bg-zinc-500/10 text-zinc-500',
  check_in_done: 'bg-[#416B9F]/15 text-[#416B9F]',
  check_out_done: 'bg-teal-500/10 text-teal-600',
};

export const NOTIFICATION_KIND_BORDER_TOAST: Record<AppNotificationKind, string> = {
  reservation_created: 'border-l-emerald-500',
  reservation_updated: 'border-l-sky-500',
  reservation_paid: 'border-l-green-500',
  reservation_contract_signed: 'border-l-emerald-500',
  reservation_cancelled: 'border-l-red-500',
  reservation_restored: 'border-l-amber-500',
  reservation_refunded: 'border-l-indigo-500',
  reservation_partial_refund: 'border-l-fuchsia-500',
  reservation_deleted: 'border-l-zinc-500',
  check_in_done: 'border-l-[#416B9F]',
  check_out_done: 'border-l-teal-500',
};

export type ServerNotificationKind =
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
  | 'RENTAL_CONTRACT_SIGNED'
  | 'RESERVATION_ON_OWNER_BOAT'
  | 'UNAVAILABILITY_CREATED'
  | 'UNAVAILABILITY_UPDATED'
  | 'UNAVAILABILITY_DELETED';

export function serverKindToAppKind(kind: ServerNotificationKind): AppNotificationKind {
  if (kind === 'PAYMENT_ONLINE_CAPTURED' || kind === 'RESERVATION_PAID') return 'reservation_paid';
  if (kind === 'RENTAL_CONTRACT_SIGNED') return 'reservation_contract_signed';
  if (kind === 'CHECK_IN_DONE') return 'check_in_done';
  if (kind === 'CHECK_OUT_DONE') return 'check_out_done';
  if (kind === 'RESERVATION_ON_OWNER_BOAT' || kind === 'RESERVATION_CREATED') return 'reservation_created';
  if (kind === 'RESERVATION_UPDATED') return 'reservation_updated';
  if (kind === 'RESERVATION_CANCELLED') return 'reservation_cancelled';
  if (kind === 'RESERVATION_RESTORED') return 'reservation_restored';
  if (kind === 'RESERVATION_REFUNDED') return 'reservation_refunded';
  if (kind === 'RESERVATION_PARTIAL_REFUND') return 'reservation_partial_refund';
  if (kind === 'RESERVATION_DELETED') return 'reservation_deleted';
  if (kind === 'UNAVAILABILITY_CREATED' || kind === 'UNAVAILABILITY_UPDATED' || kind === 'UNAVAILABILITY_DELETED') {
    return 'reservation_updated';
  }
  return 'reservation_updated';
}
