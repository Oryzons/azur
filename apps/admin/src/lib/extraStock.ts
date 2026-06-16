import type { ExtraAvailability } from '@bleu-calanque/shared';
import { api } from '@/lib/api';
import { slotRangeIso } from '@/lib/calendarRentalPricing';

export async function fetchExtraAvailability(input: {
  dateIso: string;
  startTime: string;
  endTime: string;
  excludeReservationId?: string;
}): Promise<Record<string, ExtraAvailability>> {
  const range = slotRangeIso(input.dateIso, input.startTime, input.endTime);
  if (!range) return {};

  const { data } = await api.get<Record<string, ExtraAvailability>>('/extras/availability', {
    params: {
      start: range.start,
      end: range.end,
      ...(input.excludeReservationId ? { excludeReservationId: input.excludeReservationId } : {}),
    },
  });
  return data ?? {};
}
