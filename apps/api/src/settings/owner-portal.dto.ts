import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

function toBoolean(value: unknown): boolean {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return Boolean(value);
}

/** Corps complet enregistré en base (évite les PATCH partiels ambigus). */
export class PutOwnerNotificationPreferencesDto {
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  enabled!: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  onNewReservation!: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  onReservationUpdated!: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  onReservationCancelled!: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  onReservationRestored!: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  onReservationPaid!: boolean;
}
