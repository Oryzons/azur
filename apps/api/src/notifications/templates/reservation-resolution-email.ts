export type ResolutionEmailData = {
  brandName: string;
  clientFirstName: string;
  clientLastName: string;
  boatName: string;
  startLabel: string;
  endLabel: string;
  amountLabel: string;
  contactEmail: string;
  contactPhone: string;
  paymentUrl?: string | null;
  note?: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function contactFooter(data: Pick<ResolutionEmailData, 'contactEmail' | 'contactPhone'>) {
  const bits = [data.contactEmail, data.contactPhone].filter(Boolean);
  if (!bits.length) return '';
  return `<p style="margin:24px 0 0;color:#64748b;font-size:13px;">Contact : ${bits.map((b) => escapeHtml(b)).join(' · ')}</p>`;
}

export function buildRefundEmailHtml(data: ResolutionEmailData): string {
  const name = escapeHtml(`${data.clientFirstName} ${data.clientLastName}`.trim() || 'Client');
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:32px 16px;background:#f1f5f9;font-family:system-ui,sans-serif;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#3730a3,#4f46e5);padding:28px 32px;">
      <p style="margin:0;color:#c7d2fe;font-size:13px;text-transform:uppercase;">${escapeHtml(data.brandName)}</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;">Remboursement effectué</h1>
    </td></tr>
    <tr><td style="padding:32px;">
      <p style="margin:0 0 16px;color:#0f172a;">Bonjour ${name},</p>
      <p style="margin:0 0 20px;color:#475569;line-height:1.6;">Nous confirmons le remboursement de <strong>${escapeHtml(data.amountLabel)}</strong> concernant votre location <strong>${escapeHtml(data.boatName)}</strong> (${escapeHtml(data.startLabel)}).</p>
      <p style="margin:0;color:#475569;line-height:1.6;">Le virement apparaîtra sur votre compte sous quelques jours ouvrés selon votre banque.</p>
      ${contactFooter(data)}
    </td></tr>
  </table></body></html>`;
}

export function buildRefundEmailText(data: ResolutionEmailData): string {
  const name = `${data.clientFirstName} ${data.clientLastName}`.trim() || 'Client';
  return [
    `Bonjour ${name},`,
    '',
    `Remboursement de ${data.amountLabel} confirmé pour ${data.boatName} (${data.startLabel}).`,
    'Le virement sera visible sous quelques jours ouvrés.',
  ].join('\n');
}

export function buildStoreCreditEmailHtml(data: ResolutionEmailData): string {
  const name = escapeHtml(`${data.clientFirstName} ${data.clientLastName}`.trim() || 'Client');
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:32px 16px;background:#f1f5f9;font-family:system-ui,sans-serif;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#0f766e,#14b8a6);padding:28px 32px;">
      <p style="margin:0;color:#ccfbf1;font-size:13px;text-transform:uppercase;">${escapeHtml(data.brandName)}</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;">Avoir enregistré</h1>
    </td></tr>
    <tr><td style="padding:32px;">
      <p style="margin:0 0 16px;color:#0f172a;">Bonjour ${name},</p>
      <p style="margin:0 0 20px;color:#475569;line-height:1.6;">Suite à l'annulation de votre réservation <strong>${escapeHtml(data.boatName)}</strong>, un avoir de <strong>${escapeHtml(data.amountLabel)}</strong> a été enregistré sur votre compte client.</p>
      <p style="margin:0;color:#475569;line-height:1.6;">Il sera <strong>appliqué automatiquement</strong> lors de votre prochaine réservation.</p>
      ${contactFooter(data)}
    </td></tr>
  </table></body></html>`;
}

export function buildStoreCreditEmailText(data: ResolutionEmailData): string {
  const name = `${data.clientFirstName} ${data.clientLastName}`.trim() || 'Client';
  return [
    `Bonjour ${name},`,
    '',
    `Avoir de ${data.amountLabel} enregistré suite à l'annulation de ${data.boatName}.`,
    'Il sera appliqué automatiquement à votre prochaine réservation.',
  ].join('\n');
}

export function buildMoveEmailHtml(data: ResolutionEmailData): string {
  const name = escapeHtml(`${data.clientFirstName} ${data.clientLastName}`.trim() || 'Client');
  const payBlock = data.paymentUrl
    ? `<p style="margin:20px 0;"><a href="${escapeHtml(data.paymentUrl)}" style="display:inline-block;background:#416B9F;color:#fff;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:700;">Régler le supplément (${escapeHtml(data.amountLabel)})</a></p>`
    : '';
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:32px 16px;background:#f1f5f9;font-family:system-ui,sans-serif;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#1e40af,#2563eb);padding:28px 32px;">
      <p style="margin:0;color:#bfdbfe;font-size:13px;text-transform:uppercase;">${escapeHtml(data.brandName)}</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;">Réservation déplacée</h1>
    </td></tr>
    <tr><td style="padding:32px;">
      <p style="margin:0 0 16px;color:#0f172a;">Bonjour ${name},</p>
      <p style="margin:0 0 12px;color:#475569;line-height:1.6;">Votre location a été replanifiée :</p>
      <p style="margin:0 0 8px;color:#0f172a;"><strong>${escapeHtml(data.boatName)}</strong></p>
      <p style="margin:0 0 20px;color:#475569;">Du ${escapeHtml(data.startLabel)} au ${escapeHtml(data.endLabel)}.</p>
      ${data.paymentUrl ? `<p style="margin:0 0 8px;color:#475569;">Un supplément de <strong>${escapeHtml(data.amountLabel)}</strong> est dû suite au changement de bateau ou de créneau.</p>${payBlock}` : `<p style="margin:0 0 12px;color:#475569;">Votre contrat signé a été mis à jour (bateau ou dates). Le PDF actualisé vous est renvoyé par email séparément.</p><p style="margin:0;color:#475569;">Aucun supplément n'est dû pour ce déplacement.</p>`}
      ${contactFooter(data)}
    </td></tr>
  </table></body></html>`;
}

export function buildMoveEmailText(data: ResolutionEmailData): string {
  const name = `${data.clientFirstName} ${data.clientLastName}`.trim() || 'Client';
  const lines = [
    `Bonjour ${name},`,
    '',
    `Votre réservation ${data.boatName} a été déplacée.`,
    `Nouveau créneau : ${data.startLabel} → ${data.endLabel}.`,
  ];
  if (data.paymentUrl) {
    lines.push('', `Supplément à régler : ${data.amountLabel}`, data.paymentUrl);
  }
  return lines.join('\n');
}

export function buildSupplementDueEmailHtml(data: ResolutionEmailData): string {
  const name = escapeHtml(`${data.clientFirstName} ${data.clientLastName}`.trim() || 'Client');
  const payBlock = data.paymentUrl
    ? `<p style="margin:20px 0;"><a href="${escapeHtml(data.paymentUrl)}" style="display:inline-block;background:#416B9F;color:#fff;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:700;">Régler le solde (${escapeHtml(data.amountLabel)})</a></p>`
    : '';
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:32px 16px;background:#f1f5f9;font-family:system-ui,sans-serif;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#1e40af,#2563eb);padding:28px 32px;">
      <p style="margin:0;color:#bfdbfe;font-size:13px;text-transform:uppercase;">${escapeHtml(data.brandName)}</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;">Solde restant à régler</h1>
    </td></tr>
    <tr><td style="padding:32px;">
      <p style="margin:0 0 16px;color:#0f172a;">Bonjour ${name},</p>
      <p style="margin:0 0 12px;color:#475569;line-height:1.6;">Votre réservation a été mise à jour :</p>
      <p style="margin:0 0 8px;color:#0f172a;"><strong>${escapeHtml(data.boatName)}</strong></p>
      <p style="margin:0 0 20px;color:#475569;">Du ${escapeHtml(data.startLabel)} au ${escapeHtml(data.endLabel)}.</p>
      <p style="margin:0 0 8px;color:#475569;line-height:1.6;">Un solde de <strong>${escapeHtml(data.amountLabel)}</strong> reste à régler suite à l'ajout d'une prestation ou d'un extra à votre location.</p>
      ${payBlock}
      <p style="margin:16px 0 0;color:#64748b;font-size:13px;line-height:1.5;">Vous pouvez aussi régler ce montant sur place (espèces, virement ou carte) le jour de la location.</p>
      ${contactFooter(data)}
    </td></tr>
  </table></body></html>`;
}

export function buildSupplementDueEmailText(data: ResolutionEmailData): string {
  const name = `${data.clientFirstName} ${data.clientLastName}`.trim() || 'Client';
  const lines = [
    `Bonjour ${name},`,
    '',
    `Votre réservation ${data.boatName} a été mise à jour.`,
    `Créneau : ${data.startLabel} → ${data.endLabel}.`,
    '',
    `Un solde de ${data.amountLabel} reste à régler suite à l'ajout d'une prestation ou d'un extra.`,
  ];
  if (data.paymentUrl) {
    lines.push('', 'Régler en ligne :', data.paymentUrl);
  }
  lines.push('', 'Règlement sur place possible (espèces, virement ou carte) le jour de la location.');
  return lines.join('\n');
}
