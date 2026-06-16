import { create } from 'zustand';
import { api } from '@/lib/api';

export type BoatType =
  | 'bateau a moteur'
  | 'semi rigide'
  | 'voilier'
  | 'catamaran'
  | 'trimaran'
  | 'péniche'
  | 'yacht'
  | 'jetski'
  | 'engin nautique'
  | 'autre';

export type Fleet = { id: string; name: string };

export type WindlassType = '' | 'electrique' | 'hydraulique' | 'manuel';

export type BoatDetails = {
  generales: {
    registrationNumber: string;
    constructionYear: string;
    renovationYear: string;
    /** Zone / catégorie de navigation autorisée (contrat PDF). */
    authorizedNavigationZone: string;
  };
  dimensions: { longueur: string; largeur: string; tirantEau: string };
  motorisation: {
    engineCount: string;
    fuelType: string;
    drivetrain: '' | 'inboard' | 'hors-board';
    enginePurchaseYear: string;
    manufacturer: string;
    engineModel: string;
    totalPowerCv: string;
    consumptionLh: string;
    capacityL: string;
  };
  equipements: {
    selected: Record<string, boolean>;
    waterCapacityL: string;
    batteryCount: string;
    windlassType: WindlassType;
  };
  /** Documents réglementaires du bateau (assurance, gestion, circulation, annexe 240). */
  legalite: BoatLegalite;
};

export type BoatLegalDocument = {
  /** Référence / n° du document. */
  numero: string;
  /** Organisme émetteur (assureur, gestionnaire, préfecture…). */
  organisme: string;
  /** Date de fin de validité (à renouveler avant), format YYYY-MM-DD. */
  dateFin: string;
  /** Pièce jointe (data URL ou URL HTTPS après enregistrement). */
  fileUrl: string;
};

export type BoatLegaliteAssurance = BoatLegalDocument & {
  montantFranchise: string;
  valeurAssuree: string;
  locationCouverte: boolean;
};

export type BoatLegalite = {
  assurance: BoatLegaliteAssurance;
  contratGestion: BoatLegalDocument;
  carteCirculation: BoatLegalDocument;
  annexe240: BoatLegalDocument;
};

function emptyLegalDocument(): BoatLegalDocument {
  return { numero: '', organisme: '', dateFin: '', fileUrl: '' };
}

function defaultLegaliteAssurance(): BoatLegaliteAssurance {
  return {
    ...emptyLegalDocument(),
    montantFranchise: '',
    valeurAssuree: '',
    locationCouverte: false,
  };
}

export function defaultBoatLegalite(): BoatLegalite {
  return {
    assurance: defaultLegaliteAssurance(),
    contratGestion: emptyLegalDocument(),
    carteCirculation: emptyLegalDocument(),
    annexe240: emptyLegalDocument(),
  };
}

export function defaultBoatDetails(): BoatDetails {
  return {
    generales: {
      registrationNumber: '',
      constructionYear: '',
      renovationYear: '',
      authorizedNavigationZone: '',
    },
    dimensions: { longueur: '', largeur: '', tirantEau: '' },
    motorisation: {
      engineCount: '',
      fuelType: '',
      drivetrain: '',
      enginePurchaseYear: '',
      manufacturer: '',
      engineModel: '',
      totalPowerCv: '',
      consumptionLh: '',
      capacityL: '',
    },
    equipements: { selected: {}, waterCapacityL: '', batteryCount: '', windlassType: '' },
    legalite: defaultBoatLegalite(),
  };
}

type LegacyAssurance = {
  assureurActuel?: string;
  numeroContrat?: string;
  montantFranchise?: string;
  valeurAssuree?: string;
  locationCouverte?: boolean;
  dateFin?: string;
  numero?: string;
  organisme?: string;
};

function mergeLegalDocument(
  base: BoatLegalDocument,
  patch?: Partial<BoatLegalDocument> | null,
): BoatLegalDocument {
  if (!patch) return { ...base };
  return {
    numero: (patch.numero ?? base.numero).trim(),
    organisme: (patch.organisme ?? base.organisme).trim(),
    dateFin: (patch.dateFin ?? base.dateFin).trim(),
    fileUrl: (patch.fileUrl ?? base.fileUrl).trim(),
  };
}

function mergeLegaliteAssurance(
  base: BoatLegaliteAssurance,
  patch?: Partial<BoatLegaliteAssurance> | null,
): BoatLegaliteAssurance {
  if (!patch) return { ...base };
  return {
    numero: (patch.numero ?? base.numero).trim(),
    organisme: (patch.organisme ?? base.organisme).trim(),
    dateFin: (patch.dateFin ?? base.dateFin).trim(),
    montantFranchise: (patch.montantFranchise ?? base.montantFranchise).trim(),
    valeurAssuree: (patch.valeurAssuree ?? base.valeurAssuree).trim(),
    locationCouverte: patch.locationCouverte ?? base.locationCouverte,
    fileUrl: (patch.fileUrl ?? base.fileUrl).trim(),
  };
}

