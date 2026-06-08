import { Module } from '@nestjs/common';
import { GatewayModule } from '../gateway/gateway.module';
import { PingsController } from './pings.controller';
import { PingsService } from './pings.service';

@Module({
  imports: [GatewayModule],
  providers: [PingsService],
  controllers: [PingsController],
  exports: [PingsService],
})
export class PingsModule {}
