import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AnalyticsService } from '../analytics/analytics.service';
import { PingsGateway } from '../gateway/pings.gateway';
import { PingsService } from '../pings/pings.service';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly pingsService: PingsService,
    private readonly pingsGateway: PingsGateway,
    private readonly analyticsService: AnalyticsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const expression = this.config.get<string>('ping.cron', '*/5 * * * *');

    const job = new CronJob(expression, async () => {
      this.logger.log('Scheduled ping triggered');
      try {
        const record = await this.pingsService.executePing();
        this.pingsGateway.broadcastNewPing(record);

        const analytics = await this.analyticsService.getAnalytics(1);
        if (
          this.analyticsService.isRecordAnomalous(record, analytics.windowStats)
        ) {
          this.pingsGateway.broadcastAnomaly(record);
        }
      } catch (err) {
        this.logger.error(
          'Unhandled error in scheduled ping',
          err instanceof Error ? err.stack : err,
        );
      }
    });

    this.schedulerRegistry.addCronJob('scheduled-ping', job);
    job.start();

    this.logger.log(`Scheduler started — cron: "${expression}"`);
  }
}