function migrateLegacyAssurance(legacy?: LegacyAssurance | null): BoatLegaliteAssurance {
  const base = defaultLegaliteAssurance();
  if (!legacy) return base;
  return {
    numero: legacy.numeroContrat?.trim() ?? legacy.numero?.trim() ?? '',
    organisme: legacy.assureurActuel?.trim() ?? legacy.organisme?.trim() ?? '',
    dateFin: legacy.dateFin?.trim() ?? '',
    montantFranchise: legacy.montantFranchise?.trim() ?? '',
    valeurAssuree: legacy.valeurAssuree?.trim() ?? '',
    locationCouverte: Boolean(legacy.locationCouverte),
    fileUrl: '',
  };
}

function mergeBoatDetails(raw: unknown): BoatDetails {
  const base = defaultBoatDetails();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<BoatDetails> & { assurance?: LegacyAssurance };
  const legaliteRaw = r.legalite;
  const legacyAssurance = r.assurance;
  const legaliteBase = defaultBoatLegalite();
  const legalite: BoatLegalite = legaliteRaw
    ? {
        assurance: mergeLegaliteAssurance(legaliteBase.assurance, legaliteRaw.assurance),
        contratGestion: mergeLegalDocument(legaliteBase.contratGestion, legaliteRaw.contratGestion),
        carteCirculation: mergeLegalDocument(legaliteBase.carteCirculation, legaliteRaw.carteCirculation),
        annexe240: mergeLegalDocument(legaliteBase.annexe240, legaliteRaw.annexe240),
      }
    : {
        ...legaliteBase,
        assurance: migrateLegacyAssurance(legacyAssurance),
        contratGestion: legaliteBase.contratGestion,
        carteCirculation: legaliteBase.carteCirculation,
        annexe240: legaliteBase.annexe240,
      };

  return {
    generales: { ...base.generales, ...(r.generales ?? {}) },
    dimensions: { ...base.dimensions, ...(r.dimensions ?? {}) },
    motorisation: { ...base.motorisation, ...(r.motorisation ?? {}) },
    equipements: {
      ...base.equipements,
      ...(r.equipements ?? {}),
      selected: {
        ...base.equipements.selected,
        ...((r.equipements && typeof r.equipements === 'object' && (r.equipements as { selected?: Record<string, boolean> }).selected) ||
          {}),
      },
    },
    legalite,
  };
}

export type Boat = {
  id: string;
  brand: string;
  name: string;
  model: string;
  boatType: BoatType;
  maxPassengers: number;
  ownerId: string | null;
  fleetId: string | null;
  /** Caution (€), défaut 2500. */
  depositEuros: number;
  presentationPhotos: string[]; // Data URLs (persistés)
  details: BoatDetails;
};

/** Libellés UI partagés (formulaires liste déroulante, annonces, etc.). */
export const BOAT_TYPES_UI: { value: BoatType; label: string }[] = [
  { value: 'bateau a moteur', label: 'Bateau à moteur' },
  { value: 'semi rigide', label: 'Semi-rigide' },
  { value: 'voilier', label: 'Voilier' },
  { value: 'catamaran', label: 'Catamaran' },
  { value: 'trimaran', label: 'Trimaran' },
  { value: 'péniche', label: 'Péniche' },
  { value: 'yacht', label: 'Yacht' },
  { value: 'jetski', label: 'Jetski' },
  { value: 'engin nautique', label: 'Engin nautique' },
  { value: 'autre', label: 'Autre' },
];

interface BoatsState {
  fleets: Fleet[];
  boats: Boat[];
  hydrated: boolean;
  refresh: () => Promise<void>;
  addFleet: (name: string) => { ok: true; id: string } | { ok: false; error: string };
  updateFleet: (id: string, name: string) => { ok: true } | { ok: false; error: string };
  removeFleet: (id: string) => void;
  addBoat: (b: Omit<Boat, 'id'>) => { ok: true; id: string } | { ok: false; error: string };
  updateBoat: (id: string, b: Omit<Boat, 'id'>) => Promise<{ ok: true } | { ok: false; error: string }>;
  setBoatDepositEuros: (id: string, euros: number) => void;
  removeBoat: (id: string) => void;
}

