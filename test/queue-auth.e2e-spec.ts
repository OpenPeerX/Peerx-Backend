import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';

import { QueueController } from '../src/queue/queue.controller';
import { QueueAdminController } from '../src/queue/queue-admin.controller';
import { QueueService } from '../src/queue/queue.service';
import { QueueMonitoringService } from '../src/queue/queue-monitoring.service';
import { SchedulerService } from '../src/queue/scheduler.service';
import { ExponentialBackoffService } from '../src/queue/exponential-backoff.service';
import { DeadLetterQueueService } from '../src/queue/dead-letter-queue.service';
import { QueueAnalyticsService } from '../src/queue/queue-analytics.service';
import { RoleService } from '../src/identity/roles/services/role.service';
import { UserRole } from '../src/identity/roles/enums/user-role.enum';
import type { JwtPayload } from '../src/auth/guards/jwt-auth.guard';

const TEST_JWT_SECRET = 'queue-auth-e2e-secret';

describe('Queue admin authorization (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: TEST_JWT_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [QueueController, QueueAdminController],
      providers: [
        RoleService,
        { provide: QueueService, useValue: mockQueueService },
        { provide: QueueMonitoringService, useValue: mockMonitoringService },
        { provide: SchedulerService, useValue: mockSchedulerService },
        { provide: ExponentialBackoffService, useValue: mockBackoffService },
        { provide: DeadLetterQueueService, useValue: mockDlqService },
        { provide: QueueAnalyticsService, useValue: mockAnalyticsService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  const signAccessToken = (
    overrides: Partial<JwtPayload> = {},
  ): Promise<string> =>
    jwtService.signAsync({
      sub: 'auth-1',
      userId: 'user-1',
      email: 'user@example.com',
      role: UserRole.USER,
      roles: [UserRole.USER],
      sessionId: 'session-1',
      type: 'access',
      ...overrides,
    });

  const adminToken = () =>
    signAccessToken({ role: UserRole.ADMIN, roles: [UserRole.ADMIN] });
  const userToken = () => signAccessToken();
  const superAdminToken = () =>
    signAccessToken({
      role: UserRole.SUPER_ADMIN,
      roles: [UserRole.SUPER_ADMIN],
    });

  describe('api/admin/queue/* — admin-only', () => {
    const adminRoutes = [
      { method: 'get' as const, path: '/api/admin/queue/dashboard' },
      { method: 'get' as const, path: '/api/admin/queue/metrics/all' },
      { method: 'get' as const, path: '/api/admin/queue/health/all' },
      { method: 'get' as const, path: '/api/admin/queue/dlq-stats' },
      { method: 'get' as const, path: '/api/admin/queue/retry-policies' },
      {
        method: 'post' as const,
        path: '/api/admin/queue/control/notifications/pause',
      },
      {
        method: 'delete' as const,
        path: '/api/admin/queue/control/notifications',
      },
      {
        method: 'post' as const,
        path: '/api/admin/queue/dlq/notifications/job-1/recover',
      },
      {
        method: 'delete' as const,
        path: '/api/admin/queue/dlq/notifications',
      },
    ];

    it.each(adminRoutes)(
      'rejects unauthenticated $method $path with 401',
      async ({ method, path }) => {
        await request(app.getHttpServer())[method](path).expect(401);
      },
    );

    it.each(adminRoutes)(
      'rejects authenticated non-admin $method $path with 403',
      async ({ method, path }) => {
        await request(app.getHttpServer())
          [method](path)
          .set('Authorization', `Bearer ${await userToken()}`)
          .expect(403);
      },
    );

    it('rejects authenticated non-admin destructive route with 403', async () => {
      await request(app.getHttpServer())
        .delete('/api/admin/queue/control/notifications')
        .set('Authorization', `Bearer ${await userToken()}`)
        .expect(403);
    });

    it('allows authenticated admin to pause a queue (200)', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/queue/control/notifications/pause')
        .set('Authorization', `Bearer ${await adminToken()}`)
        .expect(200);
    });

    it('allows authenticated admin to empty a queue (200)', async () => {
      await request(app.getHttpServer())
        .delete('/api/admin/queue/control/notifications')
        .set('Authorization', `Bearer ${await adminToken()}`)
        .expect(200);
    });

    it('allows SUPER_ADMIN through the same admin check', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/queue/control/notifications/pause')
        .set('Authorization', `Bearer ${await superAdminToken()}`)
        .expect(200);
    });
  });

  describe('api/queue/* — reads authenticated, mutations admin-only', () => {
    it('rejects unauthenticated read of metrics with 401', async () => {
      await request(app.getHttpServer()).get('/api/queue/metrics').expect(401);
    });

    it('rejects unauthenticated health check with 401', async () => {
      await request(app.getHttpServer()).get('/api/queue/health').expect(401);
    });

    it('allows any authenticated user to read metrics (200)', async () => {
      await request(app.getHttpServer())
        .get('/api/queue/metrics')
        .set('Authorization', `Bearer ${await userToken()}`)
        .expect(200);
    });

    it('allows any authenticated user to read health (200)', async () => {
      await request(app.getHttpServer())
        .get('/api/queue/health')
        .set('Authorization', `Bearer ${await userToken()}`)
        .expect(200);
    });

    it('rejects unauthenticated job retry with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/queue/jobs/notifications/job-1/retry')
        .expect(401);
    });

    it('rejects non-admin job retry with 403', async () => {
      await request(app.getHttpServer())
        .post('/api/queue/jobs/notifications/job-1/retry')
        .set('Authorization', `Bearer ${await userToken()}`)
        .expect(403);
    });

    it('rejects non-admin job removal with 403', async () => {
      await request(app.getHttpServer())
        .delete('/api/queue/jobs/notifications/job-1')
        .set('Authorization', `Bearer ${await userToken()}`)
        .expect(403);
    });

    it('allows admin to retry a job (201)', async () => {
      await request(app.getHttpServer())
        .post('/api/queue/jobs/notifications/job-1/retry')
        .set('Authorization', `Bearer ${await adminToken()}`)
        .expect(201);
    });

    it('allows admin to remove a job (200)', async () => {
      await request(app.getHttpServer())
        .delete('/api/queue/jobs/notifications/job-1')
        .set('Authorization', `Bearer ${await adminToken()}`)
        .expect(200);
    });

    it('rejects unauthenticated test endpoint with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/queue/test/notification')
        .send({ userId: 'u1', message: 'hello' })
        .expect(401);
    });

    it('rejects non-admin test endpoint with 403', async () => {
      await request(app.getHttpServer())
        .post('/api/queue/test/notification')
        .set('Authorization', `Bearer ${await userToken()}`)
        .send({ userId: 'u1', message: 'hello' })
        .expect(403);
    });

    it('allows admin to queue a test notification (201)', async () => {
      await request(app.getHttpServer())
        .post('/api/queue/test/notification')
        .set('Authorization', `Bearer ${await adminToken()}`)
        .send({ userId: 'u1', message: 'hello' })
        .expect(201);
    });
  });

  describe('Invalid tokens', () => {
    it('rejects a malformed bearer token with 401', async () => {
      await request(app.getHttpServer())
        .get('/api/queue/metrics')
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401);
    });

    it('rejects a refresh-type token with 401', async () => {
      const refresh = await signAccessToken({ type: 'refresh' });
      await request(app.getHttpServer())
        .get('/api/queue/metrics')
        .set('Authorization', `Bearer ${refresh}`)
        .expect(401);
    });
  });
});

