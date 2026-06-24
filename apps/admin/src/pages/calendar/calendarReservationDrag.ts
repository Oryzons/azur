import { CALENDAR_BOAT_ROW_DRAG_MIME } from '@/pages/calendar/calendarConstants';

export const RESERVATION_DRAG_MIME = 'application/x-bleu-calanque-reservation-id';

export function setReservationDragData(dataTransfer: DataTransfer, reservationId: string) {
  dataTransfer.setData(RESERVATION_DRAG_MIME, reservationId);
  dataTransfer.setData('text/plain', reservationId);
  dataTransfer.effectAllowed = 'move';
}

export function isReservationDragEvent(e: React.DragEvent): boolean {
  const types = Array.from(e.dataTransfer.types);
  if (types.includes(CALENDAR_BOAT_ROW_DRAG_MIME)) return false;
  if (types.includes(RESERVATION_DRAG_MIME)) return true;
  if (types.includes('text/plain')) return true;
  if (types.some((t) => t.toLowerCase() === 'text/reservationid')) return true;
  return false;
}

export function readReservationDragId(dataTransfer: DataTransfer): string | null {
  const typed = dataTransfer.getData(RESERVATION_DRAG_MIME).trim();
  if (typed) return typed;
  const plain = dataTransfer.getData('text/plain').trim();
  if (plain) return plain;
  const legacy = dataTransfer.getData('text/reservationId').trim();
  return legacy || null;
}

export function allowReservationDragOver(e: React.DragEvent) {
  if (!isReservationDragEvent(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}
