import type { ReservationWizardDetails } from '@/pages/calendar/reservationWizardTypes';
import type { RentalContractStatus, PaymentMethod, InstallmentStatus } from '@bleu-calanque/shared';

/** Échéance de paiement renvoyée par l'API (source de vérité des statuts/montants). */
export type ReservationInstallmentView = {
  sequence: number;
  label: string | null;
  amountCents: number;
  method: PaymentMethod;
  status: InstallmentStatus;
  paidAt: string | null;
  paymentLinkUrl: string | null;
  stripeFeeCents?: number | null;
  stripeNetCents?: number | null;
};

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
  depositPercent?: number | null;
  /** Plan d'échéances (paiement en 2 fois) renvoyé par l'API. */
  installmentPlan?: ReservationInstallmentView[];
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
  /** Frais Stripe (paiement unique sans échéances). */
  stripeFeeCents?: number | null;
  stripeNetCents?: number | null;
};
