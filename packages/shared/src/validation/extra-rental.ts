import { z } from 'zod';

const clientFields = {
  clientMemberId: z.string().uuid().optional().nullable(),
  clientEmail: z.string().email().max(320).optional().nullable(),
  clientFirstName: z.string().max(120).optional().nullable(),
  clientLastName: z.string().max(120).optional().nullable(),
  clientPhone: z.string().max(40).optional().nullable(),
};

export const createExtraRentalSchema = z
  .object({
    extraId: z.string().uuid(),
    quantity: z.number().int().min(1).max(100).optional(),
    startAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
    endAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
    ...clientFields,
    markPaid: z.boolean().optional(),
    settlementNote: z.string().max(2000).optional().nullable(),
    internalNote: z.string().max(4000).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    const start = new Date(v.startAt);
    const end = new Date(v.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      ctx.addIssue({ code: 'custom', message: 'Créneau invalide.' });
    }
    if (!v.clientMemberId) {
      const fn = v.clientFirstName?.trim();
      const ln = v.clientLastName?.trim();
      const em = v.clientEmail?.trim();
      if (!fn || !ln || !em) {
        ctx.addIssue({ code: 'custom', message: 'Client : prénom, nom et email requis.' });
      }
    }
  });

export const updateExtraRentalSchema = z
  .object({
    quantity: z.number().int().min(1).max(100).optional(),
    startAt: z.string().datetime({ offset: true }).or(z.string().datetime()).optional(),
    endAt: z.string().datetime({ offset: true }).or(z.string().datetime()).optional(),
    ...clientFields,
    markPaid: z.boolean().optional(),
    cancel: z.boolean().optional(),
    settlementNote: z.string().max(2000).optional().nullable(),
    internalNote: z.string().max(4000).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.startAt != null && v.endAt != null) {
      const start = new Date(v.startAt);
      const end = new Date(v.endAt);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        ctx.addIssue({ code: 'custom', message: 'Créneau invalide.' });
      }
    }
  });

export type CreateExtraRentalInput = z.infer<typeof createExtraRentalSchema>;
export type UpdateExtraRentalInput = z.infer<typeof updateExtraRentalSchema>;
