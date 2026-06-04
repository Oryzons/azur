import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { Env } from '../config/env';

@Injectable()
export class ResendMailService {
  private readonly logger = new Logger(ResendMailService.name);
  private readonly resend: Resend | null;

  constructor(private readonly config: ConfigService<Env, true>) {
    const key = this.config.get('RESEND_API_KEY', { infer: true });
    this.resend = key ? new Resend(key) : null;
  }

  isConfigured(): boolean {
    return Boolean(this.resend);
  }

  async send(input: {
    to: string;
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
    fromName?: string;
    attachments?: { filename: string; content: Buffer }[];
  }): Promise<{ id: string }> {
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY absent — email non envoyé.');
      throw new Error('RESEND_API_KEY non configuré.');
    }

    const fromEmail = this.config.get('RESEND_FROM_EMAIL', { infer: true });
    const fromName = input.fromName ?? this.config.get('RESEND_FROM_NAME', { infer: true });
    const from = `${fromName} <${fromEmail}>`;

    const { data, error } = await this.resend.emails.send({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });

    if (error) {
      this.logger.error(`Resend error: ${error.message}`);
      throw new Error(error.message);
    }
    if (!data?.id) throw new Error('Réponse Resend invalide.');
    return { id: data.id };
  }
}
