import type { ReactNode } from 'react';

type Props = Readonly<{
  ready: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  className?: string;
}>;

/** Affiche un skeleton puis le contenu avec une entrée en fondu. */
export function ContentReveal({ ready, skeleton, children, className = '' }: Props) {
  if (!ready) {
    return <div className={['bc-stagger', className].filter(Boolean).join(' ')}>{skeleton}</div>;
  }
  return (
    <div className={['bc-content-enter bc-stagger', className].filter(Boolean).join(' ')}>{children}</div>
  );
}
