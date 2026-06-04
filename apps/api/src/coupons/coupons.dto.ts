import {
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
} from 'class-validator';
import { COUPON_DISCOUNT_KIND_VALUES } from '@bleu-calanque/shared';

export { COUPON_DISCOUNT_KIND_VALUES };

export class CreateCouponDto {
  @IsString()
  @MaxLength(64)
  code!: string;

  @IsString()
  @MaxLength(200)
  internalLabel!: string;

  @IsString()
  @IsIn(COUPON_DISCOUNT_KIND_VALUES as unknown as string[])
  discountKind!: (typeof COUPON_DISCOUNT_KIND_VALUES)[number];

  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  discountValue!: number;

  @IsString()
  @MaxLength(10)
  validFrom!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  validUntil?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  seasonMaxFullUsesPerClient?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  seasonDegradedDiscountValue?: number | null;

  @IsOptional()
  @IsBoolean()
  requiresAirbusBadge?: boolean;
}

export class UpdateCouponDto extends CreateCouponDto {}

export class CreateRedemptionDto {
  @IsString()
  @MaxLength(320)
  clientKey!: string;

  @IsOptional()
  @IsString()
  redeemedAt?: string;
}

export class RemoveClientRedemptionsDto {
  @IsUUID()
  couponId!: string;

  @IsString()
  @MaxLength(320)
  clientKey!: string;
}
