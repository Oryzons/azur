import { IsArray, ArrayMinSize, IsBoolean, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export const PARTNER_KIND_VALUES = ['NAUTIC_BASE', 'MAINTENANCE', 'INSURANCE', 'OTHER'] as const;

export const PARTNER_LINKED_OFFERING_VALUES = ['BOAT_LICENSE', 'FLUVIAL', 'BOAT_RENTAL'] as const;

export class CompanySettingsDto {
  @IsOptional() @IsString() contactOpeningHours?: string;
  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsString() tradeName?: string;
  @IsOptional() @IsString() professionalPhone?: string;
  @IsOptional() @IsString() domiciliation?: string;
  @IsOptional() @IsString() companyType?: string;
  @IsOptional() @IsString() vatNumber?: string;
  @IsOptional() @IsString() siret?: string;
  @IsOptional() @IsString() rcsRegistration?: string;
  @IsOptional() @IsString() nafCode?: string;
  @IsOptional() @IsString() shareCapital?: string;
  @IsOptional() @IsString() addressLine?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() publicSiteUrl?: string;
  @IsOptional() @IsString() brandName?: string;
  @IsOptional() @IsNumber() adsVatRatePercent?: number;
  @IsOptional() @IsNumber() vatBasePercent?: number;
  @IsOptional() @IsNumber() vatPercent?: number;
  @IsOptional() @IsString() contractOperatorSignatureDataUrl?: string | null;
  @IsOptional() @IsString() departureLocation?: string;
  @IsOptional() @IsString() arrivalLocation?: string;
}

export class BankSettingsDto {
  @IsOptional() @IsString() accountHolder?: string;
  @IsOptional() @IsString() iban?: string;
  @IsOptional() @IsString() bic?: string;
  @IsOptional() @IsString() bankName?: string;
}

export class NotificationsSettingsDto {
  @IsOptional() @IsString() adminEmailsCsv?: string;
  @IsOptional() @IsBoolean() onReservationCreated?: boolean;
  @IsOptional() @IsBoolean() onReservationUpdated?: boolean;
  @IsOptional() @IsBoolean() onPaymentCaptured?: boolean;
  @IsOptional() @IsBoolean() onRefundCreated?: boolean;
  @IsOptional() @IsBoolean() onReservationCancelled?: boolean;
  @IsOptional() @IsBoolean() onReservationRestored?: boolean;
  @IsOptional() @IsBoolean() onReservationDeleted?: boolean;
  @IsOptional() @IsBoolean() onCheckInDone?: boolean;
  @IsOptional() @IsBoolean() onCheckOutDone?: boolean;
}

export class BookingSettingsDto {
  @IsOptional() @IsString() defaultNavalBase?: string;
  @IsOptional() @IsString() departureLocation?: string;
  @IsOptional() @IsString() arrivalLocation?: string;
  @IsOptional() @IsBoolean() requireDeposit?: boolean;
  @IsOptional() @IsString() depositDefaultAmount?: string;
  @IsOptional() @IsBoolean() paymentsOnlineEnabled?: boolean;
}

export class EmailSettingsDto {
  @IsOptional() @IsString() fromName?: string;
  @IsOptional() @IsString() fromEmail?: string;
  @IsOptional() @IsString() replyToEmail?: string;
  @IsOptional() @IsBoolean() confirmationsEnabled?: boolean;
}

export class PublicSiteSettingsDto {
  @IsOptional() @IsString() publicSiteUrl?: string;
  @IsOptional() @IsString() brandName?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() addressLine?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() departureLocation?: string;
  @IsOptional() @IsString() arrivalLocation?: string;
}

export class SeoSettingsDto {
  @IsOptional() @IsString() metaTitle?: string;
  @IsOptional() @IsString() metaDescription?: string;
  @IsOptional() @IsString() ogImageUrl?: string;
}

export class NauticManagerSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() baseUrl?: string;
  @IsOptional() @IsString() apiKey?: string;
  @IsOptional() @IsString() webhookSecret?: string;
  @IsOptional() @IsBoolean() syncOwners?: boolean;
  @IsOptional() @IsBoolean() syncBoats?: boolean;
  @IsOptional() @IsBoolean() syncReservations?: boolean;
}

export class UpdateSettingsDto {
  @IsOptional() company?: CompanySettingsDto;
  @IsOptional() bank?: BankSettingsDto;
  @IsOptional() notifications?: NotificationsSettingsDto;
  @IsOptional() booking?: BookingSettingsDto;
  @IsOptional() email?: EmailSettingsDto;
  @IsOptional() publicSite?: PublicSiteSettingsDto;
  @IsOptional() seo?: SeoSettingsDto;
  @IsOptional() nauticManager?: NauticManagerSettingsDto;
}

export class CreatePartnerDto {
  @IsString() name!: string;
  @IsOptional() @IsString() @IsIn(PARTNER_KIND_VALUES as unknown as string[])
  kind?: (typeof PARTNER_KIND_VALUES)[number];
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(PARTNER_LINKED_OFFERING_VALUES, { each: true })
  linkedOfferings?: (typeof PARTNER_LINKED_OFFERING_VALUES)[number][];
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() price?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdatePartnerDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() @IsIn(PARTNER_KIND_VALUES as unknown as string[])
  kind?: (typeof PARTNER_KIND_VALUES)[number];
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(PARTNER_LINKED_OFFERING_VALUES, { each: true })
  linkedOfferings?: (typeof PARTNER_LINKED_OFFERING_VALUES)[number][];
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() price?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateContractDto {
  @IsString() name!: string;
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @IsString({ each: true })
  requiredDocuments?: string[];
  @IsOptional() @IsString() cancellationTerms?: string;
  @IsOptional() @IsString() rentalTerms?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateContractDto extends CreateContractDto {}
