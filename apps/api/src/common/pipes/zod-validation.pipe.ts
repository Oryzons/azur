import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { formatZodIssues } from '@bleu-calanque/shared';
import type { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(formatZodIssues(result.error));
    }
    return result.data;
  }
}
