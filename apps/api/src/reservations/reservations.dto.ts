import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CIVILITY_VALUES,
  CLIENT_TYPE_VALUES,
  PAYMENT_CHANNEL_VALUES,
  RESERVATION_STATUS_VALUES,
} from '@bleu-calanque/shared';

const MAX_MONEY_CENTS = 100_000_000;

export class ReservationExtraItemDto {
  @IsUUID('4')
  extraId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;
}

export class ReservationRefundItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsNumber()
  @Min(0.01)
  @Max(1_000_000)
  amount!: number;

  @IsOptional()
  @IsString()
  at?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class UpsertReservationDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsUUID('4')
  boatId!: string;

  @IsString()
  @MaxLength(300)
  title!: string;

  @IsString()
  start!: string;

  @IsString()
  end!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  detailsJson?: string | null;

  @IsOptional()
  @IsUUID('4')
  clientMemberId?: string | null;

  @IsOptional()
  @IsIn(CLIENT_TYPE_VALUES as unknown as string[])
  clientType?: (typeof CLIENT_TYPE_VALUES)[number] | null;

  @IsOptional()
  @IsIn(CIVILITY_VALUES as unknown as string[])
  civility?: (typeof CIVILITY_VALUES)[number] | null;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  clientEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientFirstName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientLastName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  clientPhone?: string | null;

  @IsOptional()
  @IsString()
  clientBirthDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  clientAddress?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  clientPostalCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientCity?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  clientCountry?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  passengerCount?: number | null;

  @IsOptional()
  @IsBoolean()
  hasChildren?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  childrenCount?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  internalNote?: string | null;

  @IsOptional()
  @IsIn(PAYMENT_CHANNEL_VALUES as unknown as string[])
  paymentChannel?: (typeof PAYMENT_CHANNEL_VALUES)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_CENTS)
  rentalPriceCents?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_CENTS)
  depositAmountCents?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  couponCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  airbusBadge?: string | null;

  @IsOptional()
  @IsIn([1, 2])
  installments?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  settlementNote?: string | null;

  @IsOptional()
  @IsString()
  paymentCapturedAt?: string | null;

  @IsOptional()
  @IsString()
  depositCapturedAt?: string | null;

  @IsOptional()
  @IsString()
  confirmationEmailSentAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalDueCents?: number | null;

  @IsOptional()
  @IsString()
  cancelledAt?: string | null;

  @IsOptional()
  @IsIn(RESERVATION_STATUS_VALUES as unknown as string[])
  status?: (typeof RESERVATION_STATUS_VALUES)[number] | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReservationExtraItemDto)
  extras?: ReservationExtraItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReservationRefundItemDto)
  refunds?: ReservationRefundItemDto[];
}

export class CancelReservationDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @IsOptional()
  @IsBoolean()
  notifyClient?: boolean;
}

export class CreateReservationRefundDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
