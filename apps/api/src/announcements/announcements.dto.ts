import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import {
  ANNOUNCEMENT_LINK_KIND_VALUES,
  ANNOUNCEMENT_STATUS_VALUES,
  BOAT_TYPE_VALUES,
  MAX_PHOTO_DATA_URL_LENGTH,
} from '@bleu-calanque/shared';

export { ANNOUNCEMENT_LINK_KIND_VALUES, ANNOUNCEMENT_STATUS_VALUES, BOAT_TYPE_VALUES };

export class CreateAnnouncementDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(200)
  navalBase!: string;

  @IsOptional()
  @IsString()
  @IsIn(ANNOUNCEMENT_STATUS_VALUES as unknown as string[])
  status?: (typeof ANNOUNCEMENT_STATUS_VALUES)[number];

  @IsString()
  @IsIn(ANNOUNCEMENT_LINK_KIND_VALUES as unknown as string[])
  linkKind!: (typeof ANNOUNCEMENT_LINK_KIND_VALUES)[number];

  @IsOptional()
  @IsUUID('4')
  linkedFleetId?: string | null;

  @IsOptional()
  @IsUUID('4')
  linkedBoatId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  newFleetName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  newBoatBrand?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  newBoatName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  newBoatModel?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(BOAT_TYPE_VALUES as unknown as string[])
  newBoatType?: (typeof BOAT_TYPE_VALUES)[number] | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  newBoatMaxPassengers?: number | null;

  @IsOptional()
  @IsUUID('4')
  newBoatFleetId?: string | null;

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
}

export class UpdateAnnouncementDto extends CreateAnnouncementDto {}
