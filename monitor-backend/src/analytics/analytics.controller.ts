import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { AnalyticsService } from './analytics.service';

class AnalyticsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  window: number = 1;
}

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  getAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getAnalytics(query.window);
  }
}
