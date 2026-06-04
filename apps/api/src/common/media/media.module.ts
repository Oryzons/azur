import { Global, Module } from '@nestjs/common';
import { SecureMediaService } from './secure-media.service';

@Global()
@Module({
  providers: [SecureMediaService],
  exports: [SecureMediaService],
})
export class MediaModule {}
