/** Statuts affichés côté admin pour le contrat de location. */
export type RentalContractStatusId =
  | 'signed'
  | 'sign_email_sent'
  | 'paid_unsigned'
  | 'awaiting_signature';

export type RentalContractStatusTone = 'success' | 'warning' | 'default' | 'muted';

export type RentalContractStatus = {
  id: RentalContractStatusId;
  label: string;
  tone: RentalContractStatusTone;
};

export type RentalContractStatusInput = {
  signedAt?: string | Date | null;
  contractSignEmailSentAt?: string | Date | null;
  paymentCapturedAt?: string | Date | null;
  /** Statut admin (`reserved_paid`, …) ou API Prisma. */
  adminStatus?: string | null;
  apiStatus?: string | null;
};

function isPaidReservation(ctx: Pick<RentalContractStatusInput, 'paymentCapturedAt' | 'adminStatus' | 'apiStatus'>): boolean {
  if (ctx.paymentCapturedAt) return true;
  const s = ctx.adminStatus ?? ctx.apiStatus;
  if (!s) return false;
  return ['reserved_paid', 'RESERVED_PAID', 'refunded', 'REFUNDED', 'partially_refunded', 'PARTIALLY_REFUNDED'].includes(s);
}

function hasSignedAt(signedAt?: string | Date | null): boolean {
  if (!signedAt) return false;
  if (signedAt instanceof Date) return !Number.isNaN(signedAt.getTime());
  return Boolean(String(signedAt).trim());
}

function hasSignEmailSent(at?: string | Date | null): boolean {
  if (!at) return false;
  if (at instanceof Date) return !Number.isNaN(at.getTime());
  return Boolean(String(at).trim());
}

/** Dérive le libellé et la couleur du badge contrat pour l’admin. */
export function resolveRentalContractStatus(input: RentalContractStatusInput): RentalContractStatus {
  if (hasSignedAt(input.signedAt)) {
    return { id: 'signed', label: 'Contrat signé', tone: 'success' };
  }
  if (hasSignEmailSent(input.contractSignEmailSentAt)) {
    return { id: 'sign_email_sent', label: 'Signature envoyée', tone: 'warning' };
  }
  if (isPaidReservation(input)) {
    return {
      id: 'paid_unsigned',
      label: 'Paiement OK — contrat non signé',
      tone: 'warning',
    };
  }
  return { id: 'awaiting_signature', label: 'En attente de signature', tone: 'default' };
}
