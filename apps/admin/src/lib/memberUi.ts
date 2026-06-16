import type { ClientType, Member, MemberRole } from '@/stores/members';

export const ROLE_LABELS: Record<MemberRole, string> = {
  admin: 'Admin',
  agent: 'Agent',
  proprietaire: 'Propriétaire',
  client: 'Client',
  daf: 'DAF',
};

export const ROLE_STYLES: Record<
  MemberRole,
  { dot: string; badge: { bg: string; text: string; border: string } }
> = {
  admin: { dot: 'bg-red-500', badge: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' } },
  client: { dot: 'bg-blue-500', badge: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' } },
  proprietaire: { dot: 'bg-violet-500', badge: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' } },
  agent: { dot: 'bg-orange-500', badge: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' } },
  daf: { dot: 'bg-emerald-500', badge: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' } },
};

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  particulier: 'Particulier',
  professionnel: 'Professionnel',
  association: 'Association',
};

export function labelForRole(role: MemberRole) {
  return ROLE_LABELS[role] ?? role;
}

export function memberInitials(firstName: string, lastName: string) {
  const f = firstName.trim();
  const l = lastName.trim();
  if (!f && !l) return '?';
  if (f && l) return `${f[0] ?? ''}${l[0] ?? ''}`.toUpperCase();
  return (f || l).slice(0, 2).toUpperCase();
}

export function memberSearchHaystack(m: Pick<Member, 'email' | 'firstName' | 'lastName' | 'role' | 'phone'>) {
  return [m.firstName, m.lastName, m.email, m.phone ?? '', labelForRole(m.role)].join(' ').toLowerCase();
}

export function formatBirthDateInput(value: string) {
  const digits = value.replaceAll(/\D/g, '').slice(0, 8);
  const d = digits.slice(0, 2);
  const m = digits.slice(2, 4);
  const y = digits.slice(4, 8);
  if (digits.length <= 2) return d;
  if (digits.length <= 4) return `${d}/${m}`;
  return `${d}/${m}/${y}`;
}

export function birthDateToIso(v: string) {
  const s = v.trim();
  if (!s) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!match) return null;
  const dd = Number(match[1]);
  const mm = Number(match[2]);
  const yyyy = Number(match[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  if (yyyy < 1900 || yyyy > 2100) return null;
  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;
  return `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function birthDateFromIso(v?: string | null) {
  if (!v) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(file);
  });
}

export function extractApiErrorMessage(e: unknown, fallback = 'Erreur API inconnue.'): string {
  const err = e as { response?: { data?: { message?: unknown; error?: string } }; message?: string };
  const data = err?.response?.data;
  const msg = data?.message;
  if (Array.isArray(msg)) return msg.join(' ');
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  if (typeof err?.message === 'string' && err.message.trim()) return err.message;
  return fallback;
}

export function inputCls() {
  return 'mt-1.5 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15';
}
