import { Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DeskOrOwner } from '../common/decorators/role-groups.decorator';
import type { AuthUser } from '@bleu-calanque/shared';
import { InternalNotificationsService } from './internal-notifications.service';

@Controller('internal-notifications')
@DeskOrOwner()
export class InternalNotificationsController {
  constructor(private readonly notifications: InternalNotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('since') since?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.list(user, {
      since: since ? new Date(since) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(user, id);
  }

  @Delete()
  clearAll(@CurrentUser() user: AuthUser) {
    return this.notifications.clearAll(user);
  }
}
