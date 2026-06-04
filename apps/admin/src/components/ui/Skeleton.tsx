import type { CSSProperties, ReactNode } from 'react';

type SkeletonProps = Readonly<{
  className?: string;
  style?: CSSProperties;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  children?: ReactNode;
}>;

const roundedCls: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
};

/** Bloc animé type skeleton (shimmer). */
export function Skeleton({ className = '', style, rounded = 'lg', children }: SkeletonProps) {
  return (
    <div
      className={['bc-skeleton', roundedCls[rounded], className].filter(Boolean).join(' ')}
      style={style}
      aria-hidden
    >
      {children}
    </div>
  );
}
