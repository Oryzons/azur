import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';
import { validateEnv } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CatalogModule } from './catalog/catalog.module';
import { ExtrasModule } from './extras/extras.module';
import { MembersModule } from './members/members.module';
import { CouponsModule } from './coupons/coupons.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { PricingModule } from './pricing/pricing.module';
import { SettingsModule } from './settings/settings.module';
import { ReservationsModule } from './reservations/reservations.module';
import { MediaModule } from './common/media/media.module';
import { AuditModule } from './common/audit/audit.module';
import { CheckFlowModule } from './check-flow/check-flow.module';
import { InternalNotificationsModule } from './internal-notifications/internal-notifications.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OwnerScopeModule } from './common/auth/owner-scope.module';
import { BoatUnavailabilitiesModule } from './boat-unavailabilities/boat-unavailabilities.module';
import { RentalContractsModule } from './rental-contracts/rental-contracts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '..', '.env'),
      validate: validateEnv,
    }),
    AuditModule,
    MediaModule,
    PrismaModule,
    OwnerScopeModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    ExtrasModule,
    MembersModule,
    CouponsModule,
    AnnouncementsModule,
    PricingModule,
    SettingsModule,
    ReservationsModule,
    BoatUnavailabilitiesModule,
    InternalNotificationsModule,
    NotificationsModule,
    RentalContractsModule,
    CheckFlowModule,
  ],
})
export class AppModule {}
