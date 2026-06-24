import { create } from 'zustand';
import { api } from '@/lib/api';
import { postAdminBroadcast } from '@/lib/adminBroadcast';

export type ExtraRentalStatus = 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED';
export type ExtraRentalPaymentChannel = 'online' | 'offline';

export type ExtraRental = {
  id: string;
  extraId: string;
  quantity: number;
  startAt: string;
  endAt: string;
  title: string;
  clientMemberId: string | null;
  clientEmail: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientPhone: string | null;
  paymentChannel: ExtraRentalPaymentChannel;
  totalDueCents: number | null;
  status: ExtraRentalStatus;
  paymentCapturedAt: string | null;
  settlementNote: string | null;
  internalNote: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  extra?: { id: string; name: string; icon: string | null; priceKind: string; paymentChannel: string };
};

export type ExtraRentalInput = {
  extraId: string;
  quantity?: number;
  startAt: string;
  endAt: string;
  clientMemberId?: string | null;
  clientEmail?: string | null;
  clientFirstName?: string | null;
  clientLastName?: string | null;
  clientPhone?: string | null;
  markPaid?: boolean;
  settlementNote?: string | null;
  internalNote?: string | null;
};

export type ExtraRentalUpdateInput = Partial<Omit<ExtraRentalInput, 'extraId'>> & {
  cancel?: boolean;
};

interface ExtraRentalsState {
  items: ExtraRental[];
  hydrated: boolean;
  refresh: () => Promise<void>;
  listByExtra: (extraId: string) => Promise<ExtraRental[]>;
  create: (input: ExtraRentalInput) => Promise<ExtraRental>;
  update: (id: string, input: ExtraRentalUpdateInput) => Promise<ExtraRental>;
  remove: (id: string) => Promise<void>;
}

let refreshGeneration = 0;

function bumpRefreshGeneration() {
  refreshGeneration += 1;
}

function sortItems(items: ExtraRental[]) {
  return [...items].sort((a, b) => b.startAt.localeCompare(a.startAt));
}

function mapPaymentChannel(v: string): ExtraRentalPaymentChannel {
  return String(v).toLowerCase() === 'offline' ? 'offline' : 'online';
}

function mapRow(row: ExtraRental): ExtraRental {
  return {
    ...row,
    paymentChannel: mapPaymentChannel(row.paymentChannel),
    extra: row.extra
      ? { ...row.extra, paymentChannel: mapPaymentChannel(row.extra.paymentChannel) }
      : undefined,
  };
}

function notifyChanged() {
  postAdminBroadcast({ type: 'extra-rentals-changed' });
}

export const useExtraRentalsStore = create<ExtraRentalsState>((set) => ({
  items: [],
  hydrated: false,

  async refresh() {
    const generation = refreshGeneration;
    const { data } = await api.get<ExtraRental[]>('/extra-rentals');
    if (generation !== refreshGeneration) return;
    set({ items: Array.isArray(data) ? sortItems(data.map(mapRow)) : [], hydrated: true });
  },

  async listByExtra(extraId) {
    const { data } = await api.get<ExtraRental[]>('/extra-rentals', { params: { extraId } });
    return Array.isArray(data) ? data.map(mapRow) : [];
  },

  async create(input) {
    const { data } = await api.post<ExtraRental>('/extra-rentals', input);
    const row = mapRow(data);
    bumpRefreshGeneration();
    set((s) => ({ items: sortItems([...s.items.filter((x) => x.id !== row.id), row]) }));
    notifyChanged();
    return row;
  },

  async update(id, input) {
    const { data } = await api.put<ExtraRental>(`/extra-rentals/${id}`, input);
    const row = mapRow(data);
    bumpRefreshGeneration();
    set((s) => ({ items: sortItems(s.items.map((x) => (x.id === id ? row : x))) }));
    notifyChanged();
    return row;
  },

  async remove(id) {
    await api.delete(`/extra-rentals/${id}`);
    bumpRefreshGeneration();
    set((s) => ({ items: s.items.filter((x) => x.id !== id) }));
    notifyChanged();
  },
}));

export function extraRentalClientLabel(r: Pick<ExtraRental, 'clientFirstName' | 'clientLastName' | 'clientEmail' | 'title'>) {
  const name = [r.clientFirstName, r.clientLastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  return r.clientEmail?.trim() || r.title;
}

export function extraRentalStatusLabel(status: ExtraRentalStatus) {
  if (status === 'PAID') return 'Payée';
  if (status === 'CANCELLED') return 'Annulée';
  return 'En attente';
}

export function formatExtraRentalAmount(cents: number | null | undefined) {
  if (cents == null) return '—';
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}
