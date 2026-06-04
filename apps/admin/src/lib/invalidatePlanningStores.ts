import { useBoatsStore } from '@/stores/boats';
import { useReservationsStore } from '@/stores/reservations';
import { useUnavailabilitiesStore } from '@/stores/unavailabilities';

/** Vide les stores planning après déconnexion ou changement de compte (évite données admin en cache). */
export function invalidatePlanningStores() {
  useBoatsStore.setState({ fleets: [], boats: [], hydrated: false });
  useReservationsStore.setState({ items: [], hydrated: false });
  useUnavailabilitiesStore.setState({ items: [], hydrated: false });
}
