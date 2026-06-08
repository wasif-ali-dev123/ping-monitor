import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { Prisma, PingRecord } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  generatePayload,
  GeneratedPayload,
} from '../common/utils/payload-generator.util';

export interface PaginatedPings {
  data: PingRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PingStats {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  avgResponseTime: number | null;
  minResponseTime: number | null;
  maxResponseTime: number | null;
}

@Injectable()
export class PingsService {
  private readonly logger = new Logger(PingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  generatePayload(): GeneratedPayload {
    return generatePayload();
  }

  async executePing(): Promise<PingRecord> {
    const url = this.config.get<string>(
      'ping.url',
      'https://httpbin.org/anything',
    );
    const timeoutMs = this.config.get<number>('ping.timeoutMs', 10000);
    const payload = this.generatePayload();
    const startedAt = Date.now();

    this.logger.log(`Pinging ${url} [${payload.requestId}]`);

    try {
      const response = await axios.post(url, payload, {
        timeout: timeoutMs,
        headers: { 'Content-Type': 'application/json' },
      });

      const responseTime = Date.now() - startedAt;
      const record = await this.save({
        url,
        payload,
        statusCode: response.status,
        responseBody: response.data as Record<string, unknown>,
        responseTime,
        success: true,
      });

      this.logger.log(
        `Ping OK ${response.status} — ${responseTime}ms [${record.id}]`,
      );
      return record;
    } catch (err) {
      const responseTime = Date.now() - startedAt;
      const { statusCode, errorMessage, responseBody } = this.extractError(err);

      const record = await this.save({
        url,
        payload,
        statusCode,
        responseBody,
        responseTime,
        success: false,
        errorMessage,
      });

      this.logger.warn(
        `Ping failed: ${errorMessage} (${statusCode ?? 'no-status'}) [${record.id}]`,
      );
      return record;
    }
  }

  async getHistory(page = 1, pageSize = 20): Promise<PaginatedPings> {
    const skip = (page - 1) * pageSize;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.pingRecord.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.pingRecord.count(),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getById(id: string): Promise<PingRecord | null> {
    return this.prisma.pingRecord.findUnique({ where: { id } });
  }

  async getStats(): Promise<PingStats> {
    const [total, successful, agg] = await this.prisma.$transaction([
      this.prisma.pingRecord.count(),
      this.prisma.pingRecord.count({ where: { success: true } }),
      this.prisma.pingRecord.aggregate({
        _avg: { responseTime: true },
        _min: { responseTime: true },
        _max: { responseTime: true },
        where: { success: true },
      }),
    ]);

    const failed = total - successful;
    return {
      total,
      successful,
      failed,
      successRate:
        total > 0 ? parseFloat(((successful / total) * 100).toFixed(2)) : 0,
      avgResponseTime: agg._avg.responseTime
        ? Math.round(agg._avg.responseTime)
        : null,
      minResponseTime: agg._min.responseTime,
      maxResponseTime: agg._max.responseTime,
    };
  }

  private async save(data: {
    url: string;
    payload: GeneratedPayload;
    statusCode: number | null;
    responseBody: Record<string, unknown> | null;
    responseTime: number;
    success: boolean;
    errorMessage?: string;
  }): Promise<PingRecord> {
    return this.prisma.pingRecord.create({
      data: {
        url: data.url,
        method: 'POST',
        payload: data.payload as unknown as Prisma.InputJsonValue,
        statusCode: data.statusCode,
        responseBody: data.responseBody as Prisma.InputJsonValue | undefined,
        responseTime: data.responseTime,
        success: data.success,
        errorMessage: data.errorMessage,
      },
    });
  }

  private extractError(err: unknown): {
    statusCode: number | null;
    errorMessage: string;
    responseBody: Record<string, unknown> | null;
  } {
    if (axios.isAxiosError(err)) {
      const e = err as AxiosError;
      return {
        statusCode: e.response?.status ?? null,
        errorMessage: e.message,
        responseBody: e.response?.data
          ? (e.response.data as Record<string, unknown>)
          : null,
      };
    }
    return {
      statusCode: null,
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
      responseBody: null,
    };
  }
}
