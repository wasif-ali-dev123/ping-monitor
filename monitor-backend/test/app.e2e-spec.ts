import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { PingsGateway } from '../src/gateway/pings.gateway';
import { PingsService } from '../src/pings/pings.service';
import { SchedulerService } from '../src/scheduler/scheduler.service';

function makePingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'abc-uuid',
    url: 'https://httpbin.org/anything',
    method: 'POST',
    payload: {},
    statusCode: 200,
    responseBody: {},
    responseTime: 130,
    success: true,
    errorMessage: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Pings API (e2e)', () => {
  let app: INestApplication;
  let pingsService: jest.Mocked<PingsService>;
  let pingsGateway: jest.Mocked<PingsGateway>;

  beforeAll(async () => {
    const mockPingsService = {
      getHistory: jest.fn(),
      getById: jest.fn(),
      getStats: jest.fn(),
      executePing: jest.fn(),
      generatePayload: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .overrideProvider(PingsService)
      .useValue(mockPingsService)
      .overrideProvider(PingsGateway)
      .useValue({ broadcastNewPing: jest.fn(), server: null })
      .overrideProvider(SchedulerService)
      .useValue({ onModuleInit: jest.fn() })
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.getHttpAdapter().get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    await app.init();

    pingsService = module.get(PingsService);
    pingsGateway = module.get(PingsGateway);
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  describe('GET /health', () => {
    it('returns 200 with status=ok', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('GET /api/pings', () => {
    const mockHistory = {
      data: [makePingRecord()],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    };

    beforeEach(() =>
      pingsService.getHistory.mockResolvedValue(mockHistory as never),
    );

    it('returns 200 with paginated data', async () => {
      const res = await request(app.getHttpServer()).get('/api/pings');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('forwards page and pageSize to the service', async () => {
      await request(app.getHttpServer()).get('/api/pings?page=3&pageSize=5');
      expect(pingsService.getHistory).toHaveBeenCalledWith(3, 5);
    });

    it('defaults to page=1 and pageSize=20', async () => {
      await request(app.getHttpServer()).get('/api/pings');
      expect(pingsService.getHistory).toHaveBeenCalledWith(1, 20);
    });

    it('rejects pageSize > 100 with 400', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/pings?pageSize=9999',
      );
      expect(res.status).toBe(400);
    });

    it('rejects page=0 with 400', async () => {
      const res = await request(app.getHttpServer()).get('/api/pings?page=0');
      expect(res.status).toBe(400);
    });

    it('returns 500 when the service throws', async () => {
      pingsService.getHistory.mockRejectedValueOnce(new Error('DB error'));
      const res = await request(app.getHttpServer()).get('/api/pings');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/pings/stats', () => {
    it('returns 200 with the stats object', async () => {
      const stats = {
        total: 100,
        successful: 95,
        failed: 5,
        successRate: 95,
        avgResponseTime: 200,
        minResponseTime: 80,
        maxResponseTime: 600,
      };
      pingsService.getStats.mockResolvedValue(stats);

      const res = await request(app.getHttpServer()).get('/api/pings/stats');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject(stats);
    });
  });

  describe('GET /api/pings/:id', () => {
    it('returns 200 with the record when found', async () => {
      pingsService.getById.mockResolvedValue(
        makePingRecord({ id: 'some-uuid' }) as never,
      );

      const res = await request(app.getHttpServer()).get(
        '/api/pings/some-uuid',
      );
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('some-uuid');
    });

    it('returns 404 when the record does not exist', async () => {
      pingsService.getById.mockResolvedValue(null);
      expect(
        (await request(app.getHttpServer()).get('/api/pings/nonexistent'))
          .status,
      ).toBe(404);
    });
  });

  describe('POST /api/pings/trigger', () => {
    it('returns 201, the record, and broadcasts to connected clients', async () => {
      const record = makePingRecord({ id: 'new-uuid' });
      pingsService.executePing.mockResolvedValue(record as never);

      const res = await request(app.getHttpServer()).post('/api/pings/trigger');
      expect(res.status).toBe(201);
      expect(res.body.id).toBe('new-uuid');
      expect(pingsGateway.broadcastNewPing).toHaveBeenCalledWith(record);
    });
  });

  describe('unknown routes', () => {
    it('returns 404', async () => {
      expect(
        (await request(app.getHttpServer()).get('/api/unknown')).status,
      ).toBe(404);
    });
  });
});
