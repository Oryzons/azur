import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DeskOnly, ReservationsRead } from '../common/decorators/role-groups.decorator';
import type { AuthUser } from '@bleu-calanque/shared';
import { CatalogService } from './catalog.service';
import { CreateBoatDto, CreateFleetDto, PatchBoatDepositDto, UpdateBoatDto, UpdateFleetDto } from './dto';

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('fleets')
  @ReservationsRead()
  listFleets() {
    return this.catalog.listFleets();
  }

  @Post('fleets')
  @DeskOnly()
  createFleet(@Body() body: CreateFleetDto) {
    return this.catalog.createFleet(body);
  }

  @Patch('fleets/:id')
  @DeskOnly()
  updateFleet(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateFleetDto) {
    return this.catalog.updateFleet(id, body);
  }

  @Delete('fleets/:id')
  @DeskOnly()
  deleteFleet(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deleteFleet(id);
  }

  @Get('boats')
  @ReservationsRead()
  listBoats(@CurrentUser() user: AuthUser) {
    return this.catalog.listBoats(user);
  }

  @Post('boats')
  @DeskOnly()
  createBoat(@Body() body: CreateBoatDto) {
    return this.catalog.createBoat(body);
  }

  @Patch('boats/:id')
  @DeskOnly()
  updateBoat(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateBoatDto) {
    return this.catalog.updateBoat(id, body);
  }

  @Patch('boats/:id/deposit')
  @DeskOnly()
  patchBoatDeposit(@Param('id', ParseUUIDPipe) id: string, @Body() body: PatchBoatDepositDto) {
    return this.catalog.patchBoatDeposit(id, body.depositAmountCents);
  }

  @Delete('boats/:id')
  @DeskOnly()
  deleteBoat(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deleteBoat(id);
  }
}
