import type { CfStepDirection } from '@/lib/tabletCheckFlowTheme';

export function TabletCheckFlowStepTransition(props: Readonly<{
  stepKey: string;
  direction: CfStepDirection;
  children: React.ReactNode;
}>) {
  const { stepKey, direction, children } = props;
  return (
    <div
      key={stepKey}
      className={direction === 'forward' ? 'bc-cf-step-forward' : 'bc-cf-step-back'}
    >
      {children}
    </div>
  );
}
