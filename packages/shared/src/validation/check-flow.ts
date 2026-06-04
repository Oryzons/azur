import { z } from 'zod';
import { CHECK_FLOW_KIND_VALUES, CHECK_QUESTION_TYPE_VALUES } from '../enums';
import { photoDataUrlSchema, signatureDataUrlSchema } from './media';
import { trimmedString, uuidSchema } from './primitives';

export const checkFlowKindSchema = z.enum(CHECK_FLOW_KIND_VALUES);
export const checkQuestionTypeSchema = z.enum(CHECK_QUESTION_TYPE_VALUES);

export const checkFlowQuestionInputSchema = z.object({
  id: uuidSchema.optional(),
  label: trimmedString(300, 'Libellé'),
  helpText: z.string().max(1000).optional().nullable(),
  questionType: checkQuestionTypeSchema,
  required: z.boolean().optional().default(true),
  options: z.array(z.string().min(1).max(200)).max(20).optional(),
  photoMinCount: z.number().int().min(0).max(10).optional().default(1),
  photoMaxCount: z.number().int().min(1).max(10).optional().default(3),
  enabled: z.boolean().optional().default(true),
});

export const syncCheckFlowQuestionsSchema = z.object({
  kind: checkFlowKindSchema,
  questions: z.array(checkFlowQuestionInputSchema).max(50),
});

const httpsImageUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine((u) => u.startsWith('https://') || u.startsWith('http://localhost'), 'URL image invalide');

const checkFlowPhotoItemSchema = z.union([photoDataUrlSchema, httpsImageUrlSchema]);

const checkFlowSignatureSchema = z.union([signatureDataUrlSchema, httpsImageUrlSchema]);

export const submitCheckFlowAnswerSchema = z.object({
  questionId: uuidSchema,
  valueText: z.string().max(10_000).optional().nullable(),
  comment: z.string().max(2000).optional().nullable(),
  photos: z.array(photoDataUrlSchema).max(10).optional(),
});

export const updateCheckFlowAnswerSchema = submitCheckFlowAnswerSchema.extend({
  photos: z.array(checkFlowPhotoItemSchema).max(10).optional(),
});

export const submitCheckFlowSchema = z.object({
  reservationId: uuidSchema,
  kind: checkFlowKindSchema,
  answers: z.array(submitCheckFlowAnswerSchema).min(1).max(50),
  clientSignature: signatureDataUrlSchema,
  agentSignature: signatureDataUrlSchema,
});

export const updateCheckFlowSettingsSchema = z.object({
  checkOutUsesCheckInForm: z.boolean(),
});

export const updateCheckFlowSubmissionSchema = z.object({
  answers: z.array(updateCheckFlowAnswerSchema).min(1).max(50),
  clientSignature: checkFlowSignatureSchema,
  agentSignature: checkFlowSignatureSchema,
});

export type SyncCheckFlowQuestionsInput = z.infer<typeof syncCheckFlowQuestionsSchema>;
export type SubmitCheckFlowInput = z.infer<typeof submitCheckFlowSchema>;
export type UpdateCheckFlowSubmissionInput = z.infer<typeof updateCheckFlowSubmissionSchema>;
export type UpdateCheckFlowSettingsInput = z.infer<typeof updateCheckFlowSettingsSchema>;
