import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ExtraRentalListQueryDto {
  @IsOptional()
  @IsUUID('4')
  extraId?: string;
}

export class CreateExtraRentalDto {
  @IsUUID('4')
  extraId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  quantity?: number;

  @IsString()
  startAt!: string;

  @IsString()
  endAt!: string;

  @IsOptional()
  @IsUUID('4')
  clientMemberId?: string | null;

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
  @MaxLength(40)
  clientPhone?: string | null;

  @IsOptional()
  @IsBoolean()
  markPaid?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  settlementNote?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  internalNote?: string | null;
}

export class UpdateExtraRentalDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  quantity?: number;

  @IsOptional()
  @IsString()
  startAt?: string;

  @IsOptional()
  @IsString()
  endAt?: string;

  @IsOptional()
  @IsUUID('4')
  clientMemberId?: string | null;

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
  @MaxLength(40)
  clientPhone?: string | null;

  @IsOptional()
  @IsBoolean()
  markPaid?: boolean;

  @IsOptional()
  @IsBoolean()
  cancel?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  settlementNote?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  internalNote?: string | null;
}
