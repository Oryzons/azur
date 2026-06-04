import { create } from 'zustand';
import { api } from '@/lib/api';

export type BoatUnavailability = {
  id: string;
  boatId: string;
  title: string;
  reason: 'REPAIR' | 'PRIVATE_USE' | 'WEATHER' | 'OTHER';
  note: string | null;
  startAt: string;
  endAt: string;
  createdByUserId: string | null;
  boat?: { id: string; name: string; brand: string };
};

export type UnavailabilityInput = {
  boatId: string;
  title: string;
  reason?: BoatUnavailability['reason'];
  note?: string | null;
  startAt: string;
  endAt: string;
};

interface UnavailabilitiesState {
  items: BoatUnavailability[];
  hydrated: boolean;
  refresh: () => Promise<void>;
  create: (input: UnavailabilityInput) => Promise<BoatUnavailability>;
  update: (id: string, input: UnavailabilityInput) => Promise<BoatUnavailability>;
  remove: (id: string) => Promise<void>;
}

export const useUnavailabilitiesStore = create<UnavailabilitiesState>((set) => ({
  items: [],
  hydrated: false,

  async refresh() {
    const { data } = await api.get<BoatUnavailability[]>('/boat-unavailabilities');
    set({ items: Array.isArray(data) ? data : [], hydrated: true });
  },

  async create(input) {
    const { data } = await api.post<BoatUnavailability>('/boat-unavailabilities', input);
    set((s) => ({ items: [...s.items, data].sort((a, b) => a.startAt.localeCompare(b.startAt)) }));
    return data;
  },

  async update(id, input) {
    const { data } = await api.put<BoatUnavailability>(`/boat-unavailabilities/${id}`, input);
    set((s) => ({
      items: s.items.map((x) => (x.id === id ? data : x)).sort((a, b) => a.startAt.localeCompare(b.startAt)),
    }));
    return data;
  },

  async remove(id) {
    await api.delete(`/boat-unavailabilities/${id}`);
    set((s) => ({ items: s.items.filter((x) => x.id !== id) }));
  },
}));

export function deserializeUnavailability(row: BoatUnavailability) {
  return {
    ...row,
    start: new Date(row.startAt),
    end: new Date(row.endAt),
  };
}
