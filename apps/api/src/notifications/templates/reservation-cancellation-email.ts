export type ReservationCancellationEmailData = {
  brandName: string;
  clientFirstName: string;
  clientLastName: string;
  boatName: string;
  startLabel: string;
  endLabel: string;
  reason: string | null;
  contactEmail: string;
  contactPhone: string;
};

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function buildReservationCancellationHtml(data: ReservationCancellationEmailData): string {
  const name = escapeHtml(`${data.clientFirstName} ${data.clientLastName}`.trim() || 'Client');
  const reasonBlock = data.reason?.trim()
    ? `<div style="margin:0 0 24px;padding:16px 20px;background:#fef2f2;border-radius:12px;border-left:4px solid #dc2626;">
        <p style="margin:0 0 6px;color:#991b1b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Motif</p>
        <p style="margin:0;color:#7f1d1d;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(data.reason.trim())}</p>
      </div>`
    : '';

  const contactBits = [data.contactEmail, data.contactPhone].filter(Boolean);
  const contactLine = contactBits.length
    ? `<p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.5;">Une question ? Contactez-nous${data.contactEmail ? ` à <a href="mailto:${escapeHtml(data.contactEmail)}" style="color:#416B9F;">${escapeHtml(data.contactEmail)}</a>` : ''}${data.contactPhone ? ` · ${escapeHtml(data.contactPhone)}` : ''}.</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
        <tr><td style="background:linear-gradient(135deg,#7f1d1d 0%,#dc2626 100%);padding:28px 32px;">
          <p style="margin:0;color:#fecaca;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;">${escapeHtml(data.brandName)}</p>
          <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">Réservation annulée</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#0f172a;font-size:16px;">Bonjour ${name},</p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            Nous vous informons que votre réservation suivante a été <strong>annulée</strong>.
          </p>
          <table role="presentation" width="100%" style="background:#f8fafc;border-radius:12px;padding:4px 20px;margin-bottom:24px;">
            <tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Bateau</p>
              <p style="margin:4px 0 0;color:#0f172a;font-size:16px;font-weight:700;">${escapeHtml(data.boatName)}</p>
            </td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0;color:#64748b;font-size:12px;">Début</p>
              <p style="margin:4px 0 0;color:#0f172a;font-size:14px;">${escapeHtml(data.startLabel)}</p>
            </td></tr>
            <tr><td style="padding:12px 0;">
              <p style="margin:0;color:#64748b;font-size:12px;">Fin</p>
              <p style="margin:4px 0 0;color:#0f172a;font-size:14px;">${escapeHtml(data.endLabel)}</p>
            </td></tr>
          </table>
          ${reasonBlock}
          <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">
            Si un paiement avait été effectué, nous vous recontacterons le cas échéant concernant les modalités de remboursement.
          </p>
          ${contactLine}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildReservationCancellationText(data: ReservationCancellationEmailData): string {
  const name = `${data.clientFirstName} ${data.clientLastName}`.trim() || 'Client';
  const lines = [
    `${data.brandName} — Réservation annulée`,
    '',
    `Bonjour ${name},`,
    '',
    'Votre réservation a été annulée :',
    `- Bateau : ${data.boatName}`,
    `- Début : ${data.startLabel}`,
    `- Fin : ${data.endLabel}`,
  ];
  if (data.reason?.trim()) {
    lines.push('', 'Motif :', data.reason.trim());
  }
  lines.push('', 'Si un paiement avait été effectué, nous vous recontacterons concernant le remboursement.');
  if (data.contactEmail || data.contactPhone) {
    lines.push('', `Contact : ${[data.contactEmail, data.contactPhone].filter(Boolean).join(' · ')}`);
  }
  return lines.join('\n');
}
