import type { ReactNode } from 'react';

/** Montant monétaire : empêche la coupure entre le nombre et « € » sur mobile. */
export function MoneyAmount(props: Readonly<{ children: string; className?: string }>) {
  return (
    <span
      className={['inline-block whitespace-nowrap tabular-nums', props.className].filter(Boolean).join(' ')}
    >
      {props.children}
    </span>
  );
}

/** Ligne libellé + montant (récap tarifaire responsive). */
export function PricingAmountRow(props: Readonly<{
  label: ReactNode;
  amount: string;
  labelClassName?: string;
  amountClassName?: string;
}>) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className={['min-w-0 flex-1', props.labelClassName].filter(Boolean).join(' ')}>
        {props.label}
      </span>
      <MoneyAmount className={['shrink-0 font-semibold', props.amountClassName].filter(Boolean).join(' ')}>
        {props.amount}
      </MoneyAmount>
    </div>
  );
}
