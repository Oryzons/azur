import { z } from 'zod';

export const upsertUnavailabilitySchema = z
  .object({
    id: z.string().uuid().optional(),
    boatId: z.string().uuid(),
    title: z.string().trim().min(1).max(120),
    reason: z.enum(['REPAIR', 'PRIVATE_USE', 'WEATHER', 'OTHER']).optional(),
    note: z.string().trim().max(2000).optional().nullable(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
  })
  .refine((d) => new Date(d.endAt).getTime() > new Date(d.startAt).getTime(), {
    message: 'La fin doit être après le début.',
    path: ['endAt'],
  });

export type UpsertUnavailabilityInput = z.infer<typeof upsertUnavailabilitySchema>;
