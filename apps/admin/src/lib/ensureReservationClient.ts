import { mergeContractFieldsFromMember } from '@/lib/memberContractFields';
import { birthDateDisplayToIso } from '@/pages/calendar/ReservationWizardSteps';
import type { ReservationWizardDetails } from '@/pages/calendar/reservationWizardTypes';
import { clientDisplayNameFromDetails } from '@/pages/calendar/reservationWizardTypes';
import type { MemberClient } from '@/stores/members';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function findClientByEmail(clients: MemberClient[], email: string) {
  const target = normalizeEmail(email);
  if (!target) return null;
  return clients.find((c) => normalizeEmail(c.email) === target) ?? null;
}

type AddClientMember = (payload: {
  role: 'client';
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  clientType: MemberClient['clientType'];
  civility: MemberClient['civility'];
  birthDate: string | null;
  nationality: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  internalNote: string | null;
  cniFrontUrl: string | null;
  cniBackUrl: string | null;
  boatLicenseFrontUrl: string | null;
  boatLicenseBackUrl: string | null;
}) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;

/** Lie un client catalogue ou en crée un à partir des champs du wizard. */
export async function ensureReservationClient(
  details: ReservationWizardDetails,
  clients: MemberClient[],
  addMember: AddClientMember,
): Promise<{ details: ReservationWizardDetails; error?: string }> {
  const linkedId = details.linkedMemberId?.trim();
  if (linkedId) return { details };

  const firstName = details.clientFirstName.trim();
  const lastName = details.clientLastName.trim();
  const email = details.clientEmail.trim();
  if (!firstName || !lastName || !email) {
    return { details, error: 'Prénom, nom et email client requis.' };
  }

  const existing = findClientByEmail(clients, email);
  if (existing) {
    return {
      details: mergeContractFieldsFromMember(
        {
          ...details,
          linkedMemberId: existing.id,
          clientType: existing.clientType,
          civility: existing.civility,
          clientFirstName: existing.firstName,
          clientLastName: existing.lastName,
          clientPhone: existing.phone ? String(existing.phone) : details.clientPhone,
        },
        existing,
      ),
    };
  }

  const res = await addMember({
    role: 'client',
    firstName,
    lastName,
    email,
    phone: details.clientPhone.trim() || null,
    isActive: true,
    clientType: details.clientType,
    civility: details.civility,
    birthDate: birthDateDisplayToIso(details.clientBirthDateDisplay),
    nationality: null,
    address: details.clientAddress.trim() || null,
    city: details.clientCity.trim() || null,
    postalCode: details.clientPostalCode.trim() || null,
    country: details.clientCountry.trim() || 'France',
    internalNote: null,
    cniFrontUrl: null,
    cniBackUrl: null,
    boatLicenseFrontUrl: null,
    boatLicenseBackUrl: null,
  });

  if (!res.ok) return { details, error: res.error };

  return {
    details: {
      ...details,
      linkedMemberId: res.id,
    },
  };
}

export function reservationTitleFromDetails(details: ReservationWizardDetails) {
  return clientDisplayNameFromDetails(details) || 'Réservation';
}
