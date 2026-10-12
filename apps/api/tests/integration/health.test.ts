import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

vi.mock('../../src/lib/redis', () => ({
  getRedisClient: vi.fn(() => ({
    isOpen: true,
    ping: vi.fn().mockResolvedValue('PONG'),
    on: vi.fn(),
  })),
  connectRedis: vi.fn().mockResolvedValue(undefined),
  disconnectRedis: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('GET /api/v1/health', () => {
  const app = createApp();

  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.requestId).toBeDefined();
  });

  it('sets X-Request-Id header', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('echoes X-Request-Id from request', async () => {
    const id = 'test-request-id-123';
    const res = await request(app).get('/api/v1/health').set('X-Request-Id', id);
    expect(res.headers['x-request-id']).toBe(id);
    expect(res.body.requestId).toBe(id);
  });
});

describe('GET /api/v1/health/ready', () => {
  it('returns 200 when both DB and Redis healthy', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.database).toBe(true);
    expect(res.body.data.redis).toBe(true);
    expect(res.body.data.ready).toBe(true);
  });

  it('returns 503 when DB is down', async () => {
    const { prisma } = await import('../../src/lib/prisma');
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('connection refused'));
    const app = createApp();
    const res = await request(app).get('/api/v1/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('malformed JSON body', () => {
  it('returns 400 INVALID_JSON with a real requestId (not "undefined")', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/bingo/rounds/00000000-0000-0000-0000-000000000000/purchases')
      .set('Content-Type', 'application/json')
      .set('x-mock-player-id', 'player-1')
      .send('NOT JSON');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
    expect(res.body.requestId).toBeDefined();
    expect(res.body.requestId).not.toBe('undefined');
  });
});
