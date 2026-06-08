import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalyticsModule } from '../analytics/analytics.module';
import { GatewayModule } from '../gateway/gateway.module';
import { PingsModule } from '../pings/pings.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [ScheduleModule.forRoot(), PingsModule, GatewayModule, AnalyticsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
