import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { PrismaService } from '../database/prisma.service';
import { PingsService } from './pings.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
mockedAxios.isAxiosError = axios.isAxiosError;

function makePingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-uuid-1234',
    url: 'https://httpbin.org/anything',
    method: 'POST',
    payload: {},
    statusCode: 200,
    responseBody: {},
    responseTime: 142,
    success: true,
    errorMessage: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

function buildPrismaMock() {
  return {
    pingRecord: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

describe('PingsService', () => {
  let service: PingsService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PingsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def: unknown) => {
              const cfg: Record<string, unknown> = {
                'ping.url': 'https://httpbin.org/anything',
                'ping.timeoutMs': 10000,
              };
              return cfg[key] ?? def;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PingsService>(PingsService);
    jest.clearAllMocks();
  });

  describe('generatePayload()', () => {
    it('returns an object with all required top-level keys', () => {
      expect(service.generatePayload()).toMatchObject({
        requestId: expect.any(String),
        action: expect.any(String),
        resource: expect.any(String),
        environment: expect.any(String),
        timestamp: expect.any(String),
        metadata: expect.any(Object),
        data: expect.any(Object),
      });
    });

    it('produces a unique requestId on every call', () => {
      const ids = Array.from(
        { length: 20 },
        () => service.generatePayload().requestId,
      );
      expect(new Set(ids).size).toBe(20);
    });

    it('timestamp is a valid ISO 8601 string', () => {
      const { timestamp } = service.generatePayload();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('metadata has the expected shape', () => {
      const { metadata } = service.generatePayload();
      expect(metadata).toMatchObject({
        clientVersion: expect.stringMatching(/^\d+\.\d+\.\d+$/),
        region: expect.stringMatching(/^[a-z]+-[a-z]+-\d$/),
        priority: expect.stringMatching(/^(low|medium|high)$/),
        tags: expect.any(Array),
      });
      expect(metadata.tags.length).toBeGreaterThanOrEqual(1);
    });

    it('produces varied output across calls', () => {
      const payloads = Array.from({ length: 10 }, () =>
        service.generatePayload(),
      );
      const actions = new Set(payloads.map((p) => p.action));
      const resources = new Set(payloads.map((p) => p.resource));
      expect(actions.size + resources.size).toBeGreaterThan(2);
    });
  });

  describe('executePing() — success', () => {
    beforeEach(() => {
      mockedAxios.post = jest.fn().mockResolvedValue({ status: 200, data: {} });
      prisma.pingRecord.create.mockResolvedValue(makePingRecord());
    });

    it('resolves with the persisted record', async () => {
      const record = await service.executePing();
      expect(record.success).toBe(true);
    });

    it('posts to the configured URL with JSON content-type', async () => {
      await service.executePing();
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://httpbin.org/anything',
        expect.any(Object),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('persists success=true and the HTTP status code', async () => {
      await service.executePing();
      const { data } = prisma.pingRecord.create.mock.calls[0][0];
      expect(data.success).toBe(true);
      expect(data.statusCode).toBe(200);
    });

    it('records a non-negative responseTime', async () => {
      await service.executePing();
      const { data } = prisma.pingRecord.create.mock.calls[0][0];
      expect(data.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('stores the generated payload in the DB record', async () => {
      const fixed = service.generatePayload();
      jest.spyOn(service, 'generatePayload').mockReturnValue(fixed);

      await service.executePing();

      const { data } = prisma.pingRecord.create.mock.calls[0][0];
      expect(data.payload).toEqual(fixed);
    });
  });

  describe('executePing() — failure', () => {
    it('persists success=false with errorMessage on network error', async () => {
      const err = Object.assign(new Error('Network Error'), {
        isAxiosError: true,
        response: undefined,
      });
      mockedAxios.post = jest.fn().mockRejectedValue(err);
      mockedAxios.isAxiosError = jest.fn().mockReturnValue(true);
      prisma.pingRecord.create.mockResolvedValue(
        makePingRecord({ success: false, statusCode: null }),
      );

      const record = await service.executePing();

      expect(record.success).toBe(false);
      const { data } = prisma.pingRecord.create.mock.calls[0][0];
      expect(data.errorMessage).toBe('Network Error');
    });

    it('captures the HTTP status code from a 5xx response', async () => {
      const err = Object.assign(new Error('Service Unavailable'), {
        isAxiosError: true,
        response: { status: 503, data: {} },
      });
      mockedAxios.post = jest.fn().mockRejectedValue(err);
      mockedAxios.isAxiosError = jest.fn().mockReturnValue(true);
      prisma.pingRecord.create.mockResolvedValue(
        makePingRecord({ success: false, statusCode: 503 }),
      );

      await service.executePing();

      const { data } = prisma.pingRecord.create.mock.calls[0][0];
      expect(data.statusCode).toBe(503);
    });

    it('handles non-Axios errors without re-throwing', async () => {
      mockedAxios.post = jest.fn().mockRejectedValue(new Error('Unexpected'));
      mockedAxios.isAxiosError = jest.fn().mockReturnValue(false);
      prisma.pingRecord.create.mockResolvedValue(
        makePingRecord({ success: false }),
      );

      await expect(service.executePing()).resolves.toBeDefined();

      const { data } = prisma.pingRecord.create.mock.calls[0][0];
      expect(data.errorMessage).toBe('Unexpected');
    });
  });

  describe('getHistory()', () => {
    it('returns correct pagination metadata', async () => {
      const records = [makePingRecord(), makePingRecord({ id: 'rec-2' })];
      prisma.$transaction.mockResolvedValue([records, 42]);

      const result = await service.getHistory(2, 20);

      expect(result).toMatchObject({
        data: records,
        total: 42,
        page: 2,
        pageSize: 20,
        totalPages: 3,
      });
    });

    it('defaults to page=1, pageSize=20', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);

      const result = await service.getHistory();

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('calculates totalPages correctly', async () => {
      prisma.$transaction.mockResolvedValue([[], 40]);
      expect((await service.getHistory(1, 20)).totalPages).toBe(2);
    });

    it('returns totalPages=0 when there are no records', async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);
      expect((await service.getHistory()).totalPages).toBe(0);
    });
  });

  describe('getStats()', () => {
    it('calculates successRate and failed count', async () => {
      prisma.$transaction.mockResolvedValue([
        100,
        75,
        {
          _avg: { responseTime: 250 },
          _min: { responseTime: 80 },
          _max: { responseTime: 600 },
        },
      ]);

      const stats = await service.getStats();
      expect(stats.successRate).toBe(75);
      expect(stats.failed).toBe(25);
    });

    it('rounds avgResponseTime to nearest ms', async () => {
      prisma.$transaction.mockResolvedValue([
        10,
        10,
        {
          _avg: { responseTime: 123.7 },
          _min: { responseTime: 100 },
          _max: { responseTime: 150 },
        },
      ]);

      expect((await service.getStats()).avgResponseTime).toBe(124);
    });

    it('returns null aggregates when there are no successful pings', async () => {
      prisma.$transaction.mockResolvedValue([
        5,
        0,
        {
          _avg: { responseTime: null },
          _min: { responseTime: null },
          _max: { responseTime: null },
        },
      ]);

      const stats = await service.getStats();
      expect(stats.avgResponseTime).toBeNull();
    });

    it('returns successRate=0 when total=0', async () => {
      prisma.$transaction.mockResolvedValue([
        0,
        0,
        {
          _avg: { responseTime: null },
          _min: { responseTime: null },
          _max: { responseTime: null },
        },
      ]);

      expect((await service.getStats()).successRate).toBe(0);
    });
  });
});
