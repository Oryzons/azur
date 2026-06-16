import { Module, forwardRef } from '@nestjs/common';
import { RentalContractsService } from './rental-contracts.service';
import { PublicRentalContractsController } from './public-rental-contracts.controller';
import { ResendMailService } from '../notifications/resend-mail.service';
import { HtmlToPdfService } from './html-to-pdf.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { MediaModule } from '../common/media/media.module';
import { MemberCreditsModule } from '../member-credits/member-credits.module';

@Module({
  imports: [forwardRef(() => NotificationsModule), MemberCreditsModule, MediaModule],
  controllers: [PublicRentalContractsController],
  providers: [RentalContractsService, ResendMailService, HtmlToPdfService],
  exports: [RentalContractsService, HtmlToPdfService],
})
export class RentalContractsModule {}
