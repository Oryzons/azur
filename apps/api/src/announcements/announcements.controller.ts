import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { DeskOnly } from '../common/decorators/role-groups.decorator';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './announcements.dto';

@Controller('announcements')
@DeskOnly()
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  list() {
    return this.announcements.list();
  }

  @Post()
  create(@Body() body: CreateAnnouncementDto) {
    return this.announcements.create(body);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateAnnouncementDto) {
    return this.announcements.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.remove(id);
  }
}
