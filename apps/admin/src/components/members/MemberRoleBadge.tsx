import { ROLE_LABELS, ROLE_STYLES, labelForRole } from '@/lib/memberUi';
import type { MemberRole } from '@/stores/members';

export function MemberRoleBadge({ role }: Readonly<{ role: MemberRole }>) {
  const s = ROLE_STYLES[role];
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        s.badge.bg,
        s.badge.text,
        s.badge.border,
      ].join(' ')}
    >
      <span className={['h-1.5 w-1.5 rounded-full', s.dot].join(' ')} aria-hidden />
      {ROLE_LABELS[role]}
    </span>
  );
}

export function MemberAvatar({
  firstName,
  lastName,
}: Readonly<{ firstName: string; lastName: string }>) {
  const initials =
    `${firstName.trim()[0] ?? ''}${lastName.trim()[0] ?? ''}`.toUpperCase() || '?';
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#416B9F]/12 text-sm font-bold text-[#416B9F]">
      {initials}
    </span>
  );
}

export { labelForRole };
