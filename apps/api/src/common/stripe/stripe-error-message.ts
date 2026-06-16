import { BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';

export function isStripeChargeAlreadyRefunded(err: unknown): boolean {
  if (err instanceof Stripe.errors.StripeError) {
    const code = err.code ?? '';
    const raw = err.message ?? '';
    return code === 'charge_already_refunded' || /already been refunded/i.test(raw);
  }
  if (err instanceof BadRequestException) {
    return /intégralement remboursé|déjà été remboursé/i.test(err.message);
  }
  return false;
}

/** Message utilisateur en français pour les erreurs Stripe courantes. */
export function stripeErrorMessageFr(err: unknown, fallback = 'Erreur Stripe.') : string {
  if (err instanceof Stripe.errors.StripeError) {
    const code = err.code ?? '';
    const raw = (err.message ?? '').trim();

    const greaterThanCharge = /Refund amount \(([^)]+)\) is greater than charge amount \(([^)]+)\)/i.exec(
      raw,
    );
    if (greaterThanCharge) {
      return `Le montant du remboursement (${greaterThanCharge[1]}) dépasse le montant payé (${greaterThanCharge[2]}).`;
    }

    const amountTooLarge = /Amount must be no more than (\d+)/i.exec(raw);
    if (amountTooLarge) {
      const euros = (Number(amountTooLarge[1]) / 100).toFixed(2);
      return `Le montant du remboursement dépasse le maximum autorisé (${euros} €).`;
    }

    switch (code) {
      case 'charge_already_refunded':
        return 'La part CB Stripe est déjà remboursée. S’il reste une part espèces/chèque, enregistrez uniquement ce solde (sans repasser par Stripe).';
      case 'amount_too_large':
        return 'Le montant du remboursement est trop élevé par rapport au paiement encaissé.';
      case 'resource_missing':
        if (/payment_intent/i.test(raw)) {
          return 'Paiement Stripe introuvable pour cette réservation.';
        }
        return 'Ressource Stripe introuvable.';
      case 'balance_insufficient':
        return 'Solde Stripe insuffisant pour effectuer ce remboursement.';
      default:
        break;
    }

    if (/already been refunded/i.test(raw)) {
      return 'Ce paiement a déjà été remboursé.';
    }
    if (/greater than.*charge/i.test(raw)) {
      return 'Le montant du remboursement dépasse le montant payé.';
    }
    if (/not paid/i.test(raw) || /payment_status/i.test(raw)) {
      return 'Le paiement n’est pas encaissé côté Stripe.';
    }

    if (raw) return raw;
    return fallback;
  }

  if (err instanceof Error && err.message.trim()) {
    return err.message.trim();
  }

  return fallback;
}
