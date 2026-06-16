import {
  DEFAULT_BRAND_NAME,
  DEFAULT_COMPANY_ADDRESS_LINE,
  DEFAULT_COMPANY_CITY,
  DEFAULT_COMPANY_POSTAL_CODE,
} from '@bleu-calanque/shared';
import type { RentalContractViewModel } from './rental-contract-html';
import { DEFAULT_CONTRACT_REQUIRED_DOCUMENTS } from './rental-contract-default-terms';
import {
  type ContractDocumentChecklistItem,
  resolveRentalLocations,
} from '@bleu-calanque/shared';

type CompanyRow = {
  brandName: string;
  legalName: string;
  siret: string;
  contactPhone: string;
  addressLine: string;
  postalCode: string;
  city: string;
  country: string;
  contractOperatorSignatureDataUrl?: string | null;
  departureLocation?: string | null;
  arrivalLocation?: string | null;
};

type TemplateRow = {
  title: string;
  rentalTerms: string;
  cancellationTerms: string;
  requiredDocuments?: string[];
};

/** Données fictives pour l’aperçu d’un modèle de contrat (Paramètres → Contrats). */
export function buildMockPreviewViewModel(
  company: CompanyRow | null,
  template: TemplateRow,
): RentalContractViewModel {
  const brand = company?.brandName ?? DEFAULT_BRAND_NAME;
  const legal = company?.legalName ?? brand;
  const { departure: departurePlace, arrival: arrivalPlace } = resolveRentalLocations({ company });
  const startAt = '01/07/2026 09:00';
  const endAt = '01/07/2026 18:00';
  const title = template.title.trim() || 'Contrat de location';
  const requiredDocuments =
    template.requiredDocuments && template.requiredDocuments.length > 0
      ? template.requiredDocuments
      : [...DEFAULT_CONTRACT_REQUIRED_DOCUMENTS];

  const documentChecklist: ContractDocumentChecklistItem[] = requiredDocuments.map((label, i) => ({
    label,
    status: i < 2 ? 'provided' : 'missing',
    source: i < 2 ? 'form' : undefined,
    detail: i === 0 ? 'Exemple aperçu' : i === 1 ? 'Exemple aperçu' : undefined,
  }));

  return {
    contractNumber: 0,
    company: {
      brandName: brand,
      legalName: legal,
      siret: company?.siret ?? '000 000 000 00000',
      contactPhone: company?.contactPhone ?? '04 00 00 00 00',
      addressLine: company?.addressLine ?? DEFAULT_COMPANY_ADDRESS_LINE,
      postalCode: company?.postalCode ?? DEFAULT_COMPANY_POSTAL_CODE,
      city: company?.city ?? DEFAULT_COMPANY_CITY,
      country: company?.country ?? 'FRANCE',
    },
    template: {
      title,
      rentalTerms: template.rentalTerms,
      cancellationTerms: template.cancellationTerms,
      requiredDocuments,
    },
    documentTitle: title,
    introLegalName: legal,
    locataire: {
      name: 'M. Jean DUPONT',
      address: '12 rue de la Mer, 13007 Marseille, France',
      birthDate: '15/03/1985',
      phone: '06 12 34 56 78',
      email: 'jean.dupont@exemple.fr',
      idType: "Carte d'identité",
      idNumber: '12AB34567',
    },
    conducteur: {
      name: 'M. Jean DUPONT',
      licenseType: 'Permis côtier',
      licenseNumber: 'FR-123456789',
      licenseCountry: 'France',
      licenseYear: '2018',
    },
    bateau: {
      name: 'Calanque Explorer',
      registration: 'FR-1234567',
      maxPassengers: 8,
      yearBuilt: '2019',
      renovationYear: '2022',
      armement: 'Côtier',
      authorizedNavigationZone: 'Navigation côtière — bande des 6 milles',
      safetyEquipment: 'VHF, Pompe de cale, Filet de sécurité',
      brandModel: 'Jeanneau Cap Camarat 7.5',
      deposit: '1 500,00 €',
      depositMode: 'Empreinte carte (en ligne)',
      ownerName: 'Pierre MARTIN',
      insuranceCompany: 'Exemple Assurances',
      insurancePolicyNumber: 'POL-2026-001',
      insurance: 'Location couverte (police du propriétaire) · Assureur : Exemple Assurances · N° contrat : POL-2026-001',
    },
    documentChecklist,
    location: {
      departurePlace,
      arrivalPlace,
      startAt,
      endAt,
      start: `${startAt} — ${departurePlace}`,
      end: `${endAt} — ${arrivalPlace}`,
      type: 'Bateau seul',
      priceWithoutExtras: '450,00 €',
      comment: '',
      passengers: '4 passagers dont 1 enfant',
    },
    pricingLines: [
      {
        description: 'Location Calanque Explorer',
        ht: '375,00 €',
        vatPct: '20 %',
        vat: '75,00 €',
        ttc: '450,00 €',
      },
      {
        description: 'Pack nettoyage',
        ht: '41,67 €',
        vatPct: '20 %',
        vat: '8,33 €',
        ttc: '50,00 €',
      },
    ],
    pricingTotal: {
      description: 'Total TTC après remises',
      ht: '416,67 €',
      vatPct: '',
      vat: '83,33 €',
      ttc: '500,00 €',
    },
    payments: [{ date: '—', method: '—', amount: '—' }],
    paymentObligations: [
      { label: 'Paiement', methodLabel: 'Carte bancaire (en ligne)', amount: '500,00 €', paid: false },
    ],
    balanceDue: '500,00 €',
    clientSignatureImg: null,
    operatorSignatureImg: company?.contractOperatorSignatureDataUrl ?? null,
    signedAtLabel: null,
    operatorSignedAtLabel: null,
  };
}
