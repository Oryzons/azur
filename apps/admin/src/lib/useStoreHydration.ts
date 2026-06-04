import { useBoatsStore } from '@/stores/boats';
import { useReservationsStore } from '@/stores/reservations';
import { useMembersStore } from '@/stores/members';
import { useExtrasStore } from '@/stores/extras';
import { useCouponsStore } from '@/stores/coupons';
import { useSettingsStore } from '@/stores/settings';
import { useAnnouncementsStore } from '@/stores/announcements';
import { useBoatPricingStore } from '@/stores/boatPricing';

/** Données planning / dashboard (bateaux + réservations). */
export function useCoreStoresReady(): boolean {
  const boats = useBoatsStore((s) => s.hydrated);
  const reservations = useReservationsStore((s) => s.hydrated);
  return boats && reservations;
}

/** Tous les stores chargés par StoresHydrator. */
export function useAppStoresReady(): boolean {
  const boats = useBoatsStore((s) => s.hydrated);
  const reservations = useReservationsStore((s) => s.hydrated);
  const members = useMembersStore((s) => s.hydrated);
  const extras = useExtrasStore((s) => s.hydrated);
  const coupons = useCouponsStore((s) => s.hydrated);
  const settings = useSettingsStore((s) => s.hydrated);
  const announcements = useAnnouncementsStore((s) => s.hydrated);
  const pricing = useBoatPricingStore((s) => s.hydrated);
  return boats && reservations && members && extras && coupons && settings && announcements && pricing;
}
