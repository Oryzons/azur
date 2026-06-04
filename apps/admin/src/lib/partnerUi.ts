import type { Partner, PartnerLinkedOffering } from '@/stores/settings';

export const PARTNER_OFFERING_ORDER: PartnerLinkedOffering[] = ['boat_license', 'fluvial', 'boat_rental'];

export const PARTNER_OFFERINGS: { id: PartnerLinkedOffering; label: string; hint: string }[] = [
  { id: 'boat_license', label: 'Permis bateau', hint: 'Formation ou examen mer' },
  { id: 'fluvial', label: 'Permis fluvial', hint: 'Formation ou examen fluvial' },
  { id: 'boat_rental', label: 'Location', hint: 'Offres liées à la location' },
];

export const PARTNER_KINDS: { id: Partner['kind']; label: string }[] = [
  { id: 'nautic_base', label: 'Base nautique' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'insurance', label: 'Assurance' },
  { id: 'other', label: 'Autre' },
];

export function partnerOfferingLabel(o: PartnerLinkedOffering): string {
  return PARTNER_OFFERINGS.find((x) => x.id === o)?.label ?? o;
}

export function partnerOfferingsSummary(ids: PartnerLinkedOffering[]): string {
  return PARTNER_OFFERING_ORDER.filter((o) => ids.includes(o))
    .map((o) => partnerOfferingLabel(o))
    .join(' · ');
}

export function partnerKindLabel(kind: Partner['kind']): string {
  return PARTNER_KINDS.find((k) => k.id === kind)?.label ?? 'Autre';
}

export function partnerInitials(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return t.slice(0, 2).toUpperCase();
}

export async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(new Error('file_read_failed'));
    r.readAsDataURL(file);
  });
}
