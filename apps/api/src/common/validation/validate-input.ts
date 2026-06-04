import { BadRequestException } from '@nestjs/common';
import { formatZodIssues } from '@bleu-calanque/shared';
import type { ZodType, ZodTypeAny, output } from 'zod';

/** Re-validation serveur : ne jamais faire confiance au pipe / au frontend seul. */
export function validateInput<T extends ZodTypeAny>(schema: T, value: unknown): output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException(formatZodIssues(result.error));
  }
  return result.data;
}
