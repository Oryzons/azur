export type RefundReceiptLine = {
  designation: string;
  amount: string;
};

export type RefundReceiptRefundLine = {
  label: string;
  amount: string;
};

export type RefundReceiptPaymentLine = {
  date: string;
  method: string;
  amount: string;
};

export type RefundReceiptViewModel = {
  company: {
    brandName: string;
    addressLines: string[];
    postalCode: string;
    city: string;
    country: string;
    vatNumber: string;
  };
  logoSvg: string;
  clientName: string;
  clientAddressLines: string[];
  locationNumber: string;
  checkIn: string;
  checkOut: string;
  paymentSummary: string;
  paymentLines: RefundReceiptPaymentLine[];
  lines: RefundReceiptLine[];
  total: string;
  vatAmount: string;
  refunds: RefundReceiptRefundLine[];
  totalRefunded: string;
};

function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const PAGE_STYLE = `
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11pt;
  color: #111;
  line-height: 1.35;
}
.page { width: 100%; }
.top-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 28px;
}
.company-block { flex: 1; max-width: 55%; }
.company-block .brand { font-size: 13pt; font-weight: 700; margin-bottom: 4px; }
.company-block p { margin: 0 0 2px; }
.logo-block { flex-shrink: 0; width: 160px; text-align: right; }
.logo-block svg { width: 160px; height: auto; }
.mid-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 32px;
  margin-bottom: 24px;
}
.booking-block { flex: 1; }
.doc-title {
  font-size: 16pt;
  font-weight: 700;
  margin: 0 0 12px;
}
.booking-meta p { margin: 0 0 4px; }
.payments-box {
  margin: 0 0 20px;
  border: 1px solid #222;
  padding: 10px 12px;
}
.payments-box h2 {
  font-size: 11pt;
  font-weight: 700;
  margin: 0 0 8px;
}
.payments-table {
  width: 100%;
  border-collapse: collapse;
}
.payments-table th,
.payments-table td {
  border: 1px solid #222;
  padding: 6px 8px;
  font-size: 10pt;
}
.payments-table th { font-weight: 700; text-align: left; }
.payments-table td.amount { text-align: right; white-space: nowrap; width: 110px; }
.client-block { flex: 0 0 42%; text-align: right; }
.client-block .name { font-weight: 700; margin-bottom: 4px; }
.client-block p { margin: 0 0 2px; }
table.charges {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0 0;
}
table.charges th,
table.charges td {
  border: 1px solid #222;
  padding: 8px 10px;
}
table.charges th { font-weight: 700; text-align: left; }
table.charges th.amount,
table.charges td.amount { text-align: right; width: 120px; }
.totals {
  margin-top: 10px;
  text-align: right;
}
.totals p { margin: 2px 0; }
.totals .total-line { font-weight: 700; }
.refunds-box {
  margin-top: 28px;
  border: 1px solid #222;
  padding: 12px 14px 10px;
  max-width: 100%;
}
.refunds-box h2 {
  font-size: 12pt;
  font-weight: 700;
  margin: 0 0 10px;
}
.refunds-table {
  width: 100%;
  border-collapse: collapse;
}
.refunds-table td {
  padding: 4px 0;
  vertical-align: top;
}
.refunds-table td.amount { text-align: right; white-space: nowrap; }
.refunds-table tr.total td {
  padding-top: 8px;
  font-weight: 700;
  border-top: 1px solid #222;
}
`;

export function buildRefundReceiptHtml(vm: RefundReceiptViewModel): string {
  const companyLines = vm.company.addressLines.map((l) => `<p>${esc(l)}</p>`).join('');
  const clientLines = vm.clientAddressLines.map((l) => `<p>${esc(l)}</p>`).join('');
  const chargeRows = vm.lines
    .map(
      (l) =>
        `<tr><td>${esc(l.designation)}</td><td class="amount">${esc(l.amount)}</td></tr>`,
    )
    .join('');
  const refundRows = vm.refunds
    .map(
      (r) =>
        `<tr><td>${esc(r.label)}</td><td class="amount">${esc(r.amount)}</td></tr>`,
    )
    .join('');
  const paymentRows = vm.paymentLines
    .map(
      (p) =>
        `<tr><td>${esc(p.date)}</td><td>${esc(p.method)}</td><td class="amount">${esc(p.amount)}</td></tr>`,
    )
    .join('');
  const paymentsBlock =
    vm.paymentLines.length > 0
      ? `<div class="payments-box">
          <h2>Règlements encaissés</h2>
          <p style="margin:0 0 8px;font-size:10pt;"><strong>Mode de règlement :</strong> ${esc(vm.paymentSummary)}</p>
          <table class="payments-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Mode</th>
                <th class="amount">Montant</th>
              </tr>
            </thead>
            <tbody>${paymentRows}</tbody>
          </table>
        </div>`
      : vm.paymentSummary
        ? `<p style="margin:0 0 16px;font-size:10pt;"><strong>Mode de règlement :</strong> ${esc(vm.paymentSummary)}</p>`
        : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Justificatif de remboursement</title>
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <div class="page">
    <div class="top-row">
      <div class="company-block">
        <div class="brand">${esc(vm.company.brandName)}</div>
        ${companyLines}
        <p>${esc(vm.company.postalCode)} ${esc(vm.company.city.toUpperCase())}</p>
        <p>${esc(vm.company.country.toUpperCase())}</p>
        ${vm.company.vatNumber ? `<p>TVA : ${esc(vm.company.vatNumber)}</p>` : ''}
      </div>
      ${vm.logoSvg ? `<div class="logo-block">${vm.logoSvg}</div>` : ''}
    </div>

    <div class="mid-row">
      <div class="booking-block">
        <h1 class="doc-title">Justificatif de remboursement</h1>
        <div class="booking-meta">
          <p><strong>Location N° :</strong> ${esc(vm.locationNumber)}</p>
          <p><strong>Check-in :</strong> ${esc(vm.checkIn)}</p>
          <p><strong>Check-out :</strong> ${esc(vm.checkOut)}</p>
        </div>
      </div>
      <div class="client-block">
        <p class="name">${esc(vm.clientName)}</p>
        ${clientLines}
      </div>
    </div>

    ${paymentsBlock}

    <table class="charges">
      <thead>
        <tr>
          <th>Désignation</th>
          <th class="amount">Montant €</th>
        </tr>
      </thead>
      <tbody>${chargeRows}</tbody>
    </table>

    <div class="totals">
      <p class="total-line">Total : ${esc(vm.total)}</p>
      <p>Dont TVA : ${esc(vm.vatAmount)}</p>
    </div>

    <div class="refunds-box">
      <h2>Remboursements</h2>
      <table class="refunds-table">
        <tbody>
          ${refundRows}
          <tr class="total">
            <td>Total remboursé</td>
            <td class="amount">${esc(vm.totalRefunded)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}
