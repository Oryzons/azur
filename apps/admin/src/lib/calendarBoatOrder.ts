const STORAGE_KEY = 'bleu-calanque:calendar-boat-order';

export function loadCalendarBoatOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p) || !p.every((x) => typeof x === 'string')) return null;
    return p as string[];
  } catch {
    return null;
  }
}

export function saveCalendarBoatOrder(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Construit un ordre complet : préférence puis bateaux du catalogue absents de la préférence (tri id). */
export function normalizeBoatOrder(preferred: string[] | null, catalogIds: string[]): string[] {
  const cat = [...new Set(catalogIds)];
  const seen = new Set<string>();
  const out: string[] = [];
  const pref = preferred ?? [];
  for (const id of pref) {
    if (cat.includes(id) && !seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  const rest = cat.filter((id) => !seen.has(id));
  rest.sort((a, b) => a.localeCompare(b, 'fr'));
  return [...out, ...rest];
}

/**
 * Réordonne uniquement les ids présents dans `subsetNewOrder` (même ensemble que le sous-ensemble
 * concerné dans `globalOrder`), en conservant la position des autres ids.
 */
export function applySubsetReorder(globalOrder: string[], subsetNewOrder: string[]): string[] {
  const subset = new Set(subsetNewOrder);
  if (subset.size !== subsetNewOrder.length) return globalOrder;
  let k = 0;
  return globalOrder.map((id) => (subset.has(id) ? (subsetNewOrder[k++] as string) : id));
}

export function moveIndexInArray<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return [...arr];
  const n = [...arr];
  const [x] = n.splice(from, 1);
  n.splice(to, 0, x);
  return n;
}

export function sortBoatsByGlobalOrder<T extends { id: string }>(boats: T[], globalOrder: string[]): T[] {
  const idx = new Map(globalOrder.map((id, i) => [id, i]));
  return [...boats].sort((a, b) => {
    const ia = idx.has(a.id) ? (idx.get(a.id) as number) : 1e9;
    const ib = idx.has(b.id) ? (idx.get(b.id) as number) : 1e9;
    if (ia !== ib) return ia - ib;
    return a.id.localeCompare(b.id, 'fr');
  });
}

export type FleetRef = { id: string };

/**
 * Bateaux d’une flotille en tête (ordre des flotilles = ordre du catalogue `fleets`),
 * puis bateaux sans flotille ; à l’intérieur de chaque groupe, ordre issu de `globalOrder`.
 */
export function sortBoatsByFleetThenGlobalOrder<T extends { id: string; fleetId?: string | null }>(
  boats: T[],
  fleets: readonly FleetRef[],
  globalOrder: string[],
): T[] {
  const fleetPos = new Map(fleets.map((f, i) => [f.id, i]));
  const orderIdx = new Map(globalOrder.map((id, i) => [id, i]));

  return [...boats].sort((a, b) => {
    const fa = a.fleetId ?? null;
    const fb = b.fleetId ?? null;
    const hasA = Boolean(fa);
    const hasB = Boolean(fb);
    if (hasA !== hasB) return hasA ? -1 : 1;

    if (hasA && hasB) {
      const pa = fleetPos.has(fa!) ? (fleetPos.get(fa!) as number) : fleets.length;
      const pb = fleetPos.has(fb!) ? (fleetPos.get(fb!) as number) : fleets.length;
      if (pa !== pb) return pa - pb;
    }

    const ia = orderIdx.has(a.id) ? (orderIdx.get(a.id) as number) : 1e9;
    const ib = orderIdx.has(b.id) ? (orderIdx.get(b.id) as number) : 1e9;
    if (ia !== ib) return ia - ib;
    return a.id.localeCompare(b.id, 'fr');
  });
}
