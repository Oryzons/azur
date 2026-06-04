import type { MemberClient } from '@/stores/members';

function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '');
}

function clientHaystack(c: MemberClient) {
  return normalizeSearchText(`${c.firstName} ${c.lastName} ${c.email} ${c.phone ?? ''}`);
}

function matchScore(c: MemberClient, query: string, tokens: string[]) {
  const hay = clientHaystack(c);
  const email = normalizeSearchText(c.email);
  const fullName = normalizeSearchText(`${c.firstName} ${c.lastName}`);
  let score = 0;
  if (fullName.startsWith(query) || email.startsWith(query)) score += 100;
  for (const t of tokens) {
    if (fullName.startsWith(t)) score += 40;
    if (email.startsWith(t)) score += 30;
    if (hay.includes(t)) score += 10;
  }
  return score;
}

/** Recherche clients existants (dès 1 caractère, filtrage dynamique). */
export function searchMemberClients(clients: MemberClient[], query: string, limit = 10): MemberClient[] {
  const q = normalizeSearchText(query);
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  return clients
    .filter((c) => {
      const hay = clientHaystack(c);
      return tokens.every((t) => hay.includes(t));
    })
    .map((c) => ({ c, score: matchScore(c, q, tokens) }))
    .sort((a, b) => b.score - a.score || a.c.lastName.localeCompare(b.c.lastName, 'fr'))
    .slice(0, limit)
    .map((x) => x.c);
}
