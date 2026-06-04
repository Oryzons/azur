import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  AdminManagerOnly,
  DeskOnly,
  ReservationsRead,
  TabletAgent,
} from '../common/decorators/role-groups.decorator';
import { CheckFlowKind } from '@prisma/client';
import { type AuthUser } from '@bleu-calanque/shared';
import { CheckFlowService } from './check-flow.service';

@Controller('check-flow')
export class CheckFlowController {
  constructor(private readonly checkFlow: CheckFlowService) {}

  @Get('settings')
  @AdminManagerOnly()
  getSettings() {
    return this.checkFlow.getSettings();
  }

  @Put('settings')
  @AdminManagerOnly()
  updateSettings(@Body() body: unknown) {
    return this.checkFlow.updateSettings(body);
  }

  @Get('questions')
  @ReservationsRead()
  listQuestions(@Query('kind') kind: CheckFlowKind, @Query('all') all?: string) {
    if (!kind || !['CHECK_IN', 'CHECK_OUT'].includes(kind)) {
      return [];
    }
    if (all === '1' || all === 'true') {
      return this.checkFlow.listQuestionsAdmin(kind);
    }
    return this.checkFlow.listQuestions(kind);
  }

  @Put('questions')
  @AdminManagerOnly()
  syncQuestions(@Body() body: unknown) {
    return this.checkFlow.syncQuestions(body);
  }

  @Get('submissions')
  @DeskOnly()
  listSubmissions(
    @Query('kind') kind?: CheckFlowKind,
    @Query('reservationId') reservationId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.checkFlow.listSubmissions({
      kind,
      reservationId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('submissions/:id')
  @ReservationsRead()
  getSubmission(@Param('id', ParseUUIDPipe) id: string) {
    return this.checkFlow.getSubmission(id);
  }

  @Get('reservations/:reservationId/status')
  @ReservationsRead()
  reservationStatus(@Param('reservationId', ParseUUIDPipe) reservationId: string) {
    return this.checkFlow.getReservationStatus(reservationId);
  }

  @Post('submissions')
  @TabletAgent()
  submit(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.checkFlow.submit(body, user.id);
  }

  @Patch('submissions/:id')
  @TabletAgent()
  updateSubmission(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.checkFlow.updateSubmission(id, body, user.id);
  }

  @Get('tablet/reservations')
  @TabletAgent()
  tabletReservations(@Query('day') day?: string) {
    const d = day ? new Date(day) : new Date();
    return this.checkFlow.listTabletReservations(d);
  }
}
