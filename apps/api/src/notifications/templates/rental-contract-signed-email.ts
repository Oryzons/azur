export type RentalContractSignedEmailData = {
  brandName: string;
  clientFirstName: string;
  contractNumber: number;
  boatName: string;
  startLabel: string;
  endLabel: string;
  totalLabel: string;
  downloadUrl: string;
};

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function buildRentalContractSignedEmailHtml(data: RentalContractSignedEmailData): string {
  const name = escapeHtml(data.clientFirstName.trim() || 'Bonjour');
  return `<!DOCTYPE html>
<html lang="fr">
<body style="font-family:Segoe UI,Arial,sans-serif;color:#1e293b;line-height:1.5;margin:0;padding:24px;background:#f8fafc;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:24px;">
    <p style="margin:0 0 12px;">${name},</p>
    <p style="margin:0 0 8px;">Votre <strong>contrat de location n°${data.contractNumber}</strong> pour <strong>${escapeHtml(data.boatName)}</strong> est signé et archivé chez ${escapeHtml(data.brandName)}.</p>
    <p style="margin:0 0 16px;font-size:13px;color:#475569;">Référence à conserver : <strong>contrat n°${data.contractNumber}</strong></p>
    <table style="width:100%;font-size:14px;margin:0 0 20px;border-collapse:collapse;">
      <tr><td style="padding:4px 0;color:#64748b;">Départ</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(data.startLabel)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;">Retour</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(data.endLabel)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;">Total</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(data.totalLabel)}</td></tr>
    </table>
    <p style="margin:0 0 12px;font-size:14px;">Le <strong>PDF signé</strong> est joint à cet email. Vous pouvez aussi le récupérer à tout moment via ce lien sécurisé (valable pour cette réservation) :</p>
    <p style="margin:0 0 20px;">
      <a href="${escapeHtml(data.downloadUrl)}" style="display:inline-block;background:#416B9F;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:10px;">Télécharger le contrat n°${data.contractNumber} (PDF)</a>
    </p>
    <p style="margin:0;font-size:12px;color:#64748b;">Conservez ce document pour la durée de la location.</p>
  </div>
</body>
</html>`;
}

export function buildRentalContractSignedEmailText(data: RentalContractSignedEmailData): string {
  const lines = [
    `Bonjour ${data.clientFirstName.trim() || ''}`.trim(),
    '',
    `Votre contrat de location n°${data.contractNumber} pour ${data.boatName} est signé et archivé.`,
    `Référence : contrat n°${data.contractNumber}`,
    `Départ : ${data.startLabel}`,
    `Retour : ${data.endLabel}`,
    `Total : ${data.totalLabel}`,
    '',
    'Le PDF signé est joint à cet email.',
    `Lien sécurisé de téléchargement : ${data.downloadUrl}`,
    '',
    data.brandName,
  ];
  return lines.join('\n');
}
