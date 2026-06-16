export type ReservationConfirmationEmailData = {
  brandName: string;
  clientFirstName: string;
  clientLastName: string;
  boatName: string;
  startLabel: string;
  endLabel: string;
  rentalAmountLabel: string;
  extrasLines: { name: string; amountLabel: string }[];
  /** Extras réglés sur place (hors paiement en ligne). */
  offlineExtrasLines?: { name: string; amountLabel: string }[];
  /** Somme des extras hors ligne, si présents. */
  offlineDueAmountLabel?: string | null;
  /** Remises / avoir (montants négatifs affichés avec −). */
  adjustmentLines?: { label: string; amountLabel: string }[];
  totalAmountLabel: string;
  depositAmountLabel: string | null;
  paymentUrl: string | null;
  /** Échéances (paiement en 2 fois). Vide / absent = paiement unique. */
  installmentLines?: { label: string; amountLabel: string; methodLabel: string; paid: boolean }[];
  /** Libellé du bouton de paiement (ex. "Payer l'acompte"). */
  payButtonLabel?: string | null;
  /** Montant réglé via le bouton de paiement maintenant (ex. acompte). */
  payNowAmountLabel?: string | null;
  contactEmail: string;
  contactPhone: string;
  addressLine: string;
};

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const PRICE_LABEL_CELL =
  'padding:8px 0;font-size:14px;vertical-align:top;padding-right:16px;word-break:break-word;';
const PRICE_AMOUNT_CELL =
  'padding:8px 0;font-size:14px;text-align:right;font-weight:600;vertical-align:top;white-space:nowrap;width:1%;';

/** Espace insécable avant € pour éviter un retour à la ligne sur mobile. */
function emailPrice(amountLabel: string): string {
  return escapeHtml(amountLabel.replace(/ (?=€)/g, '\u00a0'));
}

function priceRow(
  label: string,
  amount: string,
  colors?: { label?: string; amount?: string },
  labelHtml?: string,
): string {
  const labelColor = colors?.label ?? '#475569';
  const amountColor = colors?.amount ?? '#0f172a';
  const labelContent = labelHtml ?? escapeHtml(label);
  return `<tr><td style="${PRICE_LABEL_CELL}color:${labelColor};">${labelContent}</td><td style="${PRICE_AMOUNT_CELL}color:${amountColor};">${emailPrice(amount)}</td></tr>`;
}

function priceTotalRow(label: string, amount: string): string {
  return `<tr><td style="padding:12px 0 8px;color:#0f172a;font-size:15px;font-weight:700;border-top:1px solid #e2e8f0;vertical-align:top;padding-right:16px;word-break:break-word;">${escapeHtml(label)}</td><td style="padding:12px 0 8px;color:#416B9F;font-size:15px;text-align:right;font-weight:700;border-top:1px solid #e2e8f0;vertical-align:top;white-space:nowrap;width:1%;">${emailPrice(amount)}</td></tr>`;
}

