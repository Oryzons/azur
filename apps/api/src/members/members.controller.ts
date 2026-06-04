import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { AdminManagerOnly, DeskOnly } from '../common/decorators/role-groups.decorator';
import { validateInput } from '../common/validation/validate-input';
import { nauticManagerImportBodySchema } from '@bleu-calanque/shared';
import { MemberCreditsService } from '../member-credits/member-credits.service';
import { MembersService } from './members.service';
import { CreateMemberDto, UpdateMemberDto } from './members.dto';

@Controller('members')
@DeskOnly()
export class MembersController {
  constructor(
    private readonly members: MembersService,
    private readonly memberCredits: MemberCreditsService,
  ) {}

  @Get()
  list() {
    return this.members.list();
  }

  /** Solde avoir disponible pour un client (membre lié et/ou email). */
  @Get('credits/available')
  async availableCredits(
    @Query('memberId') memberId?: string,
    @Query('email') email?: string,
  ) {
    const key = this.memberCredits.clientKey(memberId, email);
    const availableCents = await this.memberCredits.availableCreditsCents(
      key.memberId,
      key.clientEmail,
    );
    return { availableCents };
  }

  @Post()
  create(@Body() body: CreateMemberDto) {
    return this.members.create(body);
  }

  @Post('import/nautic-manager')
  @AdminManagerOnly()
  importNauticManager(@Body() body: unknown) {
    const input = validateInput(nauticManagerImportBodySchema, body);
    return this.members.importNauticManagerCsv(input.csv, input.dryRun ?? true);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateMemberDto) {
    return this.members.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.members.remove(id);
  }
}
