/**
 * Modes de règlement, échéances (paiement en 1 ou 2 fois) et icônes d'extras.
 * Source de vérité partagée entre l'API et l'admin.
 */

const PAYMENT_METHOD_VALUES_INTERNAL = ['ONLINE', 'CASH', 'CARD_ONSITE', 'CHECK', 'TRANSFER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHOD_VALUES_INTERNAL)[number];

export const INSTALLMENT_STATUS_VALUES = ['PENDING', 'PAID'] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUS_VALUES)[number];

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  ONLINE: 'En ligne (CB)',
  CASH: 'Espèces',
  CARD_ONSITE: 'Carte sur place',
  CHECK: 'Chèque',
  TRANSFER: 'Virement',
};

/** Libellé court d'un mode de paiement. */
export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

/** Un mode de paiement encaissé via Stripe (lien de paiement). */
export function isOnlinePaymentMethod(method: PaymentMethod): boolean {
  return method === 'ONLINE';
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && (PAYMENT_METHOD_VALUES_INTERNAL as readonly string[]).includes(value);
}

/** Acompte par défaut (1re échéance) quand on règle en 2 fois. */
export const DEFAULT_DEPOSIT_PERCENT = 50;

export type InstallmentAmounts = {
  /** Montant de la 1re échéance (acompte), en centimes. */
  depositCents: number;
  /** Montant de la 2e échéance (solde), en centimes. */
  balanceCents: number;
};

/**
 * Répartit `totalCents` entre acompte (1re échéance) et solde (2e échéance)
 * selon `depositPercent` (1–99). Les centimes restants vont au solde.
 */
export function computeInstallmentAmounts(totalCents: number, depositPercent: number): InstallmentAmounts {
  const total = Math.max(0, Math.round(totalCents));
  const pct = clampDepositPercent(depositPercent);
  const depositCents = Math.min(total, Math.max(0, Math.round((total * pct) / 100)));
  return { depositCents, balanceCents: total - depositCents };
}

export function clampDepositPercent(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_DEPOSIT_PERCENT;
  return Math.min(99, Math.max(1, Math.round(value)));
}

/** Une échéance planifiée (telle qu'on la stocke / l'affiche). */
export type InstallmentPlanItem = {
  sequence: number;
  label: string | null;
  amountCents: number;
  method: PaymentMethod;
  status: InstallmentStatus;
};

/** Libellé d'une échéance selon sa position. */
export function installmentLabel(sequence: number, total: number): string {
  if (total <= 1) return 'Paiement';
  if (sequence === 1) return 'Acompte';
  if (sequence === total) return 'Solde';
  return `Échéance ${sequence}`;
}

