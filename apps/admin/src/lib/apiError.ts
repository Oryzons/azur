import type { AxiosError } from 'axios';

const STRIPE_MESSAGE_FR: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [
    /Refund amount \(([^)]+)\) is greater than charge amount \(([^)]+)\)/i,
    (m) => `Le montant du remboursement (${m[1]}) dépasse le montant payé (${m[2]}).`,
  ],
  [/greater than charge amount/i, 'Le montant du remboursement dépasse le montant payé.'],
  [/charge already refunded/i, 'Ce paiement a déjà été intégralement remboursé.'],
  [/already been refunded/i, 'Ce paiement a déjà été remboursé.'],
];

function translateKnownStripeMessage(msg: string): string {
  const trimmed = msg.trim();
  for (const [pattern, replacement] of STRIPE_MESSAGE_FR) {
    const m = pattern.exec(trimmed);
    if (m) return typeof replacement === 'function' ? replacement(m) : replacement;
  }
  return trimmed;
}

/** Extrait un message lisible depuis une erreur API (axios / validation Nest). */
export function extractApiErrorMessage(err: unknown, fallback = 'Erreur inconnue.'): string {
  if (!err || typeof err !== 'object') return fallback;

  const ax = err as AxiosError<{ message?: string | string[] | { message?: string }; errors?: { message: string }[] }>;
  const data = ax.response?.data;
  if (!data) return fallback;

  const msg = data.message;
  if (typeof msg === 'string' && msg.trim()) return translateKnownStripeMessage(msg);
  if (Array.isArray(msg)) {
    const joined = msg.filter((s) => typeof s === 'string' && s.trim()).join(' ');
    if (joined) return joined;
  }
  if (msg && typeof msg === 'object' && !Array.isArray(msg)) {
    const constraintMsg = Object.values(msg as Record<string, string>).find(
      (v) => typeof v === 'string' && v.trim(),
    );
    if (constraintMsg) return constraintMsg;
  }
  if (msg && typeof msg === 'object' && 'message' in msg) {
    const inner = (msg as { message?: string }).message;
    if (typeof inner === 'string' && inner.trim()) return inner;
  }
  if (Array.isArray(data.errors) && data.errors.length) {
    return data.errors.map((e) => e.message).filter(Boolean).join(' ');
  }

  return fallback;
}
