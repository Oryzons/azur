import { resolveCgvSections, type CgvSection } from './rental-contract-default-terms';
import type { ContractDocumentChecklistItem } from '@bleu-calanque/shared';

type Company = {
  brandName: string;
  legalName: string;
  siret: string;
  contactPhone: string;
  addressLine: string;
  postalCode: string;
  city: string;
  country: string;
};

type ContractTemplate = {
  title: string;
  rentalTerms: string;
  cancellationTerms: string;
  requiredDocuments: string[];
};

type PricingLine = {
  description: string;
  ht: string;
  vatPct: string;
  vat: string;
  ttc: string;
};

type PaymentLine = {
  date: string;
  method: string;
  amount: string;
};

export type RentalContractViewModel = {
  contractNumber: number;
  company: Company;
  template: ContractTemplate;
  /** Titre affiché en tête du document (modèle contractuel). */
  documentTitle: string;
  introLegalName: string;
  locataire: {
    name: string;
    address: string;
    birthDate: string;
    phone: string;
    email: string;
    idNumber: string;
    idType: string;
  };
  conducteur: {
    name: string;
    licenseType: string;
    licenseNumber: string;
    licenseCountry: string;
    licenseYear: string;
  };
  bateau: {
    name: string;
    registration: string;
    maxPassengers: number;
    yearBuilt: string;
    renovationYear: string;
    armement: string;
    authorizedNavigationZone: string;
    safetyEquipment: string;
    brandModel: string;
    deposit: string;
    depositMode: string;
    ownerName: string;
    insuranceCompany: string;
    insurancePolicyNumber: string;
    insurance: string;
  };
  documentChecklist: ContractDocumentChecklistItem[];
  location: {
    departurePlace: string;
    arrivalPlace: string;
    startAt: string;
    endAt: string;
    /** Date/heure + lieu (emails, résumé client). */
    start: string;
    end: string;
    type: string;
    priceWithoutExtras: string;
    comment: string;
    passengers: string;
  };
  pricingLines: PricingLine[];
  pricingTotal: PricingLine;
  payments: PaymentLine[];
  paymentObligations: { label: string; methodLabel: string; amount: string; paid: boolean }[];
  balanceDue: string;
  clientSignatureImg?: string | null;
  operatorSignatureImg?: string | null;
  signedAtLabel?: string | null;
  operatorSignedAtLabel?: string | null;
};

export type RentalContractRenderOptions = {
  /** Filigrane + bandeau — document sans valeur contractuelle. */
  draft?: boolean;
};

const BRAND = '#416B9F';

