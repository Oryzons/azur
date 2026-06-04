import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  computeTabletFlowAccess,
  type SubmitCheckFlowInput,
  type SyncCheckFlowQuestionsInput,
  submitCheckFlowSchema,
  syncCheckFlowQuestionsSchema,
  updateCheckFlowSettingsSchema,
  updateCheckFlowSubmissionSchema,
  type UpdateCheckFlowSubmissionInput,
} from '@bleu-calanque/shared';
import { CheckFlowKind, CheckQuestionType, Prisma } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { AuditAction, AuditEntity } from '../common/audit/audit.constants';
import { SecureMediaService } from '../common/media/secure-media.service';
import { validateInput } from '../common/validation/validate-input';
import { PrismaService } from '../prisma/prisma.service';
import { InternalNotificationsService } from '../internal-notifications/internal-notifications.service';

const submissionInclude = {
  answers: { include: { question: true } },
  submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  reservation: {
    select: {
      id: true,
      title: true,
      startAt: true,
      endAt: true,
      boat: { select: { id: true, name: true, brand: true } },
    },
  },
} satisfies Prisma.CheckFlowSubmissionInclude;

const CHECK_FLOW_SETTINGS_ID = 'check_flow_settings';

@Injectable()
export class CheckFlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: SecureMediaService,
    private readonly audit: AuditService,
    private readonly internalNotifications: InternalNotificationsService,
  ) {}

  private async ensureSettings() {
    return this.prisma.checkFlowSettings.upsert({
      where: { id: CHECK_FLOW_SETTINGS_ID },
      create: { id: CHECK_FLOW_SETTINGS_ID },
      update: {},
    });
  }

  async getSettings() {
    const row = await this.ensureSettings();
    return { checkOutUsesCheckInForm: row.checkOutUsesCheckInForm };
  }

  async updateSettings(raw: unknown) {
    const input = validateInput(updateCheckFlowSettingsSchema, raw);
    const row = await this.prisma.checkFlowSettings.upsert({
      where: { id: CHECK_FLOW_SETTINGS_ID },
      create: {
        id: CHECK_FLOW_SETTINGS_ID,
        checkOutUsesCheckInForm: input.checkOutUsesCheckInForm,
      },
      update: { checkOutUsesCheckInForm: input.checkOutUsesCheckInForm },
    });
    await this.audit.log({
      action: AuditAction.UPDATE,
      entity: AuditEntity.SETTINGS,
      entityId: CHECK_FLOW_SETTINGS_ID,
      newData: { checkOutUsesCheckInForm: row.checkOutUsesCheckInForm },
    });
    return { checkOutUsesCheckInForm: row.checkOutUsesCheckInForm };
  }

  private async resolveQuestionsKind(kind: CheckFlowKind): Promise<CheckFlowKind> {
    if (kind !== 'CHECK_OUT') return kind;
    const settings = await this.ensureSettings();
    return settings.checkOutUsesCheckInForm ? 'CHECK_IN' : 'CHECK_OUT';
  }

  async listQuestions(kind: CheckFlowKind) {
    const resolved = await this.resolveQuestionsKind(kind);
    return this.prisma.checkFlowQuestion.findMany({
      where: { kind: resolved, enabled: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Toutes les questions (y compris désactivées) pour l’admin. */
  listQuestionsAdmin(kind: CheckFlowKind) {
    return this.resolveQuestionsKind(kind).then((resolved) =>
      this.prisma.checkFlowQuestion.findMany({
        where: { kind: resolved },
        orderBy: { sortOrder: 'asc' },
      }),
    );
  }

  async syncQuestions(raw: unknown) {
    const input = validateInput(syncCheckFlowQuestionsSchema, raw);

    const settings = await this.ensureSettings();
    if (input.kind === 'CHECK_OUT' && settings.checkOutUsesCheckInForm) {
      throw new BadRequestException(
        'Le check-out utilise le formulaire check-in. Modifiez le check-in ou désactivez cette option.',
      );
    }

    for (const q of input.questions) {
      if (q.questionType === 'SELECT' && (!q.options?.length)) {
        throw new BadRequestException(`« ${q.label} » : ajoutez au moins une option.`);
      }
      if (q.questionType === 'PHOTO') {
        const min = q.photoMinCount ?? 1;
        const max = q.photoMaxCount ?? 3;
        if (min > max) {
          throw new BadRequestException(`« ${q.label} » : le minimum de photos ne peut pas dépasser le maximum.`);
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.checkFlowQuestion.findMany({
        where: { kind: input.kind },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((q) => q.id));
      const keptIds = new Set<string>();

      for (let idx = 0; idx < input.questions.length; idx++) {
        const q = input.questions[idx];
        const data = {
          sortOrder: idx,
          label: q.label,
          helpText: q.helpText ?? null,
          questionType: q.questionType as CheckQuestionType,
          required: q.required ?? true,
          optionsJson: q.options?.length ? JSON.stringify(q.options) : null,
          photoMinCount: q.photoMinCount ?? 1,
          photoMaxCount: q.photoMaxCount ?? 3,
          enabled: q.enabled ?? true,
        };

        if (q.id && existingIds.has(q.id)) {
          await tx.checkFlowQuestion.update({ where: { id: q.id }, data });
          keptIds.add(q.id);
        } else {
          const created = await tx.checkFlowQuestion.create({
            data: { ...data, kind: input.kind },
          });
          keptIds.add(created.id);
        }
      }

      for (const row of existing) {
        if (keptIds.has(row.id)) continue;
        const answerCount = await tx.checkFlowAnswer.count({ where: { questionId: row.id } });
        if (answerCount > 0) {
          await tx.checkFlowQuestion.update({
            where: { id: row.id },
            data: { enabled: false, sortOrder: 9999 },
          });
        } else {
          await tx.checkFlowQuestion.delete({ where: { id: row.id } });
        }
      }
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      entity: AuditEntity.SETTINGS,
      entityId: `check_flow_${input.kind}`,
      newData: { questionCount: input.questions.length, kind: input.kind },
    });

    return this.listQuestionsAdmin(input.kind);
  }

  listSubmissions(params: {
    kind?: CheckFlowKind;
    reservationId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.CheckFlowSubmissionWhereInput = {};
    if (params.kind) where.kind = params.kind;
    if (params.reservationId) where.reservationId = params.reservationId;
    if (params.from || params.to) {
      where.submittedAt = {};
      if (params.from) where.submittedAt.gte = params.from;
      if (params.to) where.submittedAt.lte = params.to;
    }

    return this.prisma.checkFlowSubmission.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: params.limit ?? 100,
      skip: params.offset ?? 0,
      include: submissionInclude,
    });
  }

  async getSubmission(id: string) {
    const row = await this.prisma.checkFlowSubmission.findUnique({
      where: { id },
      include: submissionInclude,
    });
    if (!row) throw new NotFoundException('Soumission introuvable.');
    return row;
  }

  async getReservationStatus(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, startAt: true, endAt: true },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable.');

    const submissions = await this.prisma.checkFlowSubmission.findMany({
      where: { reservationId },
      include: submissionInclude,
    });
    const checkIn = submissions.find((s) => s.kind === 'CHECK_IN') ?? null;
    const checkOut = submissions.find((s) => s.kind === 'CHECK_OUT') ?? null;

    const checkInAccess = computeTabletFlowAccess({
      kind: 'CHECK_IN',
      reservationStartAt: reservation.startAt,
      reservationEndAt: reservation.endAt,
      submission: checkIn ? { id: checkIn.id, submittedAt: checkIn.submittedAt } : null,
    });
    const checkOutAccess = computeTabletFlowAccess({
      kind: 'CHECK_OUT',
      reservationStartAt: reservation.startAt,
      reservationEndAt: reservation.endAt,
      submission: checkOut ? { id: checkOut.id, submittedAt: checkOut.submittedAt } : null,
    });

    return { checkIn, checkOut, checkInAccess, checkOutAccess };
  }

  private async storeCheckFlowPhoto(url: string): Promise<string> {
    if (url.startsWith('data:image/')) {
      return (await this.media.processDataUrl(url)).publicUrl;
    }
    const kept = await this.media.processOptionalImageUrl(url);
    if (!kept) throw new BadRequestException('Photo invalide.');
    return kept;
  }

  private async storeCheckFlowSignature(url: string): Promise<string> {
    const kept = await this.media.processOptionalImageUrl(url);
    if (!kept) throw new BadRequestException('Signature invalide.');
    return kept;
  }

  private async buildProcessedAnswers(
    questions: Array<{
      id: string;
      label: string;
      questionType: CheckQuestionType;
      required: boolean;
      optionsJson: string | null;
      photoMinCount: number;
      photoMaxCount: number;
    }>,
    answers: UpdateCheckFlowSubmissionInput['answers'],
  ) {
    const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));
    const processedAnswers: {
      questionId: string;
      valueText: string | null;
      valueJson: string | null;
      commentText: string | null;
    }[] = [];
    const summaryLines: string[] = [];

    for (const q of questions) {
      const ans = answerByQuestion.get(q.id);
      if (!ans && q.required) {
        throw new BadRequestException(`Réponse manquante : ${q.label}`);
      }
      if (!ans) continue;

      const commentText = (ans.comment ?? '').trim() || null;
      let valueText: string | null = null;
      let valueJson: string | null = null;

      switch (q.questionType) {
        case 'TEXT':
          valueText = (ans.valueText ?? '').trim();
          if (q.required && !valueText) throw new BadRequestException(`« ${q.label} » est requis.`);
          summaryLines.push(`${q.label}: ${valueText || '—'}`);
          break;
        case 'BOOLEAN':
          valueText = ans.valueText === 'true' || ans.valueText === '1' ? 'true' : 'false';
          summaryLines.push(`${q.label}: ${valueText === 'true' ? 'Oui' : 'Non'}`);
          break;
        case 'SELECT': {
          valueText = (ans.valueText ?? '').trim();
          const opts: string[] = q.optionsJson ? JSON.parse(q.optionsJson) : [];
          if (q.required && !valueText) throw new BadRequestException(`« ${q.label} » est requis.`);
          if (valueText && opts.length && !opts.includes(valueText)) {
            throw new BadRequestException(`Option invalide pour « ${q.label} ».`);
          }
          summaryLines.push(`${q.label}: ${valueText || '—'}`);
          break;
        }
        case 'PHOTO': {
          const photos = ans.photos ?? [];
          if (photos.length < q.photoMinCount) {
            throw new BadRequestException(`« ${q.label} » : minimum ${q.photoMinCount} photo(s).`);
          }
          if (photos.length > q.photoMaxCount) {
            throw new BadRequestException(`« ${q.label} » : maximum ${q.photoMaxCount} photo(s).`);
          }
          const stored: string[] = [];
          for (const p of photos) {
            stored.push(await this.storeCheckFlowPhoto(p));
          }
          valueJson = JSON.stringify(stored);
          summaryLines.push(`${q.label}: ${stored.length} photo(s)`);
          break;
        }
        case 'FUEL_GAUGE': {
          const rawVal = (ans.valueText ?? '').trim();
          const n = Number(rawVal);
          if (q.required && (rawVal === '' || Number.isNaN(n))) {
            throw new BadRequestException(`« ${q.label} » : indiquez le niveau d'essence.`);
          }
          if (rawVal !== '' && (Number.isNaN(n) || n < 0 || n > 100)) {
            throw new BadRequestException(`« ${q.label} » : niveau entre 0 et 100 %.`);
          }
          valueText = rawVal === '' ? null : String(Math.round(n));
          summaryLines.push(`${q.label}: ${valueText ?? '—'} %`);
          break;
        }
        default:
          throw new BadRequestException(`Type de question non pris en charge : ${q.questionType}`);
      }

      if (commentText) {
        summaryLines.push(`${q.label} — commentaire : ${commentText}`);
      }

      processedAnswers.push({ questionId: q.id, valueText, valueJson, commentText });
    }

    return { processedAnswers, summaryLines };
  }

  async submit(raw: unknown, userId: string) {
    const input = validateInput(submitCheckFlowSchema, raw);

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: input.reservationId },
      include: { boat: { select: { name: true } } },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable.');

    const existing = await this.prisma.checkFlowSubmission.findUnique({
      where: {
        reservationId_kind: { reservationId: input.reservationId, kind: input.kind },
      },
    });

    const access = computeTabletFlowAccess({
      kind: input.kind,
      reservationStartAt: reservation.startAt,
      reservationEndAt: reservation.endAt,
      submission: existing ? { id: existing.id, submittedAt: existing.submittedAt } : null,
    });

    if (access.mode === 'view' || access.mode === 'done_today') {
      throw new ConflictException(
        input.kind === 'CHECK_IN'
          ? 'Check-in déjà effectué. Modifiez-le depuis la tablette ou consultez le détail.'
          : 'Check-out déjà effectué. Modifiez-le depuis la tablette ou consultez le détail.',
      );
    }
    if (access.mode === 'expired') {
      throw new BadRequestException(
        input.kind === 'CHECK_IN'
          ? 'Le délai pour effectuer le check-in est dépassé.'
          : 'Le délai pour effectuer le check-out est dépassé.',
      );
    }

    const questionsKind = await this.resolveQuestionsKind(input.kind);
    const questions = await this.prisma.checkFlowQuestion.findMany({
      where: { kind: questionsKind, enabled: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (!questions.length) {
      throw new BadRequestException('Aucune question configurée pour ce flux.');
    }

    const { processedAnswers, summaryLines } = await this.buildProcessedAnswers(questions, input.answers);

    const clientSignatureUrl = await this.storeCheckFlowSignature(input.clientSignature);
    const agentSignatureUrl = await this.storeCheckFlowSignature(input.agentSignature);

    const submittedAt = new Date();
    const submittedAtLabel = submittedAt.toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    const summaryJson = JSON.stringify({
      lines: [
        `Enregistré le ${submittedAtLabel}`,
        ...summaryLines,
        'Signatures client et loueur enregistrées',
      ],
      boatName: reservation.boat?.name,
      reservationTitle: reservation.title,
      submittedAt: submittedAt.toISOString(),
    });

    const submission = await this.prisma.checkFlowSubmission.create({
      data: {
        reservationId: input.reservationId,
        kind: input.kind,
        submittedByUserId: userId,
        submittedAt,
        summaryJson,
        clientSignatureUrl,
        agentSignatureUrl,
        answers: {
          create: processedAnswers,
        },
      },
      include: submissionInclude,
    });

    await this.audit.log({
      action: AuditAction.CREATE,
      entity: AuditEntity.RESERVATION,
      entityId: input.reservationId,
      newData: {
        checkFlow: input.kind,
        submissionId: submission.id,
        summary: summaryLines.slice(0, 8),
      },
    });

    await this.internalNotifications.createFromCheckFlowSubmission(submission);

    return submission;
  }

  async updateSubmission(id: string, raw: unknown, userId: string) {
    const input = validateInput(updateCheckFlowSubmissionSchema, raw);

    const existing = await this.prisma.checkFlowSubmission.findUnique({
      where: { id },
      include: {
        reservation: { include: { boat: { select: { name: true } } } },
      },
    });
    if (!existing) throw new NotFoundException('Soumission introuvable.');

    const access = computeTabletFlowAccess({
      kind: existing.kind,
      reservationStartAt: existing.reservation.startAt,
      reservationEndAt: existing.reservation.endAt,
      submission: { id: existing.id, submittedAt: existing.submittedAt },
    });
    if (access.mode !== 'done_today') {
      throw new BadRequestException(
        'Ce formulaire ne peut être modifié que le jour même de son enregistrement.',
      );
    }

    const questionsKind = await this.resolveQuestionsKind(existing.kind);
    const questions = await this.prisma.checkFlowQuestion.findMany({
      where: { kind: questionsKind, enabled: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (!questions.length) {
      throw new BadRequestException('Aucune question configurée pour ce flux.');
    }

    const { processedAnswers, summaryLines } = await this.buildProcessedAnswers(questions, input.answers);
    const clientSignatureUrl = await this.storeCheckFlowSignature(input.clientSignature);
    const agentSignatureUrl = await this.storeCheckFlowSignature(input.agentSignature);

    const submittedAtLabel = existing.submittedAt.toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    const updatedAtLabel = new Date().toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    const summaryJson = JSON.stringify({
      lines: [
        `Enregistré le ${submittedAtLabel}`,
        `Modifié le ${updatedAtLabel}`,
        ...summaryLines,
        'Signatures client et loueur enregistrées',
      ],
      boatName: existing.reservation.boat?.name,
      reservationTitle: existing.reservation.title,
      submittedAt: existing.submittedAt.toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const submission = await this.prisma.$transaction(async (tx) => {
      await tx.checkFlowAnswer.deleteMany({ where: { submissionId: id } });
      return tx.checkFlowSubmission.update({
        where: { id },
        data: {
          submittedByUserId: userId,
          summaryJson,
          clientSignatureUrl,
          agentSignatureUrl,
          answers: { create: processedAnswers },
        },
        include: submissionInclude,
      });
    });

    await this.audit.log({
      action: AuditAction.UPDATE,
      entity: AuditEntity.RESERVATION,
      entityId: existing.reservationId,
      newData: {
        checkFlow: existing.kind,
        submissionId: submission.id,
        summary: summaryLines.slice(0, 8),
      },
    });

    return submission;
  }

  /** Réservations du jour pour la tablette agent. */
  listTabletReservations(day: Date) {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);

    return this.prisma.reservation.findMany({
      where: {
        OR: [
          { startAt: { gte: start, lte: end } },
          { endAt: { gte: start, lte: end } },
          { AND: [{ startAt: { lte: start } }, { endAt: { gte: end } }] },
        ],
        status: { notIn: ['CANCELLED'] },
      },
      orderBy: { startAt: 'asc' },
      include: {
        boat: { select: { id: true, name: true, brand: true } },
        checkFlowSubmissions: {
          select: { id: true, kind: true, submittedAt: true, summaryJson: true },
        },
      },
    });
  }
}
