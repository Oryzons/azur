import { normalizeBoatLicenseType } from '@bleu-calanque/shared';
import type { ReservationWizardDetails } from '@/pages/calendar/reservationWizardTypes';
import type { MemberClient } from '@/stores/members';

export type MemberContractFieldPatch = Pick<
  ReservationWizardDetails,
  'clientIdType' | 'clientIdNumber' | 'licenseType' | 'licenseNumber' | 'licenseCountry' | 'licenseYear'
>;

/** Champs contrat PDF enregistrés sur la fiche client, réutilisables à la prochaine réservation. */
export function contractFieldsFromMember(member: MemberClient): MemberContractFieldPatch {
  const licenseType = normalizeBoatLicenseType(member.licenseType) ?? '';
  return {
    clientIdType: member.clientIdType?.trim() || "Carte d'identité",
    clientIdNumber: member.clientIdNumber?.trim() || '',
    licenseType,
    licenseNumber: member.licenseNumber?.trim() || '',
    licenseCountry: member.licenseCountry?.trim() || member.country?.trim() || 'France',
    licenseYear: member.licenseYear?.trim() || '',
  };
}

export function mergeContractFieldsFromMember(
  details: ReservationWizardDetails,
  member: MemberClient,
): ReservationWizardDetails {
  const fromMember = contractFieldsFromMember(member);
  return {
    ...details,
    clientIdType: details.clientIdType?.trim() ? details.clientIdType : fromMember.clientIdType,
    clientIdNumber: details.clientIdNumber?.trim() ? details.clientIdNumber : fromMember.clientIdNumber,
    licenseType: details.licenseType?.trim() ? details.licenseType : fromMember.licenseType,
    licenseNumber: details.licenseNumber?.trim() ? details.licenseNumber : fromMember.licenseNumber,
    licenseCountry: details.licenseCountry?.trim() ? details.licenseCountry : fromMember.licenseCountry,
    licenseYear: details.licenseYear?.trim() ? details.licenseYear : fromMember.licenseYear,
  };
}