function normalizeSettlementNote(note: string): string {
  return note
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Déduit un mode de paiement structuré à partir d'une note de règlement libre. */
export function inferPaymentMethodFromSettlementNote(note: string): PaymentMethod | null {
  const n = normalizeSettlementNote(note);
  if (!n.trim()) return null;
  if (/espec|cash|liquide/.test(n)) return 'CASH';
  if (/virement|vir\b|transfer|iban/.test(n)) return 'TRANSFER';
  if (/prelevement|prelev|sepa|debit/.test(n)) return 'TRANSFER';
  if (/cheque|cheq/.test(n)) return 'CHECK';
  if (/carte|cb|terminal|tpe/.test(n)) return 'CARD_ONSITE';
  return null;
}

/** Libellé document (contrat, facture) pour le mode de règlement d'une réservation. */
export function resolveReservationPaymentMethodLabel(input: {
  paymentChannel: string;
  settlementNote?: string | null;
  method?: PaymentMethod | string | null;
}): string {
  if (input.paymentChannel === 'ONLINE' || input.method === 'ONLINE') {
    return paymentMethodLabel('ONLINE');
  }
  if (input.method && isPaymentMethod(input.method)) {
    return paymentMethodLabel(input.method);
  }
  const inferred = inferPaymentMethodFromSettlementNote(input.settlementNote ?? '');
  if (inferred) return paymentMethodLabel(inferred);
  return 'Hors ligne';
}

/** Libellé affichage client (contrat, email) : précise « hors ligne » pour les règlements sur place. */
export function formatPaymentMethodForDocument(input: {
  paymentChannel: string;
  settlementNote?: string | null;
  method?: PaymentMethod | string | null;
}): string {
  if (input.method === 'ONLINE') {
    return paymentMethodLabel('ONLINE');
  }
  if (input.paymentChannel === 'ONLINE' && (input.method == null || input.method === 'ONLINE')) {
    return paymentMethodLabel('ONLINE');
  }
  const base = resolveReservationPaymentMethodLabel(input);
  if (/hors ligne/i.test(base)) return base;
  return `${base} (hors ligne)`;
}

export type DocumentPaymentInstallment = {
  sequence: number;
  label?: string | null;
  amountCents: number;
  method: PaymentMethod | string;
  status: InstallmentStatus | string;
  paidAt?: Date | string | null;
};

export type DocumentPaymentLine = {
  paidAt: Date | null;
  methodLabel: string;
  amountCents: number;
};

export type BuildDocumentPaymentLinesInput = {
  paymentChannel: string;
  paymentCapturedAt?: Date | string | null;
  settlementNote?: string | null;
  totalDueCents: number;
  installmentPlan?: DocumentPaymentInstallment[];
  /** Mode explicite (wizard) quand il n'y a pas d'échéances en base. */
  fallbackMethod?: PaymentMethod | string | null;
  /** Avoir client imputé sur cette réservation (centimes). */
  storeCreditAppliedCents?: number;
};

/** Avoir déjà enregistré ou déduit du total à payer en ligne. */
export function resolveStoreCreditAppliedCents(
  payableOnlineCents: number,
  totalDueCents: number | null | undefined,
  recordedAppliedCents?: number | null,
): number {
  if (recordedAppliedCents != null && recordedAppliedCents > 0) return recordedAppliedCents;
  if (totalDueCents == null) return 0;
  const delta = payableOnlineCents - totalDueCents;
  return delta > 0 ? delta : 0;
}

function parseCapturedAt(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Lignes de paiement encaissé pour contrats et justificatifs. */
export function buildDocumentPaymentLines(input: BuildDocumentPaymentLinesInput): DocumentPaymentLine[] {
  const plan = [...(input.installmentPlan ?? [])].sort((a, b) => a.sequence - b.sequence);
  const paidInstallments = plan.filter((p) => p.status === 'PAID');
  const capturedAt = parseCapturedAt(input.paymentCapturedAt);
  const storeCredit = Math.max(0, input.storeCreditAppliedCents ?? 0);
  const creditLine: DocumentPaymentLine[] =
    storeCredit > 0
      ? [
          {
            paidAt: capturedAt,
            methodLabel: 'Avoir client',
            amountCents: storeCredit,
          },
        ]
      : [];

  if (paidInstallments.length > 0) {
    return [
      ...creditLine,
      ...paidInstallments.map((p) => ({
        paidAt: parseCapturedAt(p.paidAt) ?? capturedAt,
        methodLabel: formatPaymentMethodForDocument({
          paymentChannel: input.paymentChannel,
          method: p.method,
          settlementNote: input.settlementNote,
        }),
        amountCents: p.amountCents,
      })),
    ];
  }

  if (!capturedAt && creditLine.length === 0) return [];

  const cardLines: DocumentPaymentLine[] = [];
  if (capturedAt && input.totalDueCents > 0) {
    cardLines.push({
      paidAt: capturedAt,
      methodLabel: formatPaymentMethodForDocument({
        paymentChannel: input.paymentChannel,
        method: input.fallbackMethod ?? (plan.length === 1 ? plan[0]?.method : null),
        settlementNote: input.settlementNote,
      }),
      amountCents: input.totalDueCents,
    });
  }

  return [...creditLine, ...cardLines];
}

/** Montant déjà encaissé selon le plan d'échéances ou le paiement unique. */
export function documentPaymentCollectedCents(input: BuildDocumentPaymentLinesInput): number {
  return buildDocumentPaymentLines(input).reduce((sum, line) => sum + line.amountCents, 0);
}

/**
 * Reste à payer (contrat, signature).
 * Utilise le total brut de la réservation : l'avoir figure en déduction dans le tarif
 * et comme règlement dans les paiements — ne pas le compter deux fois.
 */
export function documentPaymentBalanceCents(
  input: BuildDocumentPaymentLinesInput,
  grandTotalCents: number,
): number {
  return Math.max(0, grandTotalCents - documentPaymentCollectedCents(input));
}

export type InstallmentPlanItemView = {
  sequence?: number;
  status: string;
  amountCents: number;
};

/** Paiement fractionné (acompte + solde, etc.). */
export function isMultiInstallmentPlan(plan: readonly unknown[]): boolean {
  return plan.length >= 2;
}

/** Somme des échéances marquées réglées. */
export function installmentPlanCollectedCents(plan: readonly InstallmentPlanItemView[]): number {
  return plan.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amountCents, 0);
}

/** Toutes les échéances du plan sont réglées. */
export function isInstallmentPlanFullyPaid(plan: readonly InstallmentPlanItemView[]): boolean {
  return isMultiInstallmentPlan(plan) && plan.length > 0 && plan.every((p) => p.status === 'PAID');
}

/** Au moins une échéance réglée, mais pas toutes. */
export function hasPartialInstallmentPayment(plan: readonly InstallmentPlanItemView[]): boolean {
  if (!isMultiInstallmentPlan(plan)) return false;
  const paidCount = plan.filter((p) => p.status === 'PAID').length;
  return paidCount > 0 && paidCount < plan.length;
}

function hasCapturedOnlinePayment(paymentCapturedAt?: string | Date | null): boolean {
  if (!paymentCapturedAt) return false;
  const t =
    paymentCapturedAt instanceof Date ? paymentCapturedAt.getTime() : new Date(paymentCapturedAt).getTime();
  return Number.isFinite(t);
}

/** Montants hors ligne encore dus (extras sur place, etc.). */
export function hasOutstandingOfflineDue(offlineDueCents: number): boolean {
  return offlineDueCents >= 50;
}

/** Afficher « payée partiellement » : échéances incomplètes ou en ligne réglé + hors ligne restant. */
export function shouldShowPartialPaymentVisual(input: {
  paymentCapturedAt?: string | Date | null;
  installmentPlan?: readonly InstallmentPlanItemView[];
  offlineDueCents?: number;
}): boolean {
  const plan = input.installmentPlan ?? [];
  const offlineDue = Math.max(0, input.offlineDueCents ?? 0);
  if (isMultiInstallmentPlan(plan)) {
    if (isInstallmentPlanFullyPaid(plan)) {
      return hasOutstandingOfflineDue(offlineDue);
    }
    return hasPartialInstallmentPayment(plan);
  }
  return hasOutstandingOfflineDue(offlineDue) && hasCapturedOnlinePayment(input.paymentCapturedAt);
}

export type DocumentPaymentObligation = {
  label: string;
  methodLabel: string;
  amountCents: number;
  paid: boolean;
};

/** Toutes les échéances / règlements (payés et en attente) pour affichage client. */
export function buildDocumentPaymentObligations(
  input: BuildDocumentPaymentLinesInput,
): DocumentPaymentObligation[] {
  const storeCredit = Math.max(0, input.storeCreditAppliedCents ?? 0);
  const creditObligations: DocumentPaymentObligation[] =
    storeCredit > 0
      ? [
          {
            label: 'Avoir client',
            methodLabel: 'Crédit client',
            amountCents: storeCredit,
            paid: true,
          },
        ]
      : [];

  const plan = [...(input.installmentPlan ?? [])].sort((a, b) => a.sequence - b.sequence);
  if (plan.length > 0) {
    return [
      ...creditObligations,
      ...plan.map((p) => ({
        label: (p.label ?? installmentLabel(p.sequence, plan.length)).trim(),
        methodLabel: formatPaymentMethodForDocument({
          paymentChannel: input.paymentChannel,
          method: p.method,
          settlementNote: input.settlementNote,
        }),
        amountCents: p.amountCents,
        paid: p.status === 'PAID',
      })),
    ];
  }

  const capturedAt = parseCapturedAt(input.paymentCapturedAt);
  const cardObligations: DocumentPaymentObligation[] =
    input.totalDueCents > 0
      ? [
          {
            label: 'Paiement',
            methodLabel: formatPaymentMethodForDocument({
              paymentChannel: input.paymentChannel,
              method: input.fallbackMethod,
              settlementNote: input.settlementNote,
            }),
            amountCents: input.totalDueCents,
            paid: Boolean(capturedAt),
          },
        ]
      : [];

  return [...creditObligations, ...cardObligations];
}

/** Résumé lisible des modes de règlement (une ou plusieurs échéances). */
export function summarizeDocumentPaymentMethods(input: BuildDocumentPaymentLinesInput): string {
  const plan = [...(input.installmentPlan ?? [])].sort((a, b) => a.sequence - b.sequence);
  if (plan.length >= 2) {
    return plan
      .map((p) => {
        const label = (p.label ?? installmentLabel(p.sequence, plan.length)).trim();
        const method = resolveReservationPaymentMethodLabel({
          paymentChannel: input.paymentChannel,
          method: p.method,
          settlementNote: input.settlementNote,
        });
        return `${label} — ${method}`;
      })
      .join(' · ');
  }
  const lines = buildDocumentPaymentLines(input);
  if (lines.length > 0) return lines.map((l) => l.methodLabel).join(' · ');
  if (input.paymentChannel === 'ONLINE') return paymentMethodLabel('ONLINE');
  return resolveReservationPaymentMethodLabel({
    paymentChannel: input.paymentChannel,
    method: input.fallbackMethod,
    settlementNote: input.settlementNote,
  });
}

/* -------------------------------------------------------------------------- */
/*                            Icônes d'extras (lucide)                         */
/* -------------------------------------------------------------------------- */

/** Clés d'icônes proposées pour les extras (thème mer / nautisme). */
export const EXTRA_ICON_KEYS = [
  'anchor',
  'lifebuoy',
  'tow-buoy',
  'waves',
  'sailboat',
  'ship',
  'compass',
  'skipper',
  'wakeboard',
  'water-ski',
  'sea-scooter',
  'fish',
  'shell',
  'droplets',
  'fuel',
  'sun',
  'umbrella',
  'binoculars',
  'package',
] as const;
export type ExtraIconKey = (typeof EXTRA_ICON_KEYS)[number];

export const DEFAULT_EXTRA_ICON: ExtraIconKey = 'package';
/** Icône dédiée skipper. */
export const SKIPPER_ICON: ExtraIconKey = 'skipper';

export function isExtraIconKey(value: unknown): value is ExtraIconKey {
  return typeof value === 'string' && (EXTRA_ICON_KEYS as readonly string[]).includes(value);
}

const LEGACY_ICON_FALLBACK: Record<string, ExtraIconKey> = {
  lifebuoy: 'lifebuoy',
  wind: 'waves',
  map: 'compass',
  sparkles: 'sun',
  bed: 'package',
  utensils: 'package',
  wine: 'package',
  wifi: 'package',
  music: 'package',
  camera: 'package',
  snowflake: 'package',
  baby: 'package',
  dog: 'package',
};

export function resolveExtraIcon(icon: string | null | undefined): ExtraIconKey {
  if (isExtraIconKey(icon)) return icon;
  if (typeof icon === 'string' && icon in LEGACY_ICON_FALLBACK) {
    return LEGACY_ICON_FALLBACK[icon]!;
  }
  return DEFAULT_EXTRA_ICON;
}

/** Heuristique : cet extra correspond-il à un skipper / chef de bord ? */
export function isSkipperExtra(input: { name?: string | null; icon?: string | null }): boolean {
  if (input.icon === SKIPPER_ICON) return true;
  const name = (input.name ?? '').toLowerCase();
  return /skipper|capitaine|chef de bord|skip\b/.test(name);
}
