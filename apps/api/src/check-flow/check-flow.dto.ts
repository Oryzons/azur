import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CHECK_FLOW_KIND_VALUES, CHECK_QUESTION_TYPE_VALUES } from '@bleu-calanque/shared';

export class CheckFlowQuestionDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsString()
  @MaxLength(300)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  helpText?: string | null;

  @IsString()
  @IsIn(CHECK_QUESTION_TYPE_VALUES as unknown as string[])
  questionType!: (typeof CHECK_QUESTION_TYPE_VALUES)[number];

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  photoMinCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  photoMaxCount?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class SyncCheckFlowQuestionsDto {
  @IsString()
  @IsIn(CHECK_FLOW_KIND_VALUES as unknown as string[])
  kind!: (typeof CHECK_FLOW_KIND_VALUES)[number];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckFlowQuestionDto)
  questions!: CheckFlowQuestionDto[];
}

export class SubmitCheckFlowAnswerDto {
  @IsUUID('4')
  questionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  valueText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}

export class SubmitCheckFlowDto {
  @IsUUID('4')
  reservationId!: string;

  @IsString()
  @IsIn(CHECK_FLOW_KIND_VALUES as unknown as string[])
  kind!: (typeof CHECK_FLOW_KIND_VALUES)[number];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitCheckFlowAnswerDto)
  answers!: SubmitCheckFlowAnswerDto[];

  @IsString()
  clientSignature!: string;

  @IsString()
  agentSignature!: string;
}
