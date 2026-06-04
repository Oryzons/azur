import { useEffect } from 'react';
import { useBoatsStore } from '@/stores/boats';
import { useReservationsStore } from '@/stores/reservations';

/** Hydrate minimale pour la tablette agent (pas de settings, membres, IBAN, etc.). */
export function TabletStoresHydrator() {
  useEffect(() => {
    if (!useBoatsStore.getState().hydrated) void useBoatsStore.getState().refresh();
    if (!useReservationsStore.getState().hydrated) void useReservationsStore.getState().refresh();
  }, []);
  return null;
}
