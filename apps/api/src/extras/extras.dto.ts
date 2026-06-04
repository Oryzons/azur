import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { EXTRA_BILLING_UNIT_VALUES, EXTRA_PRICE_KIND_VALUES, PAYMENT_CHANNEL_VALUES } from '@bleu-calanque/shared';

export { EXTRA_PRICE_KIND_VALUES, EXTRA_BILLING_UNIT_VALUES, PAYMENT_CHANNEL_VALUES };

export class CreateExtraDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsString()
  @IsIn(EXTRA_PRICE_KIND_VALUES as unknown as string[])
  priceKind!: (typeof EXTRA_PRICE_KIND_VALUES)[number];

  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  priceValue!: number;

  @IsString()
  @IsIn(EXTRA_BILLING_UNIT_VALUES as unknown as string[])
  billingUnit!: (typeof EXTRA_BILLING_UNIT_VALUES)[number];

  @IsNumber()
  @Min(0)
  @Max(100)
  vatRate!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock?: number | null;

  @IsOptional()
  @IsString()
  @IsIn(PAYMENT_CHANNEL_VALUES as unknown as string[])
  paymentChannel?: (typeof PAYMENT_CHANNEL_VALUES)[number];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateExtraDto extends CreateExtraDto {}
