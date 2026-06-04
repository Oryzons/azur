import { Global, Module } from '@nestjs/common';
import { EntityChecksService } from '../common/validation/entity-checks';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, EntityChecksService],
  exports: [PrismaService, EntityChecksService],
})
export class PrismaModule {}
