import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createApp } from '../../src/app';

const mocks = vi.hoisted(() => {
  const ROUND_ID = 'c3bb189e-8bf9-3888-9912-ace4e6543004';
  const mockRound = {
    id: ROUND_ID,
    status: 'IN_PROGRESS',
    maxTickets: 10,
    totalTickets: 5,
    version: 0,
    category: { id: 'a3bb189e-8bf9-3888-9912-ace4e6543002', name: 'Daily' },
    prizeRules: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const mockDrawEvent = {
    id: 'draw-1',
    roundId: ROUND_ID,
    number: 42,
    sequence: 1,
    drawnBy: 'admin-1',
    drawnAt: new Date(),
  };
  return { ROUND_ID, mockRound, mockDrawEvent };
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
      update: vi.fn().mockResolvedValue(mocks.mockRound),
    },
    bingoDrawEvent: {
      // Default: one previously-drawn event, so sequence=2 would be next
      findMany: vi.fn().mockResolvedValue([mocks.mockDrawEvent]),
      create: vi.fn().mockResolvedValue(mocks.mockDrawEvent),
      count: vi.fn().mockResolvedValue(1),
    },
    bingoAuditEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $disconnect: vi.fn(),
  },
}));

// ─── POST draw ────────────────────────────────────────────────────────────────

describe('POST /api/v1/admin/bingo/rounds/:roundId/draw', () => {
  const app = createApp();

  it('returns 403 without admin token', async () => {
    const res = await request(app).post(`/api/v1/admin/bingo/rounds/${mocks.ROUND_ID}/draw`);
    expect(res.status).toBe(403);
  });

  it('draws a number 1–75 with admin token', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/bingo/rounds/${mocks.ROUND_ID}/draw`)
      .set('x-mock-admin-token', 'dev-admin-secret');
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('number');
    expect(typeof res.body.data.number).toBe('number');
    expect(res.body.data.number).toBeGreaterThanOrEqual(1);
    expect(res.body.data.number).toBeLessThanOrEqual(75);
  });

  it('returns 400 for invalid round UUID', async () => {
    const res = await request(app)
      .post('/api/v1/admin/bingo/rounds/bad-uuid/draw')
      .set('x-mock-admin-token', 'dev-admin-secret');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_UUID');
  });

  it('returns 409 INVALID_STATE_TRANSITION when round is not IN_PROGRESS', async () => {
    const { prisma } = await import('../../src/lib/prisma');
    vi.mocked(prisma.bingoRound.findUnique).mockResolvedValueOnce({
      ...mocks.mockRound,
      status: 'SCHEDULED',
    });
    const res = await request(app)
      .post(`/api/v1/admin/bingo/rounds/${mocks.ROUND_ID}/draw`)
      .set('x-mock-admin-token', 'dev-admin-secret');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('returns 400 VALIDATION_ERROR when all 75 numbers have been drawn', async () => {
    const { prisma } = await import('../../src/lib/prisma');
    const allDrawn = Array.from({ length: 75 }, (_, i) => ({
      id: `draw-${i + 1}`,
      roundId: mocks.ROUND_ID,
      number: i + 1,
      sequence: i + 1,
      drawnBy: 'admin',
      drawnAt: new Date(),
    }));
    vi.mocked(prisma.bingoDrawEvent.findMany).mockResolvedValueOnce(allDrawn);
    const res = await request(app)
      .post(`/api/v1/admin/bingo/rounds/${mocks.ROUND_ID}/draw`)
      .set('x-mock-admin-token', 'dev-admin-secret');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/75/);
  });

  it('returns 409 CONFLICT when a concurrent draw collides on unique constraint', async () => {
    const { prisma } = await import('../../src/lib/prisma');
    vi.mocked(prisma.bingoDrawEvent.create).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['round_id', 'sequence'] },
      }),
    );
    const res = await request(app)
      .post(`/api/v1/admin/bingo/rounds/${mocks.ROUND_ID}/draw`)
      .set('x-mock-admin-token', 'dev-admin-secret');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

// ─── GET draw history ─────────────────────────────────────────────────────────

describe('GET /api/v1/bingo/rounds/:roundId/numbers', () => {
  const app = createApp();

  it('returns draw history as an array', async () => {
    const res = await request(app).get(`/api/v1/bingo/rounds/${mocks.ROUND_ID}/numbers`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 404 for unknown round', async () => {
    const { prisma } = await import('../../src/lib/prisma');
    vi.mocked(prisma.bingoRound.findUnique).mockResolvedValueOnce(null);
    const res = await request(app).get(`/api/v1/bingo/rounds/${mocks.ROUND_ID}/numbers`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
