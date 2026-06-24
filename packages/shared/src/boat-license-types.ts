export const BOAT_LICENSE_TYPE_VALUES = ['cotier', 'hauturier', 'fluvial'] as const;

export type BoatLicenseType = (typeof BOAT_LICENSE_TYPE_VALUES)[number];

export const BOAT_LICENSE_TYPE_OPTIONS: ReadonlyArray<{ value: BoatLicenseType; label: string }> = [
  { value: 'cotier', label: 'Permis côtier' },
  { value: 'hauturier', label: 'Permis hauturier' },
  { value: 'fluvial', label: 'Permis fluvial' },
];

const LABEL_BY_VALUE: Record<BoatLicenseType, string> = {
  cotier: 'Permis côtier',
  hauturier: 'Permis hauturier',
  fluvial: 'Permis fluvial',
};

/** Normalise une saisie libre ou import CSV vers une valeur canonique. */
export function normalizeBoatLicenseType(raw: string | null | undefined): BoatLicenseType | null {
  const s = (raw ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (!s) return null;
  if (s === 'cotier' || s.includes('cotier') || s.includes('cote')) return 'cotier';
  if (s === 'hauturier' || s.includes('hauturier') || s.includes('hautur')) return 'hauturier';
  if (s === 'fluvial' || s.includes('fluvial') || s.includes('fluv')) return 'fluvial';
  return null;
}

export function isBoatLicenseType(value: string): value is BoatLicenseType {
  return (BOAT_LICENSE_TYPE_VALUES as readonly string[]).includes(value);
}

export function boatLicenseTypeLabel(value: string | null | undefined): string {
  const normalized = normalizeBoatLicenseType(value);
  if (normalized) return LABEL_BY_VALUE[normalized];
  const trimmed = (value ?? '').trim();
  return trimmed || '';
}