export function buildReservationConfirmationHtml(data: ReservationConfirmationEmailData): string {
  const name = escapeHtml(`${data.clientFirstName} ${data.clientLastName}`.trim() || 'Client');
  const extrasRows =
    data.extrasLines.length > 0 ? data.extrasLines.map((x) => priceRow(x.name, x.amountLabel)).join('') : '';

  const offlineExtrasRows =
    (data.offlineExtrasLines ?? []).length > 0
      ? data.offlineExtrasLines!.map((x) =>
          priceRow(x.name, x.amountLabel, { label: '#92400e', amount: '#92400e' }),
        ).join('')
      : '';

  const adjustmentRows =
    (data.adjustmentLines ?? []).length > 0
      ? data.adjustmentLines!
          .map((x) => priceRow(x.label, x.amountLabel, { label: '#047857', amount: '#047857' }))
          .join('')
      : '';

  const buttonLabel = data.payButtonLabel?.trim() || 'Payer ma réservation';
  const payBlock = data.paymentUrl
    ? `<p style="margin:24px 0 12px;text-align:center;">
        <a href="${escapeHtml(data.paymentUrl)}" style="display:inline-block;background:#416B9F;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:12px;">${escapeHtml(buttonLabel)}${
          data.payNowAmountLabel ? ` — ${escapeHtml(data.payNowAmountLabel)}` : ''
        }</a>
      </p>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;line-height:1.5;text-align:center;">
        Après paiement, vous recevrez un email pour signer votre contrat de location en ligne.<br/>
        Une <strong>empreinte bancaire</strong> sera également enregistrée pour la caution${
          data.depositAmountLabel ? ` (${escapeHtml(data.depositAmountLabel)})` : ''
        } : elle n’est pas un débit immédiat, mais une autorisation qui pourra être utilisée en cas de dommages selon nos conditions.
      </p>`
    : '';

  const installmentBlock =
    data.installmentLines && data.installmentLines.length > 0
      ? `<table role="presentation" width="100%" style="background:#f0f6fc;border-radius:12px;padding:4px 20px;margin:0 0 24px;">
          <tr><td colspan="2" style="padding:12px 0 4px;color:#1e3a5f;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Paiement en ${data.installmentLines.length} fois</td></tr>
          ${data.installmentLines
            .map((l) => {
              const labelHtml = `${escapeHtml(l.label)} · <span style="color:#64748b;">${escapeHtml(l.methodLabel)}</span>${
                l.paid ? ' <span style="color:#16a34a;font-weight:600;">(réglé)</span>' : ''
              }`;
              return priceRow(l.label, l.amountLabel, undefined, labelHtml);
            })
            .join('')}
        </table>`
      : '';

  const depositNote = data.depositAmountLabel
    ? priceRow('Caution (empreinte)', data.depositAmountLabel)
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
        <tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#416B9F 100%);padding:28px 32px;">
          <p style="margin:0;color:#e2e8f0;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;">${escapeHtml(data.brandName)}</p>
          <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Confirmation de réservation</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#0f172a;font-size:16px;">Bonjour ${name},</p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            Votre réservation est enregistrée. Voici le récapitulatif de votre location.
          </p>
          <table role="presentation" width="100%" style="background:#f8fafc;border-radius:12px;padding:4px 20px;margin-bottom:24px;">
            <tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Bateau</p>
              <p style="margin:4px 0 0;color:#0f172a;font-size:16px;font-weight:700;">${escapeHtml(data.boatName)}</p>
            </td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0;color:#64748b;font-size:12px;">Départ</p>
              <p style="margin:4px 0 0;color:#0f172a;font-size:15px;font-weight:600;">${escapeHtml(data.startLabel)}</p>
            </td></tr>
            <tr><td style="padding:12px 0;">
              <p style="margin:0;color:#64748b;font-size:12px;">Retour</p>
              <p style="margin:4px 0 0;color:#0f172a;font-size:15px;font-weight:600;">${escapeHtml(data.endLabel)}</p>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:8px;">
            ${priceRow('Location', data.rentalAmountLabel)}
            ${extrasRows}
            ${offlineExtrasRows}
            ${adjustmentRows}
            ${priceTotalRow('Total à régler en ligne', data.totalAmountLabel)}
            ${
              data.offlineDueAmountLabel
                ? priceRow('À régler sur place (hors ligne)', data.offlineDueAmountLabel, {
                    label: '#92400e',
                    amount: '#92400e',
                  })
                : ''
            }
            ${depositNote}
          </table>
          ${installmentBlock}
          ${payBlock}
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0;"/>
          <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
            <strong>${escapeHtml(data.brandName)}</strong><br/>
            ${escapeHtml(data.addressLine)}<br/>
            ${escapeHtml(data.contactPhone)} · <a href="mailto:${escapeHtml(data.contactEmail)}" style="color:#416B9F;">${escapeHtml(data.contactEmail)}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildReservationConfirmationText(data: ReservationConfirmationEmailData): string {
  const lines = [
    `Bonjour ${data.clientFirstName} ${data.clientLastName},`,
    '',
    `Votre réservation chez ${data.brandName} est enregistrée.`,
    '',
    `Bateau : ${data.boatName}`,
    `Départ : ${data.startLabel}`,
    `Retour : ${data.endLabel}`,
    '',
    `Location : ${data.rentalAmountLabel}`,
    ...data.extrasLines.map((x) => `${x.name} : ${x.amountLabel}`),
    ...(data.offlineExtrasLines ?? []).map((x) => `${x.name} : ${x.amountLabel}`),
    ...(data.adjustmentLines ?? []).map((x) => `${x.label} : ${x.amountLabel}`),
    `Total à régler en ligne : ${data.totalAmountLabel}`,
    ...(data.offlineDueAmountLabel
      ? [`À régler sur place (hors ligne) : ${data.offlineDueAmountLabel}`]
      : []),
  ];
  if (data.installmentLines && data.installmentLines.length > 0) {
    lines.push('', `Paiement en ${data.installmentLines.length} fois :`);
    for (const l of data.installmentLines) {
      lines.push(`- ${l.label} (${l.methodLabel}) : ${l.amountLabel}${l.paid ? ' — réglé' : ''}`);
    }
  }
  if (data.depositAmountLabel) {
    lines.push(`Caution (empreinte bancaire, non débitée immédiatement) : ${data.depositAmountLabel}`);
  }
  if (data.paymentUrl) {
    const label = data.payButtonLabel?.trim() || 'Payer en ligne';
    lines.push(
      '',
      `${label}${data.payNowAmountLabel ? ` (${data.payNowAmountLabel})` : ''} :`,
      data.paymentUrl,
      '',
      'Après paiement, un email vous permettra de signer le contrat de location.',
      'Une empreinte bancaire sera enregistrée pour la caution.',
    );
  }
  lines.push('', `${data.brandName} — ${data.contactPhone} — ${data.contactEmail}`);
  return lines.join('\n');
}
