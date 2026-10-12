import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

const mocks = vi.hoisted(() => {
  const PLAYER_ID = 'player-abc123';
  const ROUND_ID = 'c3bb189e-8bf9-3888-9912-ace4e6543004';
  const PURCHASE_ID = 'd3bb189e-8bf9-3888-9912-ace4e6543005';
  const TICKET_ID = 'e3bb189e-8bf9-3888-9912-ace4e6543006';
  const CARD_ID = 'f3bb189e-8bf9-3888-9912-ace4e6543007';

  const mockRound = {
    id: ROUND_ID,
    status: 'OPEN_FOR_SALE',
    maxTickets: 100,
    totalTickets: 0,
    version: 0,
    category: { id: 'a3bb189e-8bf9-3888-9912-ace4e6543002', priceMinorUnits: 5000, currency: 'KES', maxTicketsPerPurchase: 10 },
  };

  const mockCard = { id: CARD_ID, ticketId: TICKET_ID, numbers: Array(25).fill(0), createdAt: new Date() };

  const mockTicket = {
    id: TICKET_ID,
    roundId: ROUND_ID,
    purchaseId: PURCHASE_ID,
    playerId: PLAYER_ID,
    serialNumber: 'BNG-C3BB189E-ABCD1234',
    isVoid: false,
    createdAt: new Date(),
    card: mockCard,
  };

  const mockPurchase = {
    id: PURCHASE_ID,
    roundId: ROUND_ID,
    playerId: PLAYER_ID,
    status: 'CONFIRMED',
    ticketCount: 2,
    pricePerTicket: 5000,
    totalAmount: 10000,
    currency: 'KES',
    idempotencyKey: 'test-idem-key-1234567890',
    financialRefId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    tickets: [{ id: TICKET_ID, serialNumber: 'BNG-C3BB189E-ABCD1234', isVoid: false }],
  };

  return { PLAYER_ID, ROUND_ID, PURCHASE_ID, TICKET_ID, mockRound, mockTicket, mockPurchase, mockCard };
});

vi.mock('../../src/lib/redis', () => ({
  getRedisClient: vi.fn(() => ({ isOpen: true, ping: vi.fn(), on: vi.fn() })),
  connectRedis: vi.fn(),
  disconnectRedis: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    bingoRound: {
      findUnique: vi.fn().mockResolvedValue(mocks.mockRound),
    },
    bingoPurchase: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([mocks.mockPurchase]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(mocks.mockPurchase),
    },
    bingoTicket: {
      findUnique: vi.fn().mockResolvedValue(mocks.mockTicket),
      findMany: vi.fn().mockResolvedValue([mocks.mockTicket]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(mocks.mockTicket),
    },
    bingoCard: {
      create: vi.fn().mockResolvedValue(mocks.mockCard),
    },
    bingoFinancialReference: {
      create: vi.fn().mockResolvedValue({ id: 'ref-1', externalRef: 'mock-debit-1', type: 'DEBIT' }),
    },
    bingoAuditEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockImplementation(async (fn) => {
      if (typeof fn === 'function') {
        return fn({
          bingoRound: {
            findUnique: vi.fn().mockResolvedValue({ totalTickets: 0, maxTickets: 100, version: 0 }),
            update: vi.fn().mockResolvedValue(mocks.mockRound),
          },
          bingoFinancialReference: { create: vi.fn().mockResolvedValue({ id: 'ref-1' }) },
          bingoPurchase: { create: vi.fn().mockResolvedValue(mocks.mockPurchase) },
          bingoTicket: { create: vi.fn().mockResolvedValue(mocks.mockTicket) },
          bingoCard: { create: vi.fn().mockResolvedValue(mocks.mockCard) },
        });
      }
      return Promise.all(fn);
    }),
    $queryRaw: vi.fn().mockResolvedValue([]),
    $disconnect: vi.fn(),
  },
}));

describe('POST /api/v1/bingo/rounds/:roundId/purchases', () => {
  const app = createApp();

  it('returns 401 without player auth', async () => {
    const res = await request(app)
      .post(`/api/v1/bingo/rounds/${mocks.ROUND_ID}/purchases`)
      .send({ ticketCount: 2, idempotencyKey: 'test-key-12345678' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid round UUID', async () => {
    const res = await request(app)
      .post('/api/v1/bingo/rounds/not-uuid/purchases')
      .set('x-mock-player-id', mocks.PLAYER_ID)
      .send({ ticketCount: 2, idempotencyKey: 'test-key-12345678' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing idempotency key', async () => {
    const res = await request(app)
      .post(`/api/v1/bingo/rounds/${mocks.ROUND_ID}/purchases`)
      .set('x-mock-player-id', mocks.PLAYER_ID)
      .send({ ticketCount: 2 });
    expect(res.status).toBe(400);
  });

  it('creates purchase with valid player auth', async () => {
    const res = await request(app)
      .post(`/api/v1/bingo/rounds/${mocks.ROUND_ID}/purchases`)
      .set('x-mock-player-id', mocks.PLAYER_ID)
      .send({ ticketCount: 2, idempotencyKey: 'valid-idem-key-12345678' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/v1/bingo/purchases/:purchaseId', () => {
  const app = createApp();

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/bingo/purchases/${mocks.PURCHASE_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns purchase for owner', async () => {
    const { prisma } = await import('../../src/lib/prisma');
    vi.mocked(prisma.bingoPurchase.findUnique).mockResolvedValueOnce(mocks.mockPurchase as any);
    const res = await request(app)
      .get(`/api/v1/bingo/purchases/${mocks.PURCHASE_ID}`)
      .set('x-mock-player-id', mocks.PLAYER_ID);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(mocks.PURCHASE_ID);
  });

  it('returns 403 for non-owner', async () => {
    const { prisma } = await import('../../src/lib/prisma');
    vi.mocked(prisma.bingoPurchase.findUnique).mockResolvedValueOnce(mocks.mockPurchase as any);
    const res = await request(app)
      .get(`/api/v1/bingo/purchases/${mocks.PURCHASE_ID}`)
      .set('x-mock-player-id', 'different-player-id');
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/bingo/tickets/:ticketId', () => {
  const app = createApp();

  it('returns ticket with card for owner', async () => {
    const { prisma } = await import('../../src/lib/prisma');
    vi.mocked(prisma.bingoTicket.findUnique).mockResolvedValueOnce(mocks.mockTicket as any);
    const res = await request(app)
      .get(`/api/v1/bingo/tickets/${mocks.TICKET_ID}`)
      .set('x-mock-player-id', mocks.PLAYER_ID);
    expect(res.status).toBe(200);
  });

  it('returns 403 for wrong player', async () => {
    const { prisma } = await import('../../src/lib/prisma');
    vi.mocked(prisma.bingoTicket.findUnique).mockResolvedValueOnce(mocks.mockTicket as any);
    const res = await request(app)
      .get(`/api/v1/bingo/tickets/${mocks.TICKET_ID}`)
      .set('x-mock-player-id', 'attacker-id');
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/bingo/me/tickets', () => {
  const app = createApp();

  it('returns player ticket list', async () => {
    const res = await request(app)
      .get('/api/v1/bingo/me/tickets')
      .set('x-mock-player-id', mocks.PLAYER_ID);
    expect(res.status).toBe(200);
    expect(res.body.meta).toBeDefined();
  });
});
