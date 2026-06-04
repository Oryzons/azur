import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DeskOrOwner } from '../common/decorators/role-groups.decorator';
import type { AuthUser } from '@bleu-calanque/shared';
import { BoatUnavailabilitiesService } from './boat-unavailabilities.service';

@Controller('boat-unavailabilities')
export class BoatUnavailabilitiesController {
  constructor(private readonly service: BoatUnavailabilitiesService) {}

  @Get()
  @DeskOrOwner()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user);
  }

  @Post()
  @DeskOrOwner()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.service.create(user, body);
  }

  @Put(':id')
  @DeskOrOwner()
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.service.update(user, id, body);
  }

  @Delete(':id')
  @DeskOrOwner()
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(user, id);
  }
}
