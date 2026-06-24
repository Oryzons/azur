import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { DeskOnly } from '../common/decorators/role-groups.decorator';
import { ExtraRentalsService } from './extra-rentals.service';
import { CreateExtraRentalDto, ExtraRentalListQueryDto, UpdateExtraRentalDto } from './extra-rentals.dto';

@Controller('extra-rentals')
export class ExtraRentalsController {
  constructor(private readonly service: ExtraRentalsService) {}

  @Get()
  @DeskOnly()
  list(@Query() query: ExtraRentalListQueryDto) {
    return this.service.list(query.extraId);
  }

  @Get(':id')
  @DeskOnly()
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Post()
  @DeskOnly()
  create(@Body() body: CreateExtraRentalDto) {
    return this.service.create(body);
  }

  @Put(':id')
  @DeskOnly()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateExtraRentalDto) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @DeskOnly()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