// ─── Service mocks (only methods exercised by the tested routes) ─────────────

const mockQueueService = {
  pauseQueue: jest.fn().mockResolvedValue(undefined),
  resumeQueue: jest.fn().mockResolvedValue(undefined),
  emptyQueue: jest.fn().mockResolvedValue(undefined),
  getQueueJobCount: jest.fn().mockResolvedValue(0),
  waitUntilEmpty: jest.fn().mockResolvedValue(undefined),
  retryJob: jest.fn().mockResolvedValue(undefined),
  removeJob: jest.fn().mockResolvedValue(undefined),
  addNotificationJob: jest.fn().mockResolvedValue({ id: 'job-1' }),
  addEmailJob: jest.fn().mockResolvedValue({ id: 'job-2' }),
};

const mockMonitoringService = {
  getAllQueueMetrics: jest.fn().mockResolvedValue({}),
  getQueueMetrics: jest.fn().mockResolvedValue({}),
  getHealthStatus: jest.fn().mockResolvedValue({ status: 'ok' }),
};

const mockSchedulerService = {
  triggerDailyReport: jest.fn().mockResolvedValue(undefined),
  triggerWeeklyCleanup: jest.fn().mockResolvedValue(undefined),
  triggerCustomReport: jest.fn().mockResolvedValue(undefined),
};

const mockBackoffService = {
  getAllPolicies: jest.fn().mockReturnValue({}),
  getPolicy: jest.fn().mockReturnValue({}),
};

const mockDlqService = {
  getDLQStats: jest.fn().mockReturnValue({}),
  getDLQItems: jest.fn().mockReturnValue([]),
  getDLQItem: jest.fn().mockReturnValue(null),
  getDLQConfig: jest.fn().mockReturnValue({}),
  setDLQConfig: jest.fn().mockReturnValue(undefined),
  recoverJob: jest.fn().mockResolvedValue(true),
  removeDLQItem: jest.fn().mockReturnValue(true),
  clearDLQ: jest.fn().mockReturnValue(0),
};

const mockAnalyticsService = {
  getQueueHealth: jest.fn().mockReturnValue({ status: 'healthy' }),
  getMetricsHistory: jest.fn().mockReturnValue([]),
  generateAnalyticsReport: jest.fn().mockResolvedValue({}),
  getHealthThresholds: jest.fn().mockReturnValue({}),
  setHealthThresholds: jest.fn().mockReturnValue(undefined),
};
