import { z } from 'zod';
import { coverPhotoIndexSchema, presentationPhotosSchema } from './media';
import { moneyCentsSchema, optionalUuidSchema, parseOrThrow, positiveIntSchema, trimmedString, uuidSchema } from './primitives';

export const BOAT_TYPE_VALUES = [
  'BATEAU_A_MOTEUR',
  'SEMI_RIGIDE',
  'VOILIER',
  'CATAMARAN',
  'TRIMARAN',
  'PENICHE',
  'YACHT',
  'JETSKI',
  'ENGIN_NAUTIQUE',
  'AUTRE',
] as const;

export const boatTypeSchema = z.enum(BOAT_TYPE_VALUES);

export type BoatTypeValue = z.infer<typeof boatTypeSchema>;

export const createFleetSchema = z.object({
  name: trimmedString(120, 'Nom flotille'),
});

export const updateFleetSchema = createFleetSchema;

export const createBoatSchema = z.object({
  brand: trimmedString(120, 'Marque'),
  name: trimmedString(120, 'Nom'),
  model: trimmedString(120, 'Modèle'),
  boatType: boatTypeSchema,
  maxPassengers: positiveIntSchema(200),
  ownerMemberId: optionalUuidSchema,
  fleetId: optionalUuidSchema,
  presentationPhotos: presentationPhotosSchema,
  coverPhotoIndex: coverPhotoIndexSchema,
  detailsJson: z.union([z.string().max(200_000), z.null()]).optional(),
  depositAmountCents: moneyCentsSchema.optional(),
});

export const updateBoatSchema = createBoatSchema;

export const patchBoatDepositSchema = z.object({
  depositAmountCents: moneyCentsSchema,
});

export type CreateBoatInput = z.infer<typeof createBoatSchema>;
export type CreateFleetInput = z.infer<typeof createFleetSchema>;

export function parseCreateBoat(value: unknown): CreateBoatInput {
  return parseOrThrow(createBoatSchema, value);
}

export function parseUpdateBoat(value: unknown): CreateBoatInput {
  return parseOrThrow(updateBoatSchema, value);
}

export function parseCreateFleet(value: unknown): CreateFleetInput {
  return parseOrThrow(createFleetSchema, value);
}

export function parseUuidParam(id: unknown): string {
  return parseOrThrow(uuidSchema, id);
}
