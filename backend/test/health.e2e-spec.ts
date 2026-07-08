import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { HealthController } from '../src/modules/health/health.controller';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

/**
 * HTTP smoke test for the health endpoints. It boots just the HealthController wired to a
 * stubbed PrismaService (so it needs no Postgres/Redis and can run in CI), but reproduces the
 * exact HTTP setup from main.ts — global `api` prefix, ValidationPipe, AllExceptionsFilter —
 * so the assertions reflect how the app actually serves requests.
 */
async function createApp(prisma: Partial<PrismaService>): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [{ provide: PrismaService, useValue: prisma }],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}

describe('Health (e2e)', () => {
  describe('when the database is reachable', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await createApp({ $queryRaw: () => Promise.resolve([{ result: 1 }]) as never });
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /api/health → 200 liveness payload', async () => {
      const res = await request(app.getHttpServer()).get('/api/health').expect(200);
      expect(res.body.status).toBe('ok');
      expect(typeof res.body.uptime).toBe('number');
      expect(typeof res.body.timestamp).toBe('string');
    });

    it('GET /api/health/ready → 200 with db up', async () => {
      const res = await request(app.getHttpServer()).get('/api/health/ready').expect(200);
      expect(res.body).toEqual({ status: 'ok', db: 'up' });
    });

    it('GET / (no /api prefix) → 404, proving there is no root route', () => {
      return request(app.getHttpServer()).get('/').expect(404);
    });
  });

  describe('when the database is down', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await createApp({ $queryRaw: () => Promise.reject(new Error('connection refused')) as never });
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /api/health/ready → 503 (readiness fails)', () => {
      return request(app.getHttpServer()).get('/api/health/ready').expect(503);
    });
  });
});
