import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OwnerOnly } from '../common/decorators/role-groups.decorator';
import type { AuthUser } from '@bleu-calanque/shared';
import { UsersService } from '../users/users.service';
import { PutOwnerNotificationPreferencesDto } from './owner-portal.dto';
import { SettingsService } from './settings.service';

@Controller('owner')
@OwnerOnly()
export class OwnerPortalController {
  constructor(
    private readonly settings: SettingsService,
    private readonly users: UsersService,
  ) {}

  @Get('contact')
  getContact() {
    return this.settings.getOwnerContact();
  }

  @Get('notification-preferences')
  getNotificationPreferences(@CurrentUser() user: AuthUser) {
    return this.users.getOwnerNotificationPreferences(user.id);
  }

  @Put('notification-preferences')
  putNotificationPreferences(
    @CurrentUser() user: AuthUser,
    @Body() body: PutOwnerNotificationPreferencesDto,
  ) {
    return this.users.replaceOwnerNotificationPreferences(user.id, body);
  }
}
