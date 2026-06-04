import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PRICING_UNIT_VALUES } from '@bleu-calanque/shared';

const MAX_MONEY_CENTS = 100_000_000;

export { PRICING_UNIT_VALUES };

export class CreatePricingPeriodDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(10)
  startDate!: string;

  @IsString()
  @MaxLength(10)
  endDate!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdatePricingPeriodDto extends CreatePricingPeriodDto {}

export class UpsertBoatPriceDto {
  @IsUUID('4')
  boatId!: string;

  @IsString()
  @IsIn(PRICING_UNIT_VALUES as unknown as string[])
  unit!: (typeof PRICING_UNIT_VALUES)[number];

  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_CENTS)
  amountCents!: number;
}

export class UpsertFleetPriceDto {
  @IsUUID('4')
  fleetId!: string;

  @IsString()
  @IsIn(PRICING_UNIT_VALUES as unknown as string[])
  unit!: (typeof PRICING_UNIT_VALUES)[number];

  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_CENTS)
  amountCents!: number;
}
