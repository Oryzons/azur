import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { canAccessDeskApi, type AuthUser, UserRole } from '@bleu-calanque/shared';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) throw new ForbiddenException();

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (roles?.length) {
      if (!roles.includes(user.role as UserRole)) {
        throw new ForbiddenException('Permissions insuffisantes pour cette action.');
      }
      return true;
    }

    // Sans @Roles explicite : accès bureau uniquement (AGENT interdit).
    if (!canAccessDeskApi(user.role)) {
      throw new ForbiddenException('Accès réservé au back-office.');
    }
    return true;
  }
}
