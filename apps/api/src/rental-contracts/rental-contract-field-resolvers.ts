import { boatLicenseTypeLabel, filterContractRequiredDocuments, normalizeBoatLicenseType } from '@bleu-calanque/shared';

/** Équipements de sécurité (groupe « Sécurité » fiche bateau). */
const SECURITE_LABELS: Record<string, string> = {
  securite_pompe_cale: 'Pompe de cale',
  securite_vhf: 'VHF',
  securite_filet: 'Filet de sécurité',
  securite_harnais: 'Harnais de sécurité',
};

/** Libellés armement (équipements bateau, groupe « Armement »). */
const ARMEMENT_LABELS: Record<string, string> = {
  armement_basique: 'Basique',
  armement_fluvial: 'Fluvial',
  armement_hauturier: 'Hauturier',
  armement_semi_hauturier: 'Semi-hauturier',
  armement_cotier: 'Côtier',
};

export type ParsedBoatDetails = {
  registrationNumber: string | null;
  registrationNormalized: string | null;
  constructionYear: string | null;
  renovationYear: string | null;
  armementLabel: string | null;
  authorizedNavigationZone: string | null;
  safetyEquipmentLabel: string | null;
  insuranceCompany: string | null;
  insurancePolicyNumber: string | null;
  assuranceSummary: string;
};

export type ReservationContractFields = {
  clientIdType: string | null;
  clientIdNumber: string | null;
  licenseType: string | null;
  licenseNumber: string | null;
  licenseCountry: string | null;
  licenseYear: string | null;
};

export type PassengerContractSummary = {
  passengerCount: number | null;
  hasChildren: boolean;
  childrenCount: number | null;
  label: string;
};

const NOT_SET = 'Non renseigné';

export function contractDisplayOrNotSet(value: string | null | undefined): string {
  const t = (value ?? '').trim();
  return t && t !== '—' ? t : NOT_SET;
}

/** Affichage contractuel de l’immatriculation (majuscules, espaces normalisés). */
export function normalizeRegistrationNumber(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  const compact = t.toUpperCase().replace(/\s+/g, '');
  const frPleasure = compact.match(/^([A-Z]{1,3})-?(\d{4,})([A-Z0-9]*)$/);
  if (frPleasure) {
    const suffix = frPleasure[3] ? `-${frPleasure[3]}` : '';
    return `${frPleasure[1]}-${frPleasure[2]}${suffix}`;
  }
  return t.toUpperCase().replace(/\s{2,}/g, ' ');
}

function selectedEquipmentLabels(
  selected: Record<string, boolean>,
  labels: Record<string, string>,
  prefix: string,
): string | null {
  const items = Object.keys(selected)
    .filter((k) => k.startsWith(prefix) && selected[k])
    .map((k) => labels[k] ?? k.replace(new RegExp(`^${prefix}`), '').replaceAll('_', ' '))
    .filter(Boolean);
  return items.length > 0 ? items.join(', ') : null;
}

