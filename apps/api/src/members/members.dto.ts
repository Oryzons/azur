import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BOAT_LICENSE_TYPE_VALUES } from '@bleu-calanque/shared';

export const MEMBER_ROLE_VALUES = ['ADMIN', 'AGENT', 'OWNER', 'CLIENT', 'DAF'] as const;

export const CLIENT_TYPE_VALUES = ['PARTICULIER', 'PROFESSIONNEL', 'ASSOCIATION'] as const;
export const CIVILITY_VALUES = ['NONE', 'M', 'MME', 'MX'] as const;

export class CreateMemberDto {
  @IsString()
  @IsIn(MEMBER_ROLE_VALUES as unknown as string[])
  role!: (typeof MEMBER_ROLE_VALUES)[number];

  @IsString() @IsNotEmpty()
  firstName!: string;

  @IsString() @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsOptional() @IsString()
  phone?: string | null;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  // Owner
  @IsOptional() @IsString()
  ownerSince?: string | null;
  @IsOptional() @IsString()
  ownerCompany?: string | null;
  @IsOptional() @IsString()
  ownerIban?: string | null;
  @IsOptional() @IsString()
  ownerAddress?: string | null;

  // Client
  @IsOptional() @IsString() @IsIn(CLIENT_TYPE_VALUES as unknown as string[])
  clientType?: (typeof CLIENT_TYPE_VALUES)[number] | null;
  @IsOptional() @IsString() @IsIn(CIVILITY_VALUES as unknown as string[])
  civility?: (typeof CIVILITY_VALUES)[number] | null;
  @IsOptional() @IsString()
  birthDate?: string | null;
  @IsOptional() @IsString()
  nationality?: string | null;
  @IsOptional() @IsString()
  address?: string | null;
  @IsOptional() @IsString()
  city?: string | null;
  @IsOptional() @IsString()
  postalCode?: string | null;
  @IsOptional() @IsString()
  country?: string | null;
  @IsOptional() @IsString()
  internalNote?: string | null;
  @IsOptional() @IsString()
  airbusBadge?: string | null;
  @IsOptional() @IsString()
  airbusBadgePhotoUrl?: string | null;
  @IsOptional() @IsString()
  clientIdNumber?: string | null;
  @IsOptional() @IsString()
  clientIdType?: string | null;
  @IsOptional() @IsString()
  licenseNumber?: string | null;
  @IsOptional() @IsString() @IsIn(BOAT_LICENSE_TYPE_VALUES as unknown as string[])
  licenseType?: (typeof BOAT_LICENSE_TYPE_VALUES)[number] | null;
  @IsOptional() @IsString()
  licenseCountry?: string | null;
  @IsOptional() @IsString()
  licenseYear?: string | null;
  @IsOptional() @IsString()
  cniFrontUrl?: string | null;
  @IsOptional() @IsString()
  cniBackUrl?: string | null;
  @IsOptional() @IsString()
  boatLicenseFrontUrl?: string | null;
  @IsOptional() @IsString()
  boatLicenseBackUrl?: string | null;

  // Admin/Agent permissions
  @IsOptional() @IsBoolean()
  permManageMembers?: boolean;
  @IsOptional() @IsBoolean()
  permManageBoats?: boolean;
  @IsOptional() @IsBoolean()
  permManageReservations?: boolean;

  @IsOptional() @IsBoolean()
  permComptabilite?: boolean;
}

export class UpdateMemberDto extends CreateMemberDto {}
