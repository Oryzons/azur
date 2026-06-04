type Props = Readonly<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  hint?: string;
  disabled?: boolean;
  className?: string;
}>;

export function RoundCheckbox({ checked, onChange, label, hint, disabled, className = '' }: Props) {
  const control = (
    <span className="inline-flex relative shrink-0 justify-center items-center w-5 h-5">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <span
        className={[
          'h-5 w-5 rounded-full border bg-white shadow-sm transition-colors',
          'border-zinc-300 peer-checked:border-[#416B9F] peer-checked:bg-[#416B9F]',
          'peer-disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-[#416B9F]/25',
        ].join(' ')}
      />
      <span className="pointer-events-none absolute text-[11px] font-black leading-none text-white opacity-0 transition-opacity peer-checked:opacity-100">
        ✓
      </span>
    </span>
  );

  if (!label && !hint) {
    return <span className={className}>{control}</span>;
  }

  return (
    <label
      className={[
        'flex cursor-pointer items-start gap-3',
        disabled ? 'cursor-not-allowed opacity-60' : '',
        className,
      ].join(' ')}
    >
      <span className="mt-0.5">{control}</span>
      <span className="min-w-0">
        {label ? <span className="block text-sm font-semibold text-zinc-900">{label}</span> : null}
        {hint ? <span className="mt-0.5 block text-xs text-zinc-500">{hint}</span> : null}
      </span>
    </label>
  );
}
