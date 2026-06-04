import { Module } from '@nestjs/common';
import { CheckFlowController } from './check-flow.controller';
import { CheckFlowService } from './check-flow.service';
@Module({
  controllers: [CheckFlowController],
  providers: [CheckFlowService],
  exports: [CheckFlowService],
})
export class CheckFlowModule {}
