import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

const mocks = vi.hoisted(() => {
  const mockCat = {
    id: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
    name: 'Daily',
    slug: 'daily',
    description: 'Daily round',
    isActive: true,
    priceMinorUnits: 5000,
    currency: 'KES',
    maxTicketsPerPurchase: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { mockCat };
});

vi.mock('../../src/lib/redis', () => ({
  getRedisClient: vi.fn(() => ({ isOpen: true, ping: vi.fn(), on: vi.fn() })),
  connectRedis: vi.fn(),
  disconnectRedis: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    bingoCategory: {
      findMany: vi.fn().mockResolvedValue([mocks.mockCat]),
      findUnique: vi.fn().mockResolvedValue(mocks.mockCat),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(mocks.mockCat),
      update: vi.fn().mockResolvedValue(mocks.mockCat),
    },
    bingoRound: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn().mockResolvedValue([[], 0]),
    $queryRaw: vi.fn().mockResolvedValue([]),
    $disconnect: vi.fn(),
  },
}));

describe('GET /api/v1/bingo/categories', () => {
  const app = createApp();

  it('returns paginated categories with meta', async () => {
    const res = await request(app).get('/api/v1/bingo/categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
    expect(typeof res.body.meta.total).toBe('number');
  });
});

describe('GET /api/v1/bingo/categories/:categoryId', () => {
  const app = createApp();

  it('returns 400 for invalid UUID', async () => {
    const res = await request(app).get('/api/v1/bingo/categories/not-a-uuid');
    expect(res.status).toBe(400);
  });

  it('returns category for valid UUID', async () => {
    const res = await request(app).get(`/api/v1/bingo/categories/${mocks.mockCat.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(mocks.mockCat.id);
  });
});

describe('GET /api/v1/bingo/categories/:categoryId/rounds', () => {
  const app = createApp();

  it('returns paginated rounds', async () => {
    const res = await request(app).get(`/api/v1/bingo/categories/${mocks.mockCat.id}/rounds`);
    expect(res.status).toBe(200);
    expect(res.body.meta).toBeDefined();
  });
});

describe('POST /api/v1/admin/bingo/categories (admin)', () => {
  const app = createApp();

  it('returns 403 without admin token', async () => {
    const res = await request(app)
      .post('/api/v1/admin/bingo/categories')
      .send({ name: 'Weekly', slug: 'weekly', priceMinorUnits: 10000 });
    expect(res.status).toBe(403);
  });

  it('creates category with admin token', async () => {
    const res = await request(app)
      .post('/api/v1/admin/bingo/categories')
      .set('x-mock-admin-token', 'dev-admin-secret')
      .send({ name: 'Weekly', slug: 'weekly', priceMinorUnits: 10000 });
    expect(res.status).toBe(201);
  });
});
