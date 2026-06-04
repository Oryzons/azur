import { create } from 'zustand';
import { api } from '@/lib/api';
import type { BoatType } from '@/stores/boats';

import { DEFAULT_RENTAL_DEPARTURE_LOCATION } from '@bleu-calanque/shared';

export const DEFAULT_NAVAL_BASE = DEFAULT_RENTAL_DEPARTURE_LOCATION;

export type AnnouncementLink =
  | { kind: 'existing_fleet'; fleetId: string }
  | { kind: 'existing_boat'; boatId: string }
  | { kind: 'new_fleet'; fleetName: string }
  | {
      kind: 'new_boat';
      brand: string;
      name: string;
      model: string;
      boatType: BoatType;
      maxPassengers: number;
      fleetId: string | null;
    };

export type Announcement = {
  id: string;
  title: string;
  navalBase: string;
  status: 'active';
  link: AnnouncementLink;
  presentationPhotos: string[];
  createdAt: string;
};

type AddPayload = Omit<Announcement, 'id' | 'createdAt'>;

interface AnnouncementsState {
  announcements: Announcement[];
  hydrated: boolean;
  refresh: () => Promise<void>;
  addAnnouncement: (a: AddPayload) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  removeAnnouncement: (id: string) => void;
}

function tmpIdNow() {
  return `tmp_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

function extractApiError(e: any, fallback: string): string {
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(' ') || fallback;
  if (typeof msg === 'string') return msg;
  return fallback;
}

function boatTypeToApi(t: BoatType) {
  if (t === 'bateau a moteur') return 'BATEAU_A_MOTEUR';
  if (t === 'semi rigide') return 'SEMI_RIGIDE';
  if (t === 'voilier') return 'VOILIER';
  if (t === 'catamaran') return 'CATAMARAN';
  if (t === 'trimaran') return 'TRIMARAN';
  if (t === 'péniche') return 'PENICHE';
  if (t === 'yacht') return 'YACHT';
  if (t === 'jetski') return 'JETSKI';
  if (t === 'engin nautique') return 'ENGIN_NAUTIQUE';
  return 'AUTRE';
}
function boatTypeFromApi(t: string): BoatType {
  if (t === 'BATEAU_A_MOTEUR') return 'bateau a moteur';
  if (t === 'SEMI_RIGIDE') return 'semi rigide';
  if (t === 'VOILIER') return 'voilier';
  if (t === 'CATAMARAN') return 'catamaran';
  if (t === 'TRIMARAN') return 'trimaran';
  if (t === 'PENICHE') return 'péniche';
  if (t === 'YACHT') return 'yacht';
  if (t === 'JETSKI') return 'jetski';
  if (t === 'ENGIN_NAUTIQUE') return 'engin nautique';
  return 'autre';
}

function photosFromApiRow(x: any): string[] {
  if (Array.isArray(x?.photos)) {
    return [...x.photos]
      .sort((a: { sortOrder?: number }, b: { sortOrder?: number }) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((p: { url?: string }) => String(p?.url ?? ''))
      .filter(Boolean);
  }
  if (Array.isArray(x?.presentationPhotos)) {
    return x.presentationPhotos.map((u: unknown) => String(u)).filter(Boolean);
  }
  return [];
}

function announcementToApi(a: AddPayload | Announcement) {
  const photos = a.presentationPhotos ?? [];
  const base = {
    title: a.title,
    navalBase: a.navalBase,
    status: 'ACTIVE' as const,
    presentationPhotos: photos,
    coverPhotoIndex: 0,
  };
  const link = a.link;
  if (link.kind === 'existing_fleet') {
    return {
      ...base,
      linkKind: 'EXISTING_FLEET',
      linkedFleetId: link.fleetId,
    };
  }
  if (link.kind === 'existing_boat') {
    return {
      ...base,
      linkKind: 'EXISTING_BOAT',
      linkedBoatId: link.boatId,
    };
  }
  if (link.kind === 'new_fleet') {
    return {
      ...base,
      linkKind: 'NEW_FLEET',
      newFleetName: link.fleetName,
    };
  }
  return {
    ...base,
    linkKind: 'NEW_BOAT',
    newBoatBrand: link.brand,
    newBoatName: link.name,
    newBoatModel: link.model,
    newBoatType: boatTypeToApi(link.boatType),
    newBoatMaxPassengers: link.maxPassengers,
    newBoatFleetId: link.fleetId,
  };
}

function announcementFromApi(x: any): Announcement {
  let link: AnnouncementLink;
  switch (x?.linkKind) {
    case 'EXISTING_BOAT':
      link = { kind: 'existing_boat', boatId: String(x.linkedBoatId ?? '') };
      break;
    case 'NEW_FLEET':
      link = { kind: 'new_fleet', fleetName: String(x.newFleetName ?? '') };
      break;
    case 'NEW_BOAT':
      link = {
        kind: 'new_boat',
        brand: String(x.newBoatBrand ?? ''),
        name: String(x.newBoatName ?? ''),
        model: String(x.newBoatModel ?? ''),
        boatType: boatTypeFromApi(String(x.newBoatType ?? 'AUTRE')),
        maxPassengers: Number(x.newBoatMaxPassengers ?? 1),
        fleetId: x.newBoatFleetId ? String(x.newBoatFleetId) : null,
      };
      break;
    case 'EXISTING_FLEET':
    default:
      link = { kind: 'existing_fleet', fleetId: String(x?.linkedFleetId ?? '') };
      break;
  }
  return {
    id: String(x?.id ?? ''),
    title: String(x?.title ?? ''),
    navalBase: String(x?.navalBase ?? ''),
    status: 'active',
    link,
    presentationPhotos: photosFromApiRow(x),
    createdAt: x?.createdAt ? new Date(x.createdAt).toISOString() : new Date().toISOString(),
  };
}

export const useAnnouncementsStore = create<AnnouncementsState>()((set, get) => ({
  announcements: [],
  hydrated: false,

  refresh: async () => {
    const { data } = await api.get('/announcements');
    const announcements = (Array.isArray(data) ? data : []).map(announcementFromApi);
    set({ announcements, hydrated: true });
  },

  addAnnouncement: async (a) => {
    const title = a.title.trim();
    if (!title) return { ok: false, error: 'Le titre est requis.' };
    const navalBase = a.navalBase.trim() || DEFAULT_NAVAL_BASE;

    const link = a.link;
    if (link.kind === 'existing_fleet' && !link.fleetId.trim()) return { ok: false, error: 'Choisis une flotille.' };
    if (link.kind === 'existing_boat' && !link.boatId.trim()) return { ok: false, error: 'Choisis un bateau.' };
    if (link.kind === 'new_fleet' && !link.fleetName.trim()) return { ok: false, error: 'Indique le nom de la nouvelle flotille.' };
    if (link.kind === 'new_boat') {
      if (!link.brand.trim() || !link.name.trim() || !link.model.trim()) {
        return { ok: false, error: 'Marque, nom et modèle du bateau sont requis.' };
      }
      const max = Number(link.maxPassengers);
      if (!Number.isFinite(max) || max < 1 || max > 200) return { ok: false, error: 'Passagers : nombre entre 1 et 200.' };
    }

    const tmpId = tmpIdNow();
    const optimistic: Announcement = { ...a, id: tmpId, title, navalBase, createdAt: new Date().toISOString() };
    set((s) => ({ announcements: [optimistic, ...s.announcements] }));

    try {
      const { data } = await api.post('/announcements', announcementToApi({ ...a, title, navalBase }));
      const real = announcementFromApi(data);
      set((s) => ({ announcements: s.announcements.map((x) => (x.id === tmpId ? real : x)) }));
      return { ok: true, id: real.id };
    } catch (e) {
      set((s) => ({ announcements: s.announcements.filter((x) => x.id !== tmpId) }));
      return { ok: false, error: extractApiError(e, 'Impossible de créer l’annonce.') };
    }
  },

  removeAnnouncement: (id) => {
    set((s) => ({ announcements: s.announcements.filter((x) => x.id !== id) }));
    void api.delete(`/announcements/${id}`).catch(() => {
      void get().refresh();
    });
  },
}));