export const useBoatsStore = create<BoatsState>()(
  (set, get) => ({
    fleets: [],
    boats: [],
    hydrated: false,

    refresh: async () => {
      const [fleetsRes, boatsRes] = await Promise.all([api.get('/fleets'), api.get('/boats')]);
      const fleets: Fleet[] = (Array.isArray(fleetsRes.data) ? fleetsRes.data : []).map(mapFleetFromApi);
      const boats: Boat[] = (Array.isArray(boatsRes.data) ? boatsRes.data : []).map(mapBoatFromApi);
      set({ fleets, boats, hydrated: true });
    },

    addFleet: (name: string) => {
      const v = name.trim();
      if (!v) return { ok: false, error: 'Le nom de la flotille est requis.' };

      const tmpId = tmpIdNow();
      set((s) => ({ fleets: [...s.fleets, { id: tmpId, name: v }] }));
      void createFleetApi(tmpId, v, set);
      return { ok: true, id: tmpId };
      },

    updateFleet: (id: string, name: string) => {
        const v = name.trim();
        if (!v) return { ok: false, error: 'Le nom de la flotille est requis.' };
        set((s) => ({ fleets: s.fleets.map((f) => (f.id === id ? { ...f, name: v } : f)) }));
        void api.patch(`/fleets/${id}`, { name: v }).catch(() => {
          void get().refresh();
        });
        return { ok: true };
      },

    removeFleet: (id: string) => {
        set((s) => ({
          fleets: s.fleets.filter((f) => f.id !== id),
          boats: s.boats.map((b) => (b.fleetId === id ? { ...b, fleetId: null } : b)),
        }));
        void api.delete(`/fleets/${id}`).catch(() => {
          void get().refresh();
        });
      },

    addBoat: (b: Omit<Boat, 'id'>) => {
        const brand = b.brand.trim();
        const name = b.name.trim();
        const model = b.model.trim();
        const max = Number(b.maxPassengers);

        if (!brand || !name || !model) return { ok: false, error: 'Marque, nom du bateau et modèle sont requis.' };
        if (!Number.isFinite(max) || max < 1 || max > 200) {
          return { ok: false, error: 'Le nombre de passagers doit être un nombre entre 1 et 200.' };
        }

        const details = mergeBoatDetails(b.details);
        const tmpId = tmpIdNow();
        set((s) => ({
          boats: [
            ...s.boats,
            {
              ...b,
              id: tmpId,
              brand,
              name,
              model,
              maxPassengers: max,
              ownerId: b.ownerId || null,
              fleetId: b.fleetId || null,
              depositEuros: Number.isFinite(b.depositEuros) ? b.depositEuros : 2500,
              details,
            },
          ],
        }));

        void createBoatApi(
          tmpId,
          {
            brand,
            name,
            model,
            boatType: b.boatType,
            maxPassengers: max,
            ownerId: b.ownerId || null,
            fleetId: b.fleetId || null,
            presentationPhotos: b.presentationPhotos ?? [],
            details,
            depositAmountCents: Math.round((Number.isFinite(b.depositEuros) ? b.depositEuros : 2500) * 100),
          },
          set,
        );

        return { ok: true, id: tmpId };
      },

    updateBoat: async (id: string, b: Omit<Boat, 'id'>) => {
        const brand = b.brand.trim();
        const name = b.name.trim();
        const model = b.model.trim();
        const max = Number(b.maxPassengers);

        if (!brand || !name || !model) return { ok: false, error: 'Marque, nom du bateau et modèle sont requis.' };
        if (!Number.isFinite(max) || max < 1 || max > 200) {
          return { ok: false, error: 'Le nombre de passagers doit être un nombre entre 1 et 200.' };
        }

        const prev = get().boats.find((x) => x.id === id);
        if (!prev) return { ok: false, error: 'Bateau introuvable.' };

        const details = mergeBoatDetails(b.details);
        const photos = b.presentationPhotos ?? [];
        const optimistic: Boat = {
          ...prev,
          ...b,
          brand,
          name,
          model,
          maxPassengers: max,
          ownerId: b.ownerId || null,
          fleetId: b.fleetId || null,
          depositEuros: Number.isFinite(b.depositEuros) ? b.depositEuros : prev.depositEuros,
          presentationPhotos: photos,
          details,
        };
        set((s) => ({ boats: s.boats.map((x) => (x.id === id ? optimistic : x)) }));

        try {
          const { data } = await api.patch(`/boats/${id}`, {
            brand,
            name,
            model,
            boatType: boatTypeToApi(b.boatType),
            maxPassengers: max,
            ownerMemberId: b.ownerId || null,
            fleetId: b.fleetId || null,
            presentationPhotos: photos,
            coverPhotoIndex: 0,
            detailsJson: JSON.stringify(details),
            depositAmountCents: Math.round((Number.isFinite(b.depositEuros) ? b.depositEuros : 2500) * 100),
          });
          const saved = mapBoatFromApi(data);
          set((s) => ({ boats: s.boats.map((x) => (x.id === id ? saved : x)) }));
          return { ok: true };
        } catch (e) {
          set((s) => ({ boats: s.boats.map((x) => (x.id === id ? prev : x)) }));
          return { ok: false, error: extractBoatApiError(e, 'Impossible d’enregistrer le bateau (vérifie la taille des photos).') };
        }
      },

    setBoatDepositEuros: (id, euros) => {
      const v = Number(euros);
      if (!Number.isFinite(v) || v < 0) return;
      const cents = Math.round(v * 100);
      set((s) => ({
        boats: s.boats.map((x) => (x.id === id ? { ...x, depositEuros: Math.round(v * 100) / 100 } : x)),
      }));
      void api.patch(`/boats/${id}/deposit`, { depositAmountCents: cents }).catch(() => {
        void get().refresh();
      });
    },

    removeBoat: (id: string) => {
      set((s) => ({ boats: s.boats.filter((b) => b.id !== id) }));
      void api.delete(`/boats/${id}`).catch(() => {
        void get().refresh();
      });
    },
  }),
);