export function parseBoatDetailsJson(json: string | null): ParsedBoatDetails | null {
  if (!json?.trim()) return null;
  try {
    const raw = JSON.parse(json) as {
      generales?: {
        registrationNumber?: string;
        constructionYear?: string;
        renovationYear?: string;
        authorizedNavigationZone?: string;
      };
      equipements?: { selected?: Record<string, boolean> };
      assurance?: {
        assureurActuel?: string;
        numeroContrat?: string;
        montantFranchise?: string;
        valeurAssuree?: string;
        locationCouverte?: boolean;
        numero?: string;
        organisme?: string;
        dateFin?: string;
      };
      legalite?: {
        assurance?: {
          organisme?: string;
          numero?: string;
          montantFranchise?: string;
          valeurAssuree?: string;
          locationCouverte?: boolean;
          dateFin?: string;
        };
      };
    };
    const selected = raw.equipements?.selected ?? {};
    let armementLabel: string | null = null;
    for (const [id, label] of Object.entries(ARMEMENT_LABELS)) {
      if (selected[id]) {
        armementLabel = label;
        break;
      }
    }
    if (!armementLabel) {
      const keys = Object.keys(selected).filter((k) => k.startsWith('armement_') && selected[k]);
      if (keys.length > 0) {
        armementLabel = keys.map((k) => ARMEMENT_LABELS[k] ?? k.replace(/^armement_/, '')).join(', ');
      }
    }

    const registrationRaw = raw.generales?.registrationNumber?.trim() || null;
    const navZone =
      raw.generales?.authorizedNavigationZone?.trim() ||
      armementLabel ||
      null;

    return {
      registrationNumber: registrationRaw,
      registrationNormalized: normalizeRegistrationNumber(registrationRaw),
      constructionYear: raw.generales?.constructionYear?.trim() || null,
      renovationYear: raw.generales?.renovationYear?.trim() || null,
      armementLabel,
      authorizedNavigationZone: navZone,
      safetyEquipmentLabel: selectedEquipmentLabels(selected, SECURITE_LABELS, 'securite_'),
      insuranceCompany:
        raw.legalite?.assurance?.organisme?.trim() ||
        raw.assurance?.assureurActuel?.trim() ||
        raw.assurance?.organisme?.trim() ||
        null,
      insurancePolicyNumber:
        raw.legalite?.assurance?.numero?.trim() ||
        raw.assurance?.numeroContrat?.trim() ||
        raw.assurance?.numero?.trim() ||
        null,
      assuranceSummary: formatBoatInsurance(
        raw.legalite?.assurance
          ? {
              assureurActuel: raw.legalite.assurance.organisme,
              numeroContrat: raw.legalite.assurance.numero,
              montantFranchise: raw.legalite.assurance.montantFranchise,
              valeurAssuree: raw.legalite.assurance.valeurAssuree,
              locationCouverte: raw.legalite.assurance.locationCouverte,
            }
          : (raw.assurance ?? {}),
      ),
    };
  } catch {
    return null;
  }
}

export function formatBoatInsurance(assurance: {
  assureurActuel?: string;
  numeroContrat?: string;
  montantFranchise?: string;
  valeurAssuree?: string;
  locationCouverte?: boolean;
}): string {
  const parts: string[] = [];
  if (assurance.locationCouverte) {
    parts.push('Location couverte (police du propriétaire)');
  }
  const insurer = assurance.assureurActuel?.trim();
  const policy = assurance.numeroContrat?.trim();
  const franchise = assurance.montantFranchise?.trim();
  const value = assurance.valeurAssuree?.trim();
  if (insurer) parts.push(`Assureur : ${insurer}`);
  if (policy) parts.push(`N° contrat : ${policy}`);
  if (franchise) parts.push(`Franchise : ${franchise}`);
  if (value) parts.push(`Valeur assurée : ${value}`);
  if (parts.length === 0) return NOT_SET;
  return parts.join(' · ');
}

