import { useCallback, useState } from 'react';
import { InteractiveSpotlightTour } from '@/components/ui/InteractiveSpotlightTour';
import { dismissGuide, isGuideDismissed } from '@/lib/dismissedGuides';
import { isDeskUser } from '@/lib/userRoles';
import { useAuthStore } from '@/stores/auth';
import { ADMIN_ONBOARDING_KEY, ADMIN_TOUR_STEPS } from '@/components/admin/adminTourSteps';

export { ADMIN_ONBOARDING_KEY } from '@/components/admin/adminTourSteps';

type Props = Readonly<{
  ready?: boolean;
}>;

export function AdminOnboarding({ ready = true }: Props) {
  const role = useAuthStore((s) => s.user.role);
  const mustChangePassword = useAuthStore((s) => s.user.mustChangePassword);
  const isDesk = isDeskUser(role);
  const [active, setActive] = useState(() => isDesk && !isGuideDismissed(ADMIN_ONBOARDING_KEY));
  const [stepIndex, setStepIndex] = useState(0);

  const finish = useCallback(() => {
    dismissGuide(ADMIN_ONBOARDING_KEY);
    setActive(false);
  }, []);

  if (!isDesk || !active || !ready || mustChangePassword) return null;

  return (
    <InteractiveSpotlightTour
      steps={ADMIN_TOUR_STEPS}
      stepIndex={stepIndex}
      onStepIndexChange={setStepIndex}
      onFinish={finish}
      active={active}
    />
  );
}
