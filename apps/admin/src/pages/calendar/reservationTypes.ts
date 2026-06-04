import type { ReservationWizardDetails } from '@/pages/calendar/reservationWizardTypes';
import type { RentalContractStatus } from '@bleu-calanque/shared';

/** Réservation calendrier (dates en runtime, pas sérialisées telles quelles). */
export type Reservation = {
  id: string;
  boatId: string;
  title: string;
  start: Date;
  end: Date;
  color?: string;
  details?: ReservationWizardDetails;
  totalDueCents?: number | null;
  stripeDepositPaymentIntentId?: string | null;
  /** Soumission tablette check-in enregistrée. */
  checkInDone?: boolean;
  /** Soumission tablette check-out enregistrée. */
  checkOutDone?: boolean;
  /** Contrat de location signé par le client. */
  rentalContractSigned?: boolean;
  rentalContractLocked?: boolean;
  /** Données réservation divergent du snapshot signé (contrats anciens : faux). */
  rentalContractDataStale?: boolean;
  rentalContractStatus?: RentalContractStatus;
};