export function parseContractDocumentValidations(
  detailsJson: string | null,
): Record<string, { validatedAt: string }> {
  if (!detailsJson?.trim()) return {};
  try {
    const d = JSON.parse(detailsJson) as Record<string, unknown>;
    const raw = d.contractDocumentValidations;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, { validatedAt: string }> = {};
    for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
      if (!key.trim()) continue;
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const at = (val as { validatedAt?: string }).validatedAt;
        if (typeof at === 'string' && at.trim()) {
          out[key.trim()] = { validatedAt: at.trim() };
        }
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function parseReservationContractFields(detailsJson: string | null): ReservationContractFields {
  if (!detailsJson?.trim()) {
    return {
      clientIdType: null,
      clientIdNumber: null,
      licenseType: null,
      licenseNumber: null,
      licenseCountry: null,
      licenseYear: null,
    };
  }
  try {
    const d = JSON.parse(detailsJson) as Record<string, unknown>;
    const str = (k: string) => {
      const v = d[k];
      return typeof v === 'string' && v.trim() ? v.trim() : null;
    };
    return {
      clientIdType: str('clientIdType'),
      clientIdNumber: str('clientIdNumber'),
      licenseType: str('licenseType'),
      licenseNumber: str('licenseNumber'),
      licenseCountry: str('licenseCountry'),
      licenseYear: str('licenseYear'),
    };
  } catch {
    return {
      clientIdType: null,
      clientIdNumber: null,
      licenseType: null,
      licenseNumber: null,
      licenseCountry: null,
      licenseYear: null,
    };
  }
}

export function resolveIdentityForContract(
  fields: ReservationContractFields,
  member: {
    cniFrontUrl: string | null;
    cniBackUrl: string | null;
    clientIdType?: string | null;
    clientIdNumber?: string | null;
  } | null,
): { idType: string; idNumber: string } {
  const type = fields.clientIdType?.trim() || member?.clientIdType?.trim() || "Carte d'identité";
  const num = fields.clientIdNumber?.trim() || member?.clientIdNumber?.trim();
  if (num) return { idType: type, idNumber: num };
  const hasFile = Boolean(member?.cniFrontUrl?.trim() || member?.cniBackUrl?.trim());
  if (hasFile) {
    return { idType: type, idNumber: 'Document enregistré (numéro non renseigné)' };
  }
  return { idType: type, idNumber: NOT_SET };
}

export function resolveLicenseForContract(
  fields: ReservationContractFields,
  member: {
    boatLicenseFrontUrl: string | null;
    boatLicenseBackUrl: string | null;
    licenseType?: string | null;
    licenseNumber?: string | null;
    licenseCountry?: string | null;
  } | null,
  defaultCountry: string | null,
): { licenseType: string; licenseNumber: string; licenseCountry: string } {
  const type = fields.licenseType?.trim() || member?.licenseType?.trim() || '';
  const num = fields.licenseNumber?.trim() || member?.licenseNumber?.trim() || '';
  const country =
    fields.licenseCountry?.trim() || member?.licenseCountry?.trim() || defaultCountry?.trim() || 'France';
  const hasFile = Boolean(member?.boatLicenseFrontUrl?.trim() || member?.boatLicenseBackUrl?.trim());

  const normalizedType = normalizeBoatLicenseType(type);
  let licenseType = normalizedType
    ? boatLicenseTypeLabel(normalizedType)
    : boatLicenseTypeLabel(type) || type || (hasFile ? 'Permis bateau' : '');
  let licenseNumber = num;
  if (!licenseNumber && hasFile) {
    licenseNumber = 'Document enregistré (numéro non renseigné)';
  }
  if (!licenseType && !licenseNumber) {
    return {
      licenseType: NOT_SET,
      licenseNumber: NOT_SET,
      licenseCountry: country || NOT_SET,
    };
  }
  return {
    licenseType: contractDisplayOrNotSet(licenseType || null),
    licenseNumber: contractDisplayOrNotSet(licenseNumber || null),
    licenseCountry: contractDisplayOrNotSet(country || null),
  };
}

export function buildPassengerSummary(input: {
  passengerCount: number | null | undefined;
  hasChildren: boolean | null | undefined;
  childrenCount: number | null | undefined;
}): PassengerContractSummary {
  const count =
    input.passengerCount != null && Number.isFinite(input.passengerCount) && input.passengerCount > 0
      ? input.passengerCount
      : null;
  const hasChildren = Boolean(input.hasChildren);
  const children =
    hasChildren && input.childrenCount != null && input.childrenCount >= 0 ? input.childrenCount : null;

  let label = NOT_SET;
  if (count != null) {
    label = `${count} passager${count > 1 ? 's' : ''}`;
    if (hasChildren && children != null && children > 0) {
      label += ` dont ${children} enfant${children > 1 ? 's' : ''}`;
    } else if (hasChildren) {
      label += ' (avec enfants)';
    }
  }

  return {
    passengerCount: count,
    hasChildren,
    childrenCount: children,
    label,
  };
}

export function parseRequiredDocuments(json: string | null | undefined): string[] {
  if (!json?.trim()) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return filterContractRequiredDocuments(parsed.map((x) => String(x)));
  } catch {
    return [];
  }
}
