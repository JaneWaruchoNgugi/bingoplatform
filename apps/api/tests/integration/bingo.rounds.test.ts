import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

const mocks = vi.hoisted(() => {
  const ROUND_ID = 'b3bb189e-8bf9-3888-9912-ace4e6543003';
  const mockRound = {
    id: ROUND_ID,
    categoryId: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
    category: { name: 'Daily', slug: 'daily' },
    status: 'SCHEDULED',
    scheduledStart: new Date('2026-12-01T10:00:00Z'),
    salesDeadline: new Date('2026-12-01T09:45:00Z'),
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    maxTickets: 100,
    totalTickets: 0,
    version: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    prizeRules: [],
  };
  return { ROUND_ID, mockRound };
});

vi.mock('../../src/lib/redis', () => ({
  getRedisClient: vi.fn(() => ({ isOpen: true, ping: vi.fn(), on: vi.fn() })),
  connectRedis: vi.fn(),
  disconnectRedis: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    bingoRound: {
      findMany: vi.fn().mockResolvedValue([mocks.mockRound]),
      findUnique: vi.fn().mockResolvedValue(mocks.mockRound),
      create: vi.fn().mockResolvedValue(mocks.mockRound),
      update: vi.fn().mockResolvedValue({ ...mocks.mockRound, status: 'OPEN_FOR_SALE' }),
      count: vi.fn().mockResolvedValue(1),
    },
    bingoDrawEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
    bingoPrizeAllocation: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    bingoWinClaim: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    bingoAuditEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockImplementation((arr) =>
      Array.isArray(arr) ? Promise.all(arr) : arr({}),
    ),
    $queryRaw: vi.fn().mockResolvedValue([]),
    $disconnect: vi.fn(),
  },
}));

describe('GET /api/v1/bingo/rounds', () => {
  const app = createApp();

  it('returns paginated rounds', async () => {
    const res = await request(app).get('/api/v1/bingo/rounds');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
  });

  it('accepts status filter', async () => {
    const res = await request(app).get('/api/v1/bingo/rounds?status=SCHEDULED');
    expect(res.status).toBe(200);
  });

  it('rejects invalid status', async () => {
    const res = await request(app).get('/api/v1/bingo/rounds?status=INVALID');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/bingo/rounds/:roundId', () => {
  const app = createApp();

  it('returns 400 for invalid UUID', async () => {
    const res = await request(app).get('/api/v1/bingo/rounds/not-uuid');
    expect(res.status).toBe(400);
  });

  it('returns round for valid ID', async () => {
    const res = await request(app).get(`/api/v1/bingo/rounds/${mocks.ROUND_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(mocks.ROUND_ID);
  });
});

describe('GET /api/v1/bingo/rounds/:roundId/state', () => {
  const app = createApp();

  it('returns round state and draw count', async () => {
    const res = await request(app).get(`/api/v1/bingo/rounds/${mocks.ROUND_ID}/state`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('drawCount');
  });
});

describe('POST /api/v1/admin/bingo/rounds/:roundId/open-sales', () => {
  const app = createApp();

  it('returns 403 without admin token', async () => {
    const res = await request(app).post(`/api/v1/admin/bingo/rounds/${mocks.ROUND_ID}/open-sales`);
    expect(res.status).toBe(403);
  });

  it('transitions round status with admin token', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/bingo/rounds/${mocks.ROUND_ID}/open-sales`)
      .set('x-mock-admin-token', 'dev-admin-secret');
    expect(res.status).toBe(200);
  });
});
