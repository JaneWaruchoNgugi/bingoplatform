import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

vi.mock('../../src/lib/redis', () => ({
  getRedisClient: vi.fn(() => ({ isOpen: true, ping: vi.fn(), on: vi.fn() })),
  connectRedis: vi.fn(),
  disconnectRedis: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    bingoRound: { count: vi.fn().mockResolvedValue(5) },
    bingoPurchase: { count: vi.fn().mockResolvedValue(42) },
    bingoTicket: { count: vi.fn().mockResolvedValue(84) },
    bingoCategory: {
      count: vi.fn().mockResolvedValue(3),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
        name: 'Weekly',
        slug: 'weekly',
        isActive: true,
        priceMinorUnits: 10000,
        currency: 'KES',
        maxTicketsPerPurchase: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      update: vi.fn(),
    },
    bingoAuditEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockImplementation((arr) =>
      Array.isArray(arr) ? Promise.all(arr) : arr({}),
    ),
    $queryRaw: vi.fn().mockResolvedValue([]),
    $disconnect: vi.fn(),
  },
}));

const ADMIN_HEADER = { 'x-mock-admin-token': 'dev-admin-secret' };

describe('Admin auth guard', () => {
  const app = createApp();

  it.each([
    ['GET', '/api/v1/admin/bingo/reports'],
    ['GET', '/api/v1/admin/bingo/categories'],
    ['GET', '/api/v1/admin/bingo/audit-events'],
  ])('%s %s returns 403 without token', async (method, path) => {
    const res = await (request(app) as any)[method.toLowerCase()](path);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/admin/bingo/reports', () => {
  const app = createApp();

  it('returns aggregate counts', async () => {
    const res = await request(app).get('/api/v1/admin/bingo/reports').set(ADMIN_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalRounds: expect.any(Number),
      totalPurchases: expect.any(Number),
      totalTickets: expect.any(Number),
      totalCategories: expect.any(Number),
    });
  });
});

describe('GET /api/v1/admin/bingo/categories', () => {
  const app = createApp();

  it('returns categories list for admin', async () => {
    const res = await request(app).get('/api/v1/admin/bingo/categories').set(ADMIN_HEADER);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('POST /api/v1/admin/bingo/categories', () => {
  const app = createApp();

  it('validates required fields', async () => {
    const res = await request(app)
      .post('/api/v1/admin/bingo/categories')
      .set(ADMIN_HEADER)
      .send({ name: 'X' }); // missing slug and priceMinorUnits
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('creates with valid payload', async () => {
    const res = await request(app)
      .post('/api/v1/admin/bingo/categories')
      .set(ADMIN_HEADER)
      .send({ name: 'Weekly', slug: 'weekly', priceMinorUnits: 10000 });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('weekly');
  });
});

describe('GET /api/v1/admin/bingo/audit-events', () => {
  const app = createApp();

  it('returns paginated audit events', async () => {
    const res = await request(app).get('/api/v1/admin/bingo/audit-events').set(ADMIN_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.meta).toBeDefined();
  });

  it('accepts page and limit query params', async () => {
    const res = await request(app)
      .get('/api/v1/admin/bingo/audit-events?page=1&limit=5')
      .set(ADMIN_HEADER);
    expect(res.status).toBe(200);
  });
});
