const SENSITIVE_KEYS = /^(password|passwordHash|refreshToken|accessToken|token|apiKey|webhookSecret)$/i;
const DATA_URL = /^data:image\//i;
const MAX_STRING = 500;
const MAX_DEPTH = 8;

export function sanitizeAuditPayload(value: unknown, depth = 0): unknown {
  if (value == null || depth > MAX_DEPTH) return value;

  if (typeof value === 'string') {
    if (DATA_URL.test(value)) return '[image:data-url]';
    if (value.length > MAX_STRING) return `${value.slice(0, MAX_STRING)}…`;
    return value;
  }

  if (typeof value !== 'object') return value;

  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => sanitizeAuditPayload(v, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.test(k)) {
      out[k] = '[redacted]';
      continue;
    }
    out[k] = sanitizeAuditPayload(v, depth + 1);
  }
  return out;
}

export function toAuditJson(value: unknown): string | null {
  if (value == null) return null;
  try {
    return JSON.stringify(sanitizeAuditPayload(value));
  } catch {
    return null;
  }
}
