import { z } from 'zod';
import { BOAT_TYPE_VALUES, boatTypeSchema } from './catalog';
import { coverPhotoIndexSchema, presentationPhotosSchema } from './media';
import { optionalUuidSchema, parseOrThrow, positiveIntSchema, trimmedString } from './primitives';

export const ANNOUNCEMENT_LINK_KIND_VALUES = ['EXISTING_FLEET', 'EXISTING_BOAT', 'NEW_FLEET', 'NEW_BOAT'] as const;
export const ANNOUNCEMENT_STATUS_VALUES = ['ACTIVE', 'ARCHIVED'] as const;

export const announcementLinkKindSchema = z.enum(ANNOUNCEMENT_LINK_KIND_VALUES);
export const announcementStatusSchema = z.enum(ANNOUNCEMENT_STATUS_VALUES);

export const createAnnouncementSchema = z
  .object({
    title: trimmedString(200, 'Titre'),
    navalBase: trimmedString(200, 'Base navale'),
    status: announcementStatusSchema.optional(),
    linkKind: announcementLinkKindSchema,
    linkedFleetId: optionalUuidSchema,
    linkedBoatId: optionalUuidSchema,
    newFleetName: z.union([trimmedString(120, 'Nom flotille'), z.null()]).optional(),
    newBoatBrand: z.union([trimmedString(120, 'Marque'), z.null()]).optional(),
    newBoatName: z.union([trimmedString(120, 'Nom'), z.null()]).optional(),
    newBoatModel: z.union([trimmedString(120, 'Modèle'), z.null()]).optional(),
    newBoatType: z.union([boatTypeSchema, z.null()]).optional(),
    newBoatMaxPassengers: z.union([positiveIntSchema(200), z.null()]).optional(),
    newBoatFleetId: optionalUuidSchema,
    presentationPhotos: presentationPhotosSchema,
    coverPhotoIndex: coverPhotoIndexSchema,
  })
  .superRefine((data, ctx) => {
    if (data.linkKind === 'EXISTING_FLEET' && !data.linkedFleetId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'linkedFleetId requis', path: ['linkedFleetId'] });
    }
    if (data.linkKind === 'EXISTING_BOAT' && !data.linkedBoatId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'linkedBoatId requis', path: ['linkedBoatId'] });
    }
    if (data.linkKind === 'NEW_FLEET' && !data.newFleetName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'newFleetName requis', path: ['newFleetName'] });
    }
    if (data.linkKind === 'NEW_BOAT') {
      if (!data.newBoatBrand || !data.newBoatName || !data.newBoatModel || !data.newBoatType) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Champs bateau requis pour NEW_BOAT', path: ['newBoatName'] });
      }
    }
  });

export const updateAnnouncementSchema = createAnnouncementSchema;

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

export function parseCreateAnnouncement(value: unknown): CreateAnnouncementInput {
  return parseOrThrow(createAnnouncementSchema, value);
}

export function parseUpdateAnnouncement(value: unknown): CreateAnnouncementInput {
  return parseOrThrow(updateAnnouncementSchema, value);
}
