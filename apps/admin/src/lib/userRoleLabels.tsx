/** Rôles utilisateur (alignés sur l’API). Évite l’import runtime de l’enum CJS du package shared sous Vite. */
type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'AGENT' | 'OWNER';

const LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Staff',
  AGENT: 'Agent',
  OWNER: 'Propriétaire',
};

const STYLES: Record<UserRole, { bg: string; text: string; border: string; dot: string }> = {
  ADMIN: {
    bg: 'bg-violet-50',
    text: 'text-violet-800',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
  },
  MANAGER: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  STAFF: {
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
  },
  AGENT: {
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  OWNER: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
};

const DEFAULT_STYLE = STYLES.STAFF;

export function labelForUserRole(role: UserRole | string): string {
  return LABELS[role as UserRole] ?? role;
}

export function UserRoleBadge(props: Readonly<{ role: UserRole | string }>) {
  const s = STYLES[props.role as UserRole] ?? DEFAULT_STYLE;
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        s.bg,
        s.text,
        s.border,
      ].join(' ')}
    >
      <span className={['h-1.5 w-1.5 rounded-full', s.dot].join(' ')} aria-hidden />
      {labelForUserRole(props.role)}
    </span>
  );
}

export function formatLastSeen(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return "À l'instant";
  const min = Math.floor(diffMs / 60_000);
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  return `Il y a ${h} h`;
}
