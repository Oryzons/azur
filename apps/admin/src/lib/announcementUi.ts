import type { Announcement, AnnouncementLink } from '@/stores/announcements';
import { BOAT_TYPES_UI, type Boat, type Fleet } from '@/stores/boats';
import { coverPhotoUrl } from '@/lib/mediaPhotos';

export function boatDisplayLabel(b: Boat) {
  return `${b.brand} ${b.name}`.trim();
}

export function newBoatDisplayLabel(link: Extract<AnnouncementLink, { kind: 'new_boat' }>) {
  return `${link.brand} ${link.name}`.trim();
}

export function announcementTargetSummary(a: Announcement, fleets: Fleet[], boats: Boat[]) {
  const { link } = a;
  if (link.kind === 'existing_fleet') {
    const n = fleets.find((f) => f.id === link.fleetId)?.name ?? link.fleetId;
    return { line: `Flotille · ${n}`, sub: null as string | null };
  }
  if (link.kind === 'existing_boat') {
    const b = boats.find((x) => x.id === link.boatId);
    const fn = b?.fleetId ? (fleets.find((f) => f.id === b.fleetId)?.name ?? '—') : 'Sans flotille';
    if (!b) return { line: `Bateau · (${link.boatId})`, sub: fn };
    return {
      line: `Bateau · ${boatDisplayLabel(b)}`,
      sub: `${b.model} · ${BOAT_TYPES_UI.find((t) => t.value === b.boatType)?.label ?? b.boatType} · jusqu’à ${b.maxPassengers} pers.`,
    };
  }
  if (link.kind === 'new_fleet') {
    return { line: `Nouvelle flotille · ${link.fleetName}`, sub: null };
  }
  const fl = link.fleetId ? (fleets.find((f) => f.id === link.fleetId)?.name ?? '—') : 'Sans flotille';
  return {
    line: `Nouveau bateau · ${newBoatDisplayLabel(link)}`,
    sub: `${link.model} · ${BOAT_TYPES_UI.find((t) => t.value === link.boatType)?.label ?? link.boatType} · ${link.maxPassengers} pers. · ${fl}`,
  };
}

export function announcementCoverSrc(a: Announcement, boats: Boat[]): string | null {
  const own = coverPhotoUrl(a.presentationPhotos ?? []);
  if (own) return own;
  if (a.link.kind === 'existing_boat') {
    const boatId = a.link.boatId;
    const b = boats.find((x) => x.id === boatId);
    return coverPhotoUrl(b?.presentationPhotos ?? []);
  }
  return null;
}

/** Clé de filtre flotille : id flotille, `none`, ou `nf:nom` pour nouvelle flotille texte. */
export function announcementFleetFilterKey(a: Announcement, boats: Boat[]): string {
  const { link } = a;
  if (link.kind === 'existing_fleet') return link.fleetId;
  if (link.kind === 'new_fleet') return `nf:${link.fleetName.trim().toLowerCase()}`;
  if (link.kind === 'existing_boat') {
    const b = boats.find((x) => x.id === link.boatId);
    return b?.fleetId ?? 'none';
  }
  return link.fleetId ?? 'none';
}

export function announcementSearchHaystack(a: Announcement, fleets: Fleet[], boats: Boat[]): string {
  const sum = announcementTargetSummary(a, fleets, boats);
  return `${a.title} ${a.navalBase} ${sum.line} ${sum.sub ?? ''}`.toLowerCase();
}

export function matchesAnnouncementFleetFilter(
  a: Announcement,
  filterKey: string,
  boats: Boat[],
): boolean {
  if (!filterKey || filterKey === 'all') return true;
  return announcementFleetFilterKey(a, boats) === filterKey;
}

export function linkModeLabel(kind: AnnouncementLink['kind']): string {
  switch (kind) {
    case 'existing_fleet':
      return 'Flotille existante';
    case 'existing_boat':
      return 'Bateau existant';
    case 'new_fleet':
      return 'Nouvelle flotille';
    case 'new_boat':
      return 'Nouveau bateau (indicatif)';
  }
}