function esc(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function nl2br(s: string) {
  return esc(s).replaceAll('\n', '<br/>');
}

function renderCgvSections(sections: CgvSection[]): string {
  return sections
    .map((sec) => {
      const blocks = sec.blocks
        .map((b) => {
          if (b.type === 'ul') {
            const items = (Array.isArray(b.content) ? b.content : [b.content])
              .map((li) => `<li>${nl2br(li)}</li>`)
              .join('');
            return `<ul class="cgv-list">${items}</ul>`;
          }
          return `<p>${nl2br(b.content as string)}</p>`;
        })
        .join('');
      return `<section class="cgv-section"><h3>${esc(sec.title)}</h3>${blocks}</section>`;
    })
    .join('');
}

function signatureRow(vm: RentalContractViewModel) {
  return `<div class="signatures signatures--compact">
    <div class="sig-row">
      ${sigBlock(vm.clientSignatureImg, 'Signature du locataire', vm.signedAtLabel)}
      ${sigBlock(vm.operatorSignatureImg, "Signature de l'exploitant", vm.operatorSignedAtLabel)}
    </div>
  </div>`;
}

function val(s: string) {
  const t = s.trim();
  return t && t !== '—' ? esc(t) : '<span class="empty">—</span>';
}

function buildIntroParagraph(vm: RentalContractViewModel): string {
  const locataire = vm.locataire.name.trim();
  const proprietaire = vm.bateau.ownerName.trim();
  const representant = esc(vm.introLegalName);
  const hasOwner = proprietaire.length > 0 && proprietaire !== '—';
  const loc = locataire && locataire !== '—' ? esc(locataire) : '—';

  if (hasOwner) {
    return `Un contrat est conclu entre le locataire (<strong>${loc}</strong>) et le propriétaire (<strong>${esc(proprietaire)}</strong>), représenté par <strong>${representant}</strong>.`;
  }

  return `Un contrat est conclu entre le locataire (<strong>${loc}</strong>) et <strong>${representant}</strong>.`;
}

function fieldCell(label: string, value: string, span = 1) {
  const spanAttr = span > 1 ? ` style="grid-column:span ${span};"` : '';
  return `<div class="field"${spanAttr}>
    <div class="field-label">${esc(label)}</div>
    <div class="field-value">${val(value)}</div>
  </div>`;
}

function section(title: string, fields: string) {
  return `<section class="block">
    <h2 class="block-title">${esc(title)}</h2>
    <div class="field-grid">${fields}</div>
  </section>`;
}

function moneyTable(
  headers: { label: string; align: 'left' | 'right' | 'center' }[],
  rows: string[][],
  footerRow?: string[],
) {
  const ths = headers
    .map((h) => `<th class="align-${h.align}">${esc(h.label)}</th>`)
    .join('');
  const trs = rows
    .map((cells) => {
      const tds = cells
        .map((cell, i) => {
          const align = headers[i]?.align ?? 'left';
          return `<td class="align-${align}">${cell}</td>`;
        })
        .join('');
      return `<tr>${tds}</tr>`;
    })
    .join('');
  const foot = footerRow
    ? `<tfoot><tr class="total-row">${footerRow
        .map((cell, i) => {
          const align = headers[i]?.align ?? 'left';
          return `<td class="align-${align}">${cell}</td>`;
        })
        .join('')}</tr></tfoot>`
    : '';
  return `<table class="data-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody>${foot}</table>`;
}

function sigBlock(img: string | null | undefined, label: string, signedAt?: string | null) {
  const inner = img
    ? `<img src="${esc(img)}" alt="" class="sig-img"/>`
    : '';
  const signedLine = signedAt
    ? `<p class="sig-date">Signé le ${esc(signedAt)}</p>`
    : '<p class="sig-date sig-date--empty">&nbsp;</p>';
  return `<div class="sig-col">
    <p class="sig-label">${esc(label)}</p>
    <div class="sig-box">${inner}</div>
    ${signedLine}
  </div>`;
}

function contractHeader(c: Company, compact = false) {
  const compactClass = compact ? ' doc-header--compact' : '';
  return `<header class="doc-header${compactClass}">
    <div class="doc-brand">${esc(c.brandName)}</div>
    <div class="doc-meta">
      <strong>${esc(c.brandName)}</strong><br/>
      N° SIRET ${esc(c.siret)} · ${esc(c.contactPhone)}<br/>
      ${esc(c.addressLine)}, ${esc(c.postalCode)} ${esc(c.city)}, ${esc(c.country)}
    </div>
  </header>`;
}

function contractFooter(contractNumber: number, page: number, totalPages: number, draft?: boolean) {
  const center = page === 1 ? 'Urgence : Contacter le CROSS au canal 16 sur la radio VHF ou appeler le 196' : '';
  const numLabel = draft
    ? 'Aperçu brouillon'
    : `Contrat n°${contractNumber}${page === 1 ? ' (à conserver 1 an)' : ''}`;
  const draftSuffix = draft ? ' — sans valeur contractuelle' : '';
  return `<footer class="doc-footer">
    <span>${numLabel}${draftSuffix}</span>
    <span class="doc-footer-center">${center}</span>
    <span>Page ${page} / ${totalPages}</span>
  </footer>`;
}

function draftBanner() {
  return `<div class="draft-banner" role="note">APERÇU — BROUILLON · non signé · sans valeur contractuelle</div>`;
}

function documentChecklistBlock(items: ContractDocumentChecklistItem[]): string {
  if (items.length === 0) return '';
  const rows = items
    .map((item) => {
      const provided = item.status === 'provided';
      const statusLabel = provided ? 'Fourni' : 'Manquant';
      const statusClass = provided ? 'doc-status--ok' : 'doc-status--missing';
      const detail = item.detail ? `<span class="doc-detail">${esc(item.detail)}</span>` : '';
      return `<tr>
        <td>${esc(item.label)}</td>
        <td class="${statusClass}"><strong>${statusLabel}</strong>${detail}</td>
      </tr>`;
    })
    .join('');
  return `<div class="required-docs">
    <p class="required-docs-title">Justificatifs client</p>
    <table class="doc-checklist">
      <thead><tr><th>Document</th><th>Statut</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

const CONTRACT_PAGE_COUNT = 3;

const PAGE_STYLE = `
  @page { size: A4; margin: 9mm 11mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    font-size: 9.5px;
    color: #1e293b;
    line-height: 1.38;
    margin: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { padding: 0; }
  .page-break { page-break-before: always; padding-top: 2px; }

  .doc-header {
    display: table;
    width: 100%;
    margin-bottom: 10px;
    padding-bottom: 7px;
    border-bottom: 2px solid ${BRAND};
  }
  .doc-header--compact {
    margin-bottom: 7px;
    padding-bottom: 5px;
    border-bottom-width: 1px;
  }
  .doc-brand {
    display: table-cell;
    vertical-align: middle;
    font-size: 18px;
    font-weight: 700;
    color: ${BRAND};
    letter-spacing: -0.02em;
  }
  .doc-header--compact .doc-brand { font-size: 14px; }
  .doc-meta {
    display: table-cell;
    vertical-align: middle;
    text-align: right;
    font-size: 8px;
    color: #475569;
    line-height: 1.4;
  }
  .doc-header--compact .doc-meta { font-size: 7.5px; }

  .intro {
    margin: 0 0 9px;
    padding: 7px 9px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    font-size: 9.5px;
    line-height: 1.45;
  }
  .intro strong { color: #0f172a; }

  .block { margin-bottom: 8px; }
  .block-title {
    margin: 0 0 5px;
    padding: 0 0 3px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: ${BRAND};
    border-bottom: 1px solid #cbd5e1;
  }

  .field-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 14px;
  }
  .field-label {
    font-size: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #64748b;
    margin-bottom: 0;
  }
  .field-value {
    font-size: 9.5px;
    font-weight: 600;
    color: #0f172a;
    word-break: break-word;
  }
  .empty { color: #94a3b8; font-weight: 400; }

  .comment-box {
    margin-top: 4px;
    padding: 5px 7px;
    background: #fafafa;
    border: 1px dashed #e2e8f0;
    border-radius: 4px;
    font-size: 9px;
    color: #475569;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 2px;
    font-size: 9px;
  }
  .data-table thead tr {
    background: #eef4fa;
    border-bottom: 1px solid #94a3b8;
  }
  .data-table th {
    padding: 4px 6px;
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #334155;
  }
  .data-table td {
    padding: 3px 6px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: middle;
  }
  .data-table tbody tr:last-child td { border-bottom: none; }
  .data-table tfoot .total-row td {
    padding: 5px 6px;
    font-weight: 700;
    font-size: 9.5px;
    background: #f1f5f9;
    border-top: 2px solid #334155;
    border-bottom: none;
  }
  .align-left { text-align: left; }
  .align-right { text-align: right; }
  .align-center { text-align: center; }

  .signatures {
    display: table;
    width: 100%;
    margin-top: 10px;
    page-break-inside: avoid;
  }
  .sig-row { display: table-row; }
  .sig-col {
    display: table-cell;
    width: 50%;
    vertical-align: top;
    padding-right: 10px;
  }
  .sig-col:last-child { padding-right: 0; padding-left: 10px; }
  .sig-label {
    margin: 0 0 4px;
    font-size: 9px;
    font-weight: 700;
    color: #334155;
  }
  .sig-box {
    height: 62px;
    border: 1px solid #94a3b8;
    border-radius: 4px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5px;
    overflow: hidden;
  }
  .sig-img { max-height: 52px; max-width: 100%; object-fit: contain; }
  .sig-date {
    margin: 4px 0 0;
    font-size: 8px;
    color: #64748b;
    min-height: 10px;
  }
  .sig-date--empty { visibility: hidden; }

  .doc-footer {
    display: table;
    width: 100%;
    margin-top: 10px;
    padding-top: 6px;
    border-top: 1px solid #cbd5e1;
    font-size: 8px;
    color: #64748b;
  }
  .doc-footer span { display: table-cell; vertical-align: middle; }
  .doc-footer span:last-child { text-align: right; }
  .doc-footer-center { text-align: center; padding: 0 6px; }

  .cgv-title {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 700;
    color: #0f172a;
    text-decoration: underline;
  }
  .cgv-body {
    font-size: 8.25px;
    line-height: 1.32;
    color: #334155;
    column-count: 2;
    column-gap: 12px;
  }
  .cgv-body h3 {
    margin: 10px 0 4px;
    font-size: 9px;
    font-weight: 700;
    color: ${BRAND};
  }
  .cgv-body h3:first-child { margin-top: 0; }
  .cgv-section {
    margin-bottom: 6px;
    break-inside: avoid-column;
    page-break-inside: avoid;
  }
  .cgv-section h3 {
    margin: 0 0 3px;
    font-size: 8.5px;
    font-weight: 700;
    color: ${BRAND};
  }
  .cgv-section p { margin: 0 0 4px; text-align: justify; }
  .cgv-list {
    margin: 2px 0 4px 14px;
    padding: 0;
  }
  .cgv-list li { margin-bottom: 2px; }
  .signatures--compact { margin-top: 8px; }
  .signatures--compact .sig-box { height: 56px; }

  .contract-doc-title {
    margin: 0 0 7px;
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    text-align: center;
    line-height: 1.35;
  }
  .required-docs {
    margin-bottom: 8px;
    padding: 6px 8px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    font-size: 9px;
  }
  .required-docs-title {
    margin: 0 0 4px;
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
  }
  .required-docs ul {
    margin: 0;
    padding-left: 16px;
  }
  .required-docs li { margin-bottom: 1px; color: #334155; }
  .doc-checklist {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
  }
  .doc-checklist th,
  .doc-checklist td {
    border: 1px solid #e2e8f0;
    padding: 3px 6px;
    text-align: left;
    vertical-align: top;
  }
  .doc-checklist th {
    background: #f1f5f9;
    font-weight: 700;
    color: #475569;
  }
  .doc-status--ok { color: #047857; }
  .doc-status--missing { color: #b45309; }
  .doc-detail {
    display: block;
    margin-top: 1px;
    font-size: 8px;
    font-weight: 400;
    color: #64748b;
  }

  body.draft { position: relative; }
  .draft-banner {
    margin: 0 0 8px;
    padding: 6px 10px;
    background: #fffbeb;
    border: 1px solid #f59e0b;
    border-radius: 4px;
    text-align: center;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #92400e;
  }
  body.draft::before {
    content: 'BROUILLON';
    position: fixed;
    top: 42%;
    left: 50%;
    z-index: 0;
    transform: translate(-50%, -50%) rotate(-32deg);
    font-size: 64px;
    font-weight: 800;
    color: rgba(245, 158, 11, 0.12);
    letter-spacing: 0.2em;
    pointer-events: none;
    white-space: nowrap;
  }
  body.draft .page { position: relative; z-index: 1; }
`;

function paymentDateForObligation(
  vm: RentalContractViewModel,
  obligation: RentalContractViewModel['paymentObligations'][number],
  obligationIndex: number,
): string {
  if (!obligation.paid) return '—';
  if (obligation.label === 'Avoir client') {
    return vm.payments.find((p) => p.method === 'Avoir client')?.date ?? '—';
  }
  const cardPayments = vm.payments.filter((p) => p.method !== 'Avoir client');
  const cardObligations = vm.paymentObligations.filter((o) => o.label !== 'Avoir client');
  const cardIdx = cardObligations.indexOf(obligation);
  if (cardIdx >= 0 && cardPayments[cardIdx]) return cardPayments[cardIdx].date;
  return vm.payments[obligationIndex]?.date ?? '—';
}

function paymentMethodLabelForObligation(
  obligation: RentalContractViewModel['paymentObligations'][number],
): string {
  if (obligation.label === 'Paiement') return obligation.methodLabel;
  return `${obligation.label} — ${obligation.methodLabel}`;
}

function buildContractPaymentRows(vm: RentalContractViewModel): string[][] {
  if (vm.paymentObligations.length > 0) {
    return vm.paymentObligations.map((obligation, index) => {
      const date = paymentDateForObligation(vm, obligation, index);
      const method = paymentMethodLabelForObligation(obligation);
      const amount = obligation.paid
        ? `<strong>${esc(obligation.amount)}</strong>`
        : `${esc(obligation.amount)} <span class="empty">(à régler)</span>`;
      return [esc(date), esc(method), amount];
    });
  }
  if (vm.payments.length > 0) {
    return vm.payments.map((p) => [esc(p.date), esc(p.method), `<strong>${esc(p.amount)}</strong>`]);
  }
  return [['—', '—', '—']];
}

export function buildRentalContractHtml(
  vm: RentalContractViewModel,
  options?: RentalContractRenderOptions,
): string {
  const draft = Boolean(options?.draft);
  const c = vm.company;
  const headerFull = contractHeader(c);
  const headerCompact = contractHeader(c, true);
  const draftBlock = draft ? draftBanner() : '';
  const totalPages = CONTRACT_PAGE_COUNT;

  const pricingBody = vm.pricingLines.map((l) => [
    esc(l.description),
    esc(l.ht),
    esc(l.vatPct),
    esc(l.vat),
    `<strong>${esc(l.ttc)}</strong>`,
  ]);

  const pricingTable = moneyTable(
    [
      { label: 'Description', align: 'left' },
      { label: 'Prix HT', align: 'right' },
      { label: '% TVA', align: 'center' },
      { label: 'TVA', align: 'right' },
      { label: 'Prix TTC', align: 'right' },
    ],
    pricingBody,
    [
      `<strong>${esc(vm.pricingTotal.description)}</strong>`,
      esc(vm.pricingTotal.ht),
      '',
      esc(vm.pricingTotal.vat),
      `<strong>${esc(vm.pricingTotal.ttc)}</strong>`,
    ],
  );

  const paymentBody = buildContractPaymentRows(vm);

  const paymentsTable = moneyTable(
    [
      { label: 'Date', align: 'left' },
      { label: 'Moyen de paiement', align: 'left' },
      { label: 'Montant', align: 'right' },
    ],
    paymentBody,
    ['<strong>Reste à payer</strong>', '', `<strong>${esc(vm.balanceDue)}</strong>`],
  );

  const docTitle = `<h1 class="contract-doc-title">${esc(vm.documentTitle)}</h1>`;
  const requiredDocs = documentChecklistBlock(vm.documentChecklist);

  const locationSection = section(
    'Location',
    [
      fieldCell('Lieu de départ', vm.location.departurePlace, 2),
      fieldCell('Date et heure de départ', vm.location.startAt, 2),
      fieldCell("Lieu d'arrivée (retour)", vm.location.arrivalPlace, 2),
      fieldCell('Date et heure de retour', vm.location.endAt, 2),
      fieldCell('Type de location', vm.location.type),
      fieldCell('Passagers', vm.location.passengers),
      fieldCell('Prix total (sans extras)', vm.location.priceWithoutExtras),
    ].join('') +
      (vm.location.comment.trim()
        ? `<div class="comment-box"><span class="field-label">Commentaire</span><br/>${esc(vm.location.comment)}</div>`
        : ''),
  );

  const page1 = `<div class="page">
    ${headerFull}
    ${draftBlock}
    ${docTitle}
    ${requiredDocs}
    <p class="intro">${buildIntroParagraph(vm)}</p>

    ${section(
      'Locataire',
      [
        fieldCell('Prénom Nom', vm.locataire.name),
        fieldCell('Date de naissance', vm.locataire.birthDate),
        fieldCell('Adresse', vm.locataire.address, 2),
        fieldCell('Téléphone', vm.locataire.phone),
        fieldCell('Email', vm.locataire.email),
        fieldCell("Pièce d'identité", `${vm.locataire.idType} ${vm.locataire.idNumber}`.trim()),
      ].join(''),
    )}

    ${section(
      'Conducteur(s)',
      [
        fieldCell('Prénom Nom (Chef de bord)', vm.conducteur.name, 2),
        fieldCell('Type de permis', vm.conducteur.licenseType),
        fieldCell('N° permis bateau', vm.conducteur.licenseNumber),
        fieldCell("Pays d'obtention", vm.conducteur.licenseCountry),
        fieldCell("Année d'obtention", vm.conducteur.licenseYear),
      ].join(''),
    )}

    ${section(
      'Bateau',
      [
        fieldCell('Nom', vm.bateau.name),
        fieldCell('Immatriculation', vm.bateau.registration),
        fieldCell('Capacité maximum', String(vm.bateau.maxPassengers)),
        fieldCell('Année de construction', vm.bateau.yearBuilt),
        fieldCell('Année de rénovation', vm.bateau.renovationYear),
        fieldCell('Marque & modèle', vm.bateau.brandModel),
        fieldCell('Armement', vm.bateau.armement),
        fieldCell('Zone de navigation autorisée', vm.bateau.authorizedNavigationZone, 2),
        fieldCell('Équipement de sécurité', vm.bateau.safetyEquipment, 2),
        fieldCell('Caution', vm.bateau.deposit),
        fieldCell('Gestion caution', vm.bateau.depositMode),
        fieldCell('Propriétaire(s) du bateau', vm.bateau.ownerName, 2),
        fieldCell('Assurance — compagnie', vm.bateau.insuranceCompany),
        fieldCell('Assurance — n° contrat', vm.bateau.insurancePolicyNumber),
        fieldCell('Assurance (détail)', vm.bateau.insurance, 2),
      ].join(''),
    )}

    ${contractFooter(vm.contractNumber, 1, totalPages, draft)}
  </div>`;

  const page2 = `<div class="page page-break">
    ${headerCompact}
    ${draftBlock}

    ${locationSection}

    <section class="block">
      <h2 class="block-title">Tarif</h2>
      ${pricingTable}
    </section>

    <section class="block">
      <h2 class="block-title">Paiements</h2>
      ${paymentsTable}
    </section>

    ${signatureRow(vm)}

    ${contractFooter(vm.contractNumber, 2, totalPages, draft)}
  </div>`;

  const cgvSections = resolveCgvSections(vm.template, c.brandName || vm.introLegalName);
  const page3 = `<div class="page page-break">
    ${headerCompact}
    ${draftBlock}
    ${docTitle}
    <h1 class="cgv-title">Conditions générales de location</h1>
    <div class="cgv-body">
      ${renderCgvSections(cgvSections)}
    </div>
    ${signatureRow(vm)}
    ${contractFooter(vm.contractNumber, 3, totalPages, draft)}
  </div>`;

  const title = draft ? `Aperçu contrat${vm.contractNumber ? ` ${vm.contractNumber}` : ''}` : `Contrat ${vm.contractNumber}`;
  const bodyClass = draft ? ' class="draft"' : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>${esc(title)}</title>
  <style>${PAGE_STYLE}</style>
</head>
<body${bodyClass}>${page1}${page2}${page3}</body>
</html>`;
}
