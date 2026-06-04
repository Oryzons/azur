import type { ClientType, Civility } from '@/stores/members';
import type { CouponDiscountKind } from '@/stores/coupons';
import type { ReservationStatus } from '@/lib/reservationStatus';

/** Calcul tarif étape 4 (remise manuelle + coupon catalogue + règle saison). */
export type WizardPricingRecap = {
  hasPrice: boolean;
  /** Prix de la location (sans extras) */
  priceNum: number;
  /** Total des extras sélectionnés (avant remises) */
  extrasTotal: number;
  /** Total location + extras (avant remises) */
  subtotal: number;
  /** Location après remise manuelle + coupon (si applicable) */
  locationNet: number | null;
  /** Extras après remise manuelle + coupon (si applicable) */
  extrasNet: number | null;
  manualDiscPct: number;
  /** Montant après remise % manuelle seule ; `null` si pas de prix. */
  afterManual: number | null;
  couponLine:
    | null
    | {
        code: string;
        applies: boolean;
        kind: CouponDiscountKind;
        effectiveValue: number;
        tier: 'full' | 'degraded';
        inactiveReason?: string;
      };
  finalPrice: number | null;
  priceLabelFinal: string;
  /** Solde avoir client encore disponible (centimes). */
  storeCreditAvailableCents: number;
  /** Avoir imputé sur ce tarif (centimes). */
  storeCreditAppliedCents: number;
};

export type ReservationWizardDetails = {
  passengerCount: number;
  hasChildren: boolean;
  childrenCount: number;
  internalNote: string;
  clientType: ClientType;
  civility: Civility;
  clientEmail: string;
  clientFirstName: string;
  clientLastName: string;
  clientPhone: string;
  clientBirthDateDisplay: string;
  clientAddress: string;
  clientPostalCode: string;
  clientCity: string;
  clientCountry: string;
  /** Contrat PDF — pièce d'identité */
  clientIdType: string;
  clientIdNumber: string;
  /** Contrat PDF — permis bateau (chef de bord) */
  licenseType: string;
  licenseNumber: string;
  licenseCountry: string;
  licenseYear: string;
  /** Validation admin des justificatifs (clé = libellé du modèle contrat). */
  contractDocumentValidations?: Record<string, { validatedAt: string }>;
  paymentChannel: 'online' | 'offline';
  linkedMemberId: string | null;
  rentalPrice: string;
  depositAmount: string;
  discountPercent: string;
  couponCode: string;
  airbusBadge: string;
  extras: Record<string, boolean>;
  installments: 1 | 2;
  settlementNote: string;
  /** Statuts opérationnels (admin) */
  paymentCapturedAt?: string | null;
  depositCapturedAt?: string | null;
  confirmationEmailSentAt?: string | null;
  refunds?: { id: string; amount: number; at: string; note?: string }[];
  cancelledAt?: string | null;
  status?: ReservationStatus;
};

export type ReservationWizardSubmitPayload = {
  boatId: string;
  dateIso: string;
  startTime: string;
  endTime: string;
  bookerName: string;
  details: ReservationWizardDetails;
  /** Total TTC (location + extras après remises), en centimes. */
  totalDueCents: number | null;
};

export type BoatOption = { id: string; name: string };

/** Nom affiché sur le calendrier (prénom + nom client). */
export function clientDisplayNameFromDetails(details: Pick<ReservationWizardDetails, 'clientFirstName' | 'clientLastName' | 'civility'>) {
  const civ = details.civility ? `${details.civility} ` : '';
  return `${civ}${details.clientFirstName} ${details.clientLastName}`.trim();
}

export function emptyWizardDetails(): ReservationWizardDetails {
  return {
    passengerCount: 2,
    hasChildren: false,
    childrenCount: 0,
    internalNote: '',
    clientType: 'particulier',
    civility: '',
    clientEmail: '',
    clientFirstName: '',
    clientLastName: '',
    clientPhone: '',
    clientBirthDateDisplay: '',
    clientAddress: '',
    clientPostalCode: '',
    clientCity: '',
    clientCountry: 'France',
    clientIdType: "Carte d'identité",
    clientIdNumber: '',
    licenseType: '',
    licenseNumber: '',
    licenseCountry: 'France',
    licenseYear: '',
    contractDocumentValidations: {},
    paymentChannel: 'online',
    linkedMemberId: null,
    rentalPrice: '',
    depositAmount: '',
    discountPercent: '',
    couponCode: '',
    airbusBadge: '',
    extras: {},
    installments: 1,
    settlementNote: '',
    paymentCapturedAt: null,
    depositCapturedAt: null,
    confirmationEmailSentAt: null,
    refunds: [],
    cancelledAt: null,
    status: 'pending_payment',
  };
}
