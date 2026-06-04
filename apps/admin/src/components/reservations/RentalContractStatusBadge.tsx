import type { RentalContractStatus, RentalContractStatusTone } from '@bleu-calanque/shared';

const toneClass: Record<RentalContractStatusTone, string> = {
  success: 'bg-emerald-100 text-emerald-900 ring-emerald-200/80',
  warning: 'bg-amber-100 text-amber-950 ring-amber-200/80',
  default: 'bg-sky-100 text-sky-950 ring-sky-200/80',
  muted: 'bg-zinc-100 text-zinc-700 ring-zinc-200/80',
};

export function RentalContractStatusBadge(props: Readonly<{ status: RentalContractStatus; className?: string }>) {
  const { status, className = '' } = props;
  return (
    <span
      className={[
        'inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        toneClass[status.tone],
        className,
      ].join(' ')}
    >
      {status.label}
    </span>
  );
}
