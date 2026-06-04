import { buildContractDocumentChecklist, type ContractDocumentChecklistItem } from '@bleu-calanque/shared';
import { parseContractDocumentValidations } from './rental-contract-field-resolvers';

export type { ContractDocumentChecklistItem };

type MemberDocs = {
  cniFrontUrl: string | null;
  cniBackUrl: string | null;
  boatLicenseFrontUrl: string | null;
  boatLicenseBackUrl: string | null;
  airbusBadgePhotoUrl: string | null;
} | null;

function memberDocumentEvidence(member: MemberDocs) {
  const has = (url: string | null | undefined) => Boolean(url?.trim());
  return {
    memberHasCompleteIdFiles: Boolean(member && has(member.cniFrontUrl) && has(member.cniBackUrl)),
    memberHasCompleteLicenseFiles: Boolean(
      member && has(member.boatLicenseFrontUrl) && has(member.boatLicenseBackUrl),
    ),
    memberHasAirbusBadgePhoto: Boolean(member && has(member.airbusBadgePhotoUrl)),
  };
}

export function resolveContractDocumentChecklist(input: {
  requiredLabels: string[];
  detailsJson: string | null;
  member: MemberDocs;
}): ContractDocumentChecklistItem[] {
  const validations = parseContractDocumentValidations(input.detailsJson);
  return buildContractDocumentChecklist({
    requiredLabels: input.requiredLabels,
    adminValidations: validations,
    ...memberDocumentEvidence(input.member),
  });
}
