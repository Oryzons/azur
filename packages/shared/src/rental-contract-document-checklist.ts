export type ContractDocumentChecklistItem = {
  label: string;
  status: 'provided' | 'missing';
  /** Origine du statut « fourni ». */
  source?: 'form' | 'member_file' | 'admin';
  detail?: string;
};

/** Exclut l’attestation d’assurance (non demandée au client). */
export function filterContractRequiredDocuments(labels: string[]): string[] {
  return labels
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((label) => !/assurance|responsabilit/i.test(label));
}

export type ContractDocumentEvidence = {
  requiredLabels: string[];
  /** Pièce d'identité : recto et verso. */
  memberHasCompleteIdFiles?: boolean;
  /** Permis bateau : recto et verso. */
  memberHasCompleteLicenseFiles?: boolean;
  /** Photo du badge Airbus. */
  memberHasAirbusBadgePhoto?: boolean;
  /** Clé = libellé exact du justificatif (modèle contrat). */
  adminValidations?: Record<string, { validatedAt: string }>;
};

type DocumentKind = 'identity' | 'license' | 'airbus_badge' | 'other';

function classifyDocumentLabel(label: string): DocumentKind {
  const l = label.toLowerCase();
  if (/identit|passeport|\bcni\b|titre de s/.test(l)) return 'identity';
  if (/permis|certificat/.test(l)) return 'license';
  if (/airbus|badge/.test(l)) return 'airbus_badge';
  return 'other';
}

function isProvidedForKind(
  kind: DocumentKind,
  evidence: ContractDocumentEvidence,
): { provided: boolean; source?: ContractDocumentChecklistItem['source']; detail?: string } {
  switch (kind) {
    case 'identity': {
      if (evidence.memberHasCompleteIdFiles) {
        return { provided: true, source: 'member_file', detail: 'Photos recto et verso enregistrées' };
      }
      return { provided: false };
    }
    case 'license': {
      if (evidence.memberHasCompleteLicenseFiles) {
        return { provided: true, source: 'member_file', detail: 'Photos recto et verso enregistrées' };
      }
      return { provided: false };
    }
    case 'airbus_badge': {
      if (evidence.memberHasAirbusBadgePhoto) {
        return { provided: true, source: 'member_file', detail: 'Photo du badge enregistrée' };
      }
      return { provided: false };
    }
    case 'other':
      return { provided: false };
  }
}

/** Construit la checklist justificatifs pour le PDF et l’admin. */
export function buildContractDocumentChecklist(
  evidence: ContractDocumentEvidence,
): ContractDocumentChecklistItem[] {
  const labels = filterContractRequiredDocuments(evidence.requiredLabels);
  if (labels.length === 0) return [];

  const validations = evidence.adminValidations ?? {};

  return labels.map((label) => {
    const admin = validations[label];
    if (admin?.validatedAt) {
      return {
        label,
        status: 'provided',
        source: 'admin',
        detail: `Validé le ${new Date(admin.validatedAt).toLocaleDateString('fr-FR')}`,
      };
    }

    const kind = classifyDocumentLabel(label);
    const auto = isProvidedForKind(kind, evidence);
    return {
      label,
      status: auto.provided ? 'provided' : 'missing',
      source: auto.source,
      detail: auto.detail,
    };
  });
}
