import { Module } from '@nestjs/common';
import { MemberCreditsModule } from '../member-credits/member-credits.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  imports: [MemberCreditsModule],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}
