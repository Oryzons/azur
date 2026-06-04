import { useEffect } from 'react';
import { useAnnouncementsStore } from '@/stores/announcements';
import { useBoatPricingStore } from '@/stores/boatPricing';
import { useBoatsStore } from '@/stores/boats';
import { useCouponsStore } from '@/stores/coupons';
import { useExtrasStore } from '@/stores/extras';
import { useMembersStore } from '@/stores/members';
import { useReservationsStore } from '@/stores/reservations';
import { useSettingsStore } from '@/stores/settings';
import { useUnavailabilitiesStore } from '@/stores/unavailabilities';
import { useAuthStore } from '@/stores/auth';
import { isOwnerUser } from '@/lib/userRoles';

/**
 * Hydrate les stores depuis l'API à chaque session connectée.
 * Recharge bateaux / réservations / indispos à chaque connexion (évite cache admin → propriétaire).
 */
export function StoresHydrator() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user.id);
  const role = useAuthStore((s) => s.user.role);
  const isOwner = isOwnerUser(role);

  useEffect(() => {
    if (!accessToken || !userId) return;

    void useBoatsStore.getState().refresh();
    void useReservationsStore.getState().refresh();
    void useUnavailabilitiesStore.getState().refresh();

    if (!isOwner) {
      if (!useExtrasStore.getState().hydrated) void useExtrasStore.getState().refresh();
      if (!useMembersStore.getState().hydrated) void useMembersStore.getState().refresh();
      if (!useCouponsStore.getState().hydrated) void useCouponsStore.getState().refresh();
      if (!useAnnouncementsStore.getState().hydrated) void useAnnouncementsStore.getState().refresh();
      if (!useBoatPricingStore.getState().hydrated) void useBoatPricingStore.getState().refresh();
      if (!useSettingsStore.getState().hydrated) void useSettingsStore.getState().refresh();
    }
  }, [accessToken, userId, isOwner]);

  return null;
}
