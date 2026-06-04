import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { stripeErrorMessageFr } from '../stripe/stripe-error-message';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ZodError) {
      res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation échouée',
        errors: exception.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Erreur interne';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const payload = body as {
          message?: string | string[] | { message?: string };
          errors?: { message: string }[];
        };
        const raw = payload.message;
        if (typeof raw === 'string') message = raw;
        else if (Array.isArray(raw)) message = raw.join(' ');
        else if (raw && typeof raw === 'object' && typeof raw.message === 'string') message = raw.message;
        else if (payload.errors?.length) message = payload.errors.map((e) => e.message).join(' ');
        else message = 'Erreur';
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;
      message =
        exception.code === 'P2003'
          ? 'Modification impossible : des check-in/out existent déjà pour ce formulaire.'
          : exception.message;
    } else if (exception instanceof Stripe.errors.StripeError) {
      status = HttpStatus.BAD_REQUEST;
      this.logger.warn(`Stripe: ${exception.message}`);
      message = stripeErrorMessageFr(exception);
    } else if (exception instanceof Error) {
      this.logger.error(exception.stack);
      message = exception.message;
    }

    res.status(status).json({ statusCode: status, message, timestamp: new Date().toISOString() });
  }
}
