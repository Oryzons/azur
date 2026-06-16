import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ComptabiliteOrDesk, DeskOnly } from '../common/decorators/role-groups.decorator';
import { ExtrasService } from './extras.service';
import { CreateExtraDto, ExtraAvailabilityQueryDto, UpdateExtraDto } from './extras.dto';

@Controller('extras')
export class ExtrasController {
  constructor(private readonly extras: ExtrasService) {}

  @Get()
  @ComptabiliteOrDesk()
  list() {
    return this.extras.list();
  }

  @Get('availability')
  @DeskOnly()
  availability(@Query() query: ExtraAvailabilityQueryDto) {
    return this.extras.getAvailability(query);
  }

  @Post()
  @DeskOnly()
  create(@Body() body: CreateExtraDto) {
    return this.extras.create(body);
  }

  @Put(':id')
  @DeskOnly()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateExtraDto) {
    return this.extras.update(id, body);
  }

  @Delete(':id')
  @DeskOnly()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.extras.remove(id);
  }
}
