/** Lieu par défaut pour la majorité des locations (Port Ouest — L'Estaque). */
export const DEFAULT_RENTAL_DEPARTURE_LOCATION = 'Port Ouest Marseille — L\'Estaque';
export const DEFAULT_RENTAL_ARRIVAL_LOCATION = 'Port Ouest Marseille — L\'Estaque';

export type RentalLocationSources = {
  company?: { departureLocation?: string | null; arrivalLocation?: string | null } | null;
  booking?: {
    departureLocation?: string | null;
    arrivalLocation?: string | null;
    defaultNavalBase?: string | null;
  } | null;
  publicSite?: { departureLocation?: string | null; arrivalLocation?: string | null } | null;
  reservation?: { departureLocation?: string | null; arrivalLocation?: string | null } | null;
};

function pick(...values: (string | null | undefined)[]): string {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return '';
}

export function resolveRentalDepartureLocation(sources: RentalLocationSources): string {
  return (
    pick(
      sources.reservation?.departureLocation,
      sources.company?.departureLocation,
      sources.booking?.departureLocation,
      sources.booking?.defaultNavalBase,
      sources.publicSite?.departureLocation,
    ) || DEFAULT_RENTAL_DEPARTURE_LOCATION
  );
}

export function resolveRentalArrivalLocation(sources: RentalLocationSources): string {
  return (
    pick(
      sources.reservation?.arrivalLocation,
      sources.company?.arrivalLocation,
      sources.booking?.arrivalLocation,
      sources.booking?.defaultNavalBase,
      sources.publicSite?.arrivalLocation,
    ) || DEFAULT_RENTAL_ARRIVAL_LOCATION
  );
}

export function resolveRentalLocations(sources: RentalLocationSources): {
  departure: string;
  arrival: string;
} {
  return {
    departure: resolveRentalDepartureLocation(sources),
    arrival: resolveRentalArrivalLocation(sources),
  };
}
