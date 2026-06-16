import { useCallback, useState } from 'react';
import { InteractiveSpotlightTour } from '@/components/ui/InteractiveSpotlightTour';
import { dismissGuide, isGuideDismissed } from '@/lib/dismissedGuides';
import { useAuthStore } from '@/stores/auth';
import { isOwnerUser } from '@/lib/userRoles';
import { OWNER_PORTAL_ONBOARDING_KEY, OWNER_PORTAL_TOUR_STEPS } from '@/components/owner/ownerPortalTourSteps';

export { OWNER_PORTAL_ONBOARDING_KEY } from '@/components/owner/ownerPortalTourSteps';

type Props = Readonly<{
  ready?: boolean;
}>;

export function OwnerPortalOnboarding({ ready = true }: Props) {
  const role = useAuthStore((s) => s.user.role);
  const isOwner = isOwnerUser(role);
  const [active, setActive] = useState(
    () => isOwner && !isGuideDismissed(OWNER_PORTAL_ONBOARDING_KEY),
  );
  const [stepIndex, setStepIndex] = useState(0);

  const finish = useCallback(() => {
    dismissGuide(OWNER_PORTAL_ONBOARDING_KEY);
    setActive(false);
  }, []);

  if (!isOwner || !active || !ready) return null;

  return (
    <InteractiveSpotlightTour
      steps={OWNER_PORTAL_TOUR_STEPS}
      stepIndex={stepIndex}
      onStepIndexChange={setStepIndex}
      onFinish={finish}
      active={active}
    />
  );
}