function tmpIdNow() {
  return `tmp_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

function extractBoatApiError(e: unknown, fallback: string): string {
  const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(' ') || fallback;
  if (typeof msg === 'string') return msg;
  return fallback;
}

function mapFleetFromApi(f: any): Fleet {
  return { id: String(f?.id ?? ''), name: String(f?.name ?? '') };
}

function depositEurosFromApi(cents: unknown): number {
  const n = Number(cents);
  if (!Number.isFinite(n)) return 2500;
  return Math.round(n) / 100;
}

function mapBoatFromApi(b: any): Boat {
  let parsedDetails: unknown = null;
  if (typeof b?.detailsJson === 'string' && b.detailsJson) {
    try {
      parsedDetails = JSON.parse(b.detailsJson);
    } catch {
      parsedDetails = null;
    }
  }
  return {
    id: String(b?.id ?? ''),
    brand: String(b?.brand ?? ''),
    name: String(b?.name ?? ''),
    model: String(b?.model ?? ''),
    boatType: boatTypeFromApi(String(b?.boatType ?? 'AUTRE')),
    maxPassengers: Number(b?.maxPassengers ?? 1),
    ownerId: b?.ownerMemberId ? String(b.ownerMemberId) : null,
    fleetId: b?.fleetId ? String(b.fleetId) : null,
    depositEuros: depositEurosFromApi(b?.depositAmountCents),
    presentationPhotos: Array.isArray(b?.photos)
      ? [...b.photos]
          .sort((a: { sortOrder?: number }, c: { sortOrder?: number }) => (a.sortOrder ?? 0) - (c.sortOrder ?? 0))
          .map((p: { url?: string }) => String(p?.url ?? ''))
          .filter(Boolean)
      : [],
    details: mergeBoatDetails(parsedDetails),
  };
}

async function createFleetApi(tmpId: string, name: string, set: (fn: any) => void) {
  try {
    const { data } = await api.post('/fleets', { name });
    set((s: { fleets: Fleet[] }) => ({
      fleets: s.fleets.map((f) => (f.id === tmpId ? mapFleetFromApi(data) : f)),
    }));
  } catch {
    set((s: { fleets: Fleet[] }) => ({ fleets: s.fleets.filter((f) => f.id !== tmpId) }));
  }
}

async function createBoatApi(
  tmpId: string,
  input: {
    brand: string;
    name: string;
    model: string;
    boatType: BoatType;
    maxPassengers: number;
    ownerId: string | null;
    fleetId: string | null;
    presentationPhotos: string[];
    details: BoatDetails;
    depositAmountCents: number;
  },
  set: (fn: any) => void,
) {
  try {
    const { data } = await api.post('/boats', {
      brand: input.brand,
      name: input.name,
      model: input.model,
      boatType: boatTypeToApi(input.boatType),
      maxPassengers: input.maxPassengers,
      ownerMemberId: input.ownerId,
      fleetId: input.fleetId,
      presentationPhotos: input.presentationPhotos,
      coverPhotoIndex: 0,
      detailsJson: JSON.stringify(input.details),
      depositAmountCents: input.depositAmountCents,
    });
    set((s: { boats: Boat[] }) => ({
      boats: s.boats.map((x) => (x.id === tmpId ? mapBoatFromApi(data) : x)),
    }));
  } catch {
    set((s: { boats: Boat[] }) => ({ boats: s.boats.filter((x) => x.id !== tmpId) }));
  }
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
