import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BOAT_TYPE_VALUES, MAX_PHOTO_DATA_URL_LENGTH, type BoatTypeValue } from '@bleu-calanque/shared';

const MAX_MONEY_CENTS = 100_000_000;

export class CreateFleetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}

export class UpdateFleetDto extends CreateFleetDto {}

export { BOAT_TYPE_VALUES };
export type { BoatTypeValue };

export class CreateBoatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  brand!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  model!: string;

  @IsString()
  @IsIn(BOAT_TYPE_VALUES as unknown as string[])
  boatType!: BoatTypeValue;

  @IsInt()
  @Min(1)
  @Max(200)
  maxPassengers!: number;

  @IsOptional()
  @IsUUID('4')
  ownerMemberId?: string | null;

  @IsOptional()
  @IsUUID('4')
  fleetId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(MAX_PHOTO_DATA_URL_LENGTH, { each: true })
  presentationPhotos?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(7)
  coverPhotoIndex?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  detailsJson?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_CENTS)
  depositAmountCents?: number;
}

export class UpdateBoatDto extends CreateBoatDto {}

export class PatchBoatDepositDto {
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_CENTS)
  depositAmountCents!: number;
}
