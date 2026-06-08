import { Module } from '@nestjs/common';
import { PingsGateway } from './pings.gateway';

@Module({
  providers: [PingsGateway],
  exports: [PingsGateway],
})
export class GatewayModule {}
