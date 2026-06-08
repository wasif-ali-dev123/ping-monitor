import { Injectable } from '@nestjs/common';
import { PingRecord } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface RollingStats {
  mean: number;
  stdDev: number;
  count: number;
}

export interface ForecastPoint {
  value: number;
  low: number;
  high: number;
}

export interface AnalyticsPoint {
  t: string;
  responseTime: number;
  isAnomaly: boolean;
  rollingMean: number;
}

export interface AnalyticsResult {
  windowHours: number;
  windowStats: RollingStats;
  forecast: ForecastPoint;
  recentPoints: AnalyticsPoint[];
  anomalies: PingRecord[];
}

/*
 * Anomaly detection: z-score with σ floored at 50 ms.
 * z = |x − μ| / max(σ, 50). Flagged when z > 2.5.
 * Failed pings are unconditionally anomalous.
 *
 * Forecasting: EWMA with α = 0.3 over the selected window.
 * Chosen over linear regression because response time reverts
 * to a baseline rather than trending. α = 0.3 weights ~10
 * recent observations meaningfully without over-reacting to spikes.
 * Confidence band = forecast ± 1.5 × σ.
 */

function rollingStats(values: number[]): RollingStats {
  if (values.length === 0) return { mean: 0, stdDev: 0, count: 0 };
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return { mean: Math.round(mean), stdDev: Math.round(Math.sqrt(variance)), count: values.length };
}

function ewma(values: number[], alpha = 0.3): number {
  return values.reduce((s, v, i) => (i === 0 ? v : alpha * v + (1 - alpha) * s));
}

function isAnomaly(responseTime: number, stats: RollingStats): boolean {
  const sigma = Math.max(stats.stdDev, 50);
  return Math.abs(responseTime - stats.mean) / sigma > 2.5;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics(windowHours = 1): Promise<AnalyticsResult> {
    const now = new Date();
    const since = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

    const records = await this.prisma.pingRecord.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });

    const successful = records.filter((r) => r.success);
    const windowStats = rollingStats(successful.map((r) => r.responseTime));

    const forecastValue =
      successful.length > 0 ? ewma(successful.map((r) => r.responseTime)) : windowStats.mean;
    const sigma = Math.max(windowStats.stdDev, 50);
    const forecast: ForecastPoint = {
      value: Math.round(forecastValue),
      low: Math.round(forecastValue - 1.5 * sigma),
      high: Math.round(forecastValue + 1.5 * sigma),
    };

    const chartRecords = records.slice(-60);
    const recentPoints: AnalyticsPoint[] = chartRecords.map((r) => ({
      t: r.createdAt.toISOString(),
      responseTime: r.responseTime,
      isAnomaly: !r.success || isAnomaly(r.responseTime, windowStats),
      rollingMean: windowStats.mean,
    }));

    const anomalies = records.filter(
      (r) => !r.success || isAnomaly(r.responseTime, windowStats),
    );

    return { windowHours, windowStats, forecast, recentPoints, anomalies };
  }

  isRecordAnomalous(record: PingRecord, stats: RollingStats): boolean {
    return !record.success || isAnomaly(record.responseTime, stats);
  }
}
