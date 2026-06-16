import { create } from 'zustand';
import { api } from '@/lib/api';
import { postAdminBroadcast } from '@/lib/adminBroadcast';

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

/** Ignore les réponses GET arrivées après une mutation locale (évite d’effacer l’ajout optimiste). */
let refreshGeneration = 0;

function bumpRefreshGeneration() {
  refreshGeneration += 1;
}

function sortItems(items: BoatUnavailability[]) {
  return [...items].sort((a, b) => a.startAt.localeCompare(b.startAt));
}

function notifyUnavailabilitiesChanged() {
  postAdminBroadcast({ type: 'unavailabilities-changed' });
}

export const useUnavailabilitiesStore = create<UnavailabilitiesState>((set) => ({
  items: [],
  hydrated: false,

  async refresh() {
    const generation = refreshGeneration;
    const { data } = await api.get<BoatUnavailability[]>('/boat-unavailabilities');
    if (generation !== refreshGeneration) return;
    set({ items: Array.isArray(data) ? sortItems(data) : [], hydrated: true });
  },

  async create(input) {
    const { data } = await api.post<BoatUnavailability>('/boat-unavailabilities', input);
    bumpRefreshGeneration();
    set((s) => ({ items: sortItems([...s.items.filter((x) => x.id !== data.id), data]) }));
    notifyUnavailabilitiesChanged();
    return data;
  },

  async update(id, input) {
    const { data } = await api.put<BoatUnavailability>(`/boat-unavailabilities/${id}`, input);
    bumpRefreshGeneration();
    set((s) => ({ items: sortItems(s.items.map((x) => (x.id === id ? data : x))) }));
    notifyUnavailabilitiesChanged();
    return data;
  },

  async remove(id) {
    await api.delete(`/boat-unavailabilities/${id}`);
    bumpRefreshGeneration();
    set((s) => ({ items: s.items.filter((x) => x.id !== id) }));
    notifyUnavailabilitiesChanged();
  },
}));

export function deserializeUnavailability(row: BoatUnavailability) {
  return {
    ...row,
    start: new Date(row.startAt),
    end: new Date(row.endAt),
  };
}
