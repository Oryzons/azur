import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { AnyAuthenticated, DeskOnly } from '../common/decorators/role-groups.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  type AuthUser,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
} from '@bleu-calanque/shared';

/** 10 req/min/IP — aligné sur THROTTLE_AUTH_LIMIT (défaut env). */
const AUTH_ROUTE_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle(AUTH_ROUTE_THROTTLE)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput, @Req() req: Request) {
    return this.auth.login(body, { ip: req.ip, userAgent: req.get('user-agent') });
  }

  /** Inscription self-serve → rôle STAFF. */
  @Public()
  @Post('register')
  @HttpCode(200)
  @Throttle(AUTH_ROUTE_THROTTLE)
  register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterInput, @Req() req: Request) {
    return this.auth.register(body, { ip: req.ip, userAgent: req.get('user-agent') });
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle(AUTH_ROUTE_THROTTLE)
  refresh(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput, @Req() req: Request) {
    return this.auth.refresh(body.refreshToken, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  @Post('logout')
  @AnyAuthenticated()
  @HttpCode(204)
  async logout(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput, @Req() req: Request) {
    await this.auth.logout(body.refreshToken, { ip: req.ip });
  }

  @Get('me')
  @AnyAuthenticated()
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Get('active-sessions')
  @DeskOnly()
  listActiveSessions() {
    return this.auth.listActiveSessions();
  }
}
