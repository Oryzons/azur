import { Module } from '@nestjs/common';
import { MemberCreditsService } from './member-credits.service';

@Module({
  providers: [MemberCreditsService],
  exports: [MemberCreditsService],
})
export class MemberCreditsModule {}
