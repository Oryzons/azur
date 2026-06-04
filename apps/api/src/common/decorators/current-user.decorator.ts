import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@bleu-calanque/shared';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthUser;
  },
);
