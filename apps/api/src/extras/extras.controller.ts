import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { DeskOnly } from '../common/decorators/role-groups.decorator';
import { ExtrasService } from './extras.service';
import { CreateExtraDto, UpdateExtraDto } from './extras.dto';

@Controller('extras')
@DeskOnly()
export class ExtrasController {
  constructor(private readonly extras: ExtrasService) {}

  @Get()
  list() {
    return this.extras.list();
  }

  @Post()
  create(@Body() body: CreateExtraDto) {
    return this.extras.create(body);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateExtraDto) {
    return this.extras.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.extras.remove(id);
  }
}
