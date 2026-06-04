export type ReservationConfirmationEmailData = {
  brandName: string;
  clientFirstName: string;
  clientLastName: string;
  boatName: string;
  startLabel: string;
  endLabel: string;
  rentalAmountLabel: string;
  extrasLines: { name: string; amountLabel: string }[];
  totalAmountLabel: string;
  depositAmountLabel: string | null;
  paymentUrl: string | null;
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

export function buildReservationConfirmationHtml(data: ReservationConfirmationEmailData): string {
  const name = escapeHtml(`${data.clientFirstName} ${data.clientLastName}`.trim() || 'Client');
  const extrasRows =
    data.extrasLines.length > 0
      ? data.extrasLines
          .map(
            (x) =>
              `<tr><td style="padding:8px 0;color:#475569;font-size:14px;">${escapeHtml(x.name)}</td><td style="padding:8px 0;color:#0f172a;font-size:14px;text-align:right;font-weight:600;">${escapeHtml(x.amountLabel)}</td></tr>`,
          )
          .join('')
      : '';

  const payBlock = data.paymentUrl
    ? `<p style="margin:24px 0 12px;text-align:center;">
        <a href="${escapeHtml(data.paymentUrl)}" style="display:inline-block;background:#416B9F;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:12px;">Payer ma réservation</a>
      </p>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;line-height:1.5;text-align:center;">
        Après paiement, vous recevrez un email pour signer votre contrat de location en ligne.<br/>
        Vous serez débité du montant total de la location. Une <strong>empreinte bancaire</strong> sera également enregistrée pour la caution${
          data.depositAmountLabel ? ` (${escapeHtml(data.depositAmountLabel)})` : ''
        } : elle n’est pas un débit immédiat, mais une autorisation qui pourra être utilisée en cas de dommages selon nos conditions.
      </p>`
    : '';

  const depositNote = data.depositAmountLabel
    ? `<tr><td style="padding:8px 0;color:#475569;font-size:14px;">Caution (empreinte)</td><td style="padding:8px 0;color:#0f172a;font-size:14px;text-align:right;font-weight:600;">${escapeHtml(data.depositAmountLabel)}</td></tr>`
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
            <tr><td style="padding:8px 0;color:#475569;font-size:14px;">Location</td><td style="padding:8px 0;color:#0f172a;font-size:14px;text-align:right;font-weight:600;">${escapeHtml(data.rentalAmountLabel)}</td></tr>
            ${extrasRows}
            <tr><td style="padding:12px 0 8px;color:#0f172a;font-size:15px;font-weight:700;border-top:1px solid #e2e8f0;">Total à régler</td><td style="padding:12px 0 8px;color:#416B9F;font-size:15px;text-align:right;font-weight:700;border-top:1px solid #e2e8f0;">${escapeHtml(data.totalAmountLabel)}</td></tr>
            ${depositNote}
          </table>
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
    `Total à régler : ${data.totalAmountLabel}`,
  ];
  if (data.depositAmountLabel) {
    lines.push(`Caution (empreinte bancaire, non débitée immédiatement) : ${data.depositAmountLabel}`);
  }
  if (data.paymentUrl) {
    lines.push(
      '',
      'Payer en ligne :',
      data.paymentUrl,
      '',
      'Après paiement, un email vous permettra de signer le contrat de location.',
      'Le paiement règle la totalité de la location. Une empreinte bancaire sera enregistrée pour la caution.',
    );
  }
  lines.push('', `${data.brandName} — ${data.contactPhone} — ${data.contactEmail}`);
  return lines.join('\n');
}
