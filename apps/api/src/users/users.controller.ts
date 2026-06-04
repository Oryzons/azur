import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AnyAuthenticated, DeskOnly } from '../common/decorators/role-groups.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  changePasswordSchema,
  createOwnerUserSchema,
  createStaffUserSchema,
  resetOwnerPortalPasswordSchema,
  updateProfileSchema,
  type AuthUser,
  type ChangePasswordInput,
  type CreateOwnerUserInput,
  type CreateStaffUserInput,
  type ResetOwnerPortalPasswordInput,
  type UpdateProfileInput,
  UserRole,
} from '@bleu-calanque/shared';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post('owner-portal')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(201)
  async createOwnerPortal(@Body(new ZodValidationPipe(createOwnerUserSchema)) body: CreateOwnerUserInput) {
    const row = await this.users.createOwnerPortalUser(body);
    return {
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role,
      ownerMemberId: row.ownerMemberId,
      isActive: row.isActive,
      mustChangePassword: row.mustChangePassword,
      createdAt: row.createdAt.toISOString(),
    };
  }

  @Patch('owner-portal/:memberId/password')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  async resetOwnerPortalPassword(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body(new ZodValidationPipe(resetOwnerPortalPasswordSchema)) body: ResetOwnerPortalPasswordInput,
  ) {
    const row = await this.users.resetOwnerPortalPassword(memberId, body);
    return {
      id: row.id,
      email: row.email,
      ownerMemberId: row.ownerMemberId,
      mustChangePassword: Boolean(row.mustChangePassword),
    };
  }

  @Post('staff')
  @Roles(UserRole.ADMIN)
  @HttpCode(201)
  async createStaff(@Body(new ZodValidationPipe(createStaffUserSchema)) body: CreateStaffUserInput) {
    const row = await this.users.createStaffUser(body);
    return {
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role,
      isActive: row.isActive,
      mustChangePassword: row.mustChangePassword,
      createdAt: row.createdAt.toISOString(),
    };
  }

  @Get('me')
  @AnyAuthenticated()
  async me(@CurrentUser() user: AuthUser) {
    const row = await this.users.me(user.id);
    return {
      ...user,
      civility: row.civility ?? null,
      phone: row.phone ?? null,
      birthDate: row.birthDate ? row.birthDate.toISOString() : null,
      nationality: row.nationality ?? null,
      address: row.address ?? null,
      city: row.city ?? null,
      postalCode: row.postalCode ?? null,
      country: row.country ?? null,
      company: row.company ?? null,
      avatarUrl: row.avatarUrl ?? null,
      mustChangePassword: Boolean(row.mustChangePassword),
    } satisfies AuthUser;
  }

  @Patch('me/password')
  @AnyAuthenticated()
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
  ) {
    const row = await this.users.changeMyPassword(user.id, body);
    return {
      ...user,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role as AuthUser['role'],
      isActive: row.isActive,
      mustChangePassword: Boolean(row.mustChangePassword),
    } satisfies AuthUser;
  }

  @Patch('me')
  @DeskOnly()
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ) {
    const row = await this.users.updateMe(user.id, body);
    return {
      ...user,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      civility: row.civility ?? null,
      phone: row.phone ?? null,
      birthDate: row.birthDate ? row.birthDate.toISOString() : null,
      nationality: row.nationality ?? null,
      address: row.address ?? null,
      city: row.city ?? null,
      postalCode: row.postalCode ?? null,
      country: row.country ?? null,
      company: row.company ?? null,
      avatarUrl: row.avatarUrl ?? null,
      role: row.role as AuthUser['role'],
      isActive: row.isActive,
      mustChangePassword: Boolean(row.mustChangePassword),
    } satisfies AuthUser;
  }
}

