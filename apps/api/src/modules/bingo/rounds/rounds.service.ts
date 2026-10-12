import { RoundStatus, Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { NotFoundError, RoundStateError, ValidationError } from '../../../lib/errors';
import { recordAudit } from '../../../lib/audit';
import { broadcastRoundStatus } from '../live/socket';
import type {
  ListRoundsInput,
  CreateRoundInput,
  UpdateRoundInput,
  CancelRoundInput,
} from './rounds.schema';

const VALID_TRANSITIONS: Record<RoundStatus, RoundStatus[]> = {
  SCHEDULED: [RoundStatus.OPEN_FOR_SALE, RoundStatus.CANCELLED],
  OPEN_FOR_SALE: [RoundStatus.SALES_CLOSED, RoundStatus.CANCELLED],
  SALES_CLOSED: [RoundStatus.IN_PROGRESS, RoundStatus.CANCELLED],
  IN_PROGRESS: [RoundStatus.COMPLETED, RoundStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

export async function listRounds(input: ListRoundsInput) {
  const { page, limit, status, categoryId } = input;
  const skip = (page - 1) * limit;
  const where: Prisma.BingoRoundWhereInput = {
    ...(status ? { status } : {}),
    ...(categoryId ? { categoryId } : {}),
  };
  const [rounds, total] = await prisma.$transaction([
    prisma.bingoRound.findMany({
      where,
      skip,
      take: limit,
      orderBy: { scheduledStart: 'desc' },
      include: { category: { select: { name: true, slug: true } } },
    }),
    prisma.bingoRound.count({ where }),
  ]);
  return { rounds, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getRoundById(id: string) {
  const round = await prisma.bingoRound.findUnique({
    where: { id },
    include: { category: { select: { name: true, slug: true } }, prizeRules: true },
  });
  if (!round) throw new NotFoundError('Round');
  return round;
}

export async function getRoundState(id: string) {
  const round = await prisma.bingoRound.findUnique({
    where: { id },
    select: { id: true, status: true, totalTickets: true, version: true },
  });
  if (!round) throw new NotFoundError('Round');
  const [drawCount, lastDraw] = await Promise.all([
    prisma.bingoDrawEvent.count({ where: { roundId: id } }),
    prisma.bingoDrawEvent.findFirst({
      where: { roundId: id },
      orderBy: { sequence: 'desc' },
      select: { number: true, drawnAt: true },
    }),
  ]);
  return {
    ...round,
    drawCount,
    lastDrawnNumber: lastDraw?.number ?? null,
    lastDrawnAt: lastDraw?.drawnAt ?? null,
  };
}

export async function getRoundNumbers(id: string) {
  const round = await prisma.bingoRound.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!round) throw new NotFoundError('Round');
  const draws = await prisma.bingoDrawEvent.findMany({
    where: { roundId: id },
    orderBy: { sequence: 'asc' },
    select: { sequence: true, number: true, drawnAt: true },
  });
  return draws;
}

export async function getRoundWinners(id: string) {
  const round = await prisma.bingoRound.findUnique({ where: { id }, select: { id: true } });
  if (!round) throw new NotFoundError('Round');
  return prisma.bingoPrizeAllocation.findMany({
    where: { roundId: id },
    include: {
      claim: {
        include: { prizeRule: { select: { name: true } }, ticket: { select: { serialNumber: true } } },
      },
    },
  });
}

export async function getRoundResults(id: string) {
  const round = await getRoundById(id);
  const [draws, claims, allocations] = await Promise.all([
    prisma.bingoDrawEvent.findMany({ where: { roundId: id }, orderBy: { sequence: 'asc' } }),
    prisma.bingoWinClaim.findMany({ where: { roundId: id }, include: { prizeRule: { select: { name: true } } } }),
    prisma.bingoPrizeAllocation.findMany({ where: { roundId: id } }),
  ]);
  return { round, draws, claims, allocations };
}

export async function createRound(input: CreateRoundInput, actorId: string) {
  const salesDeadline = new Date(input.salesDeadline);
  const scheduledStart = new Date(input.scheduledStart);
  if (salesDeadline >= scheduledStart) {
    throw new ValidationError('salesDeadline must be before scheduledStart');
  }
  const round = await prisma.bingoRound.create({
    data: {
      categoryId: input.categoryId,
      scheduledStart,
      salesDeadline,
      maxTickets: input.maxTickets,
      prizeRules: input.prizeRules
        ? {
            create: input.prizeRules.map((r) => ({
              name: r.name,
              pattern: r.pattern as Prisma.InputJsonValue,
              prizeMinorUnits: r.prizeMinorUnits,
              prizePercentage: r.prizePercentage,
              callLimit: r.callLimit,
              priority: r.priority,
            })),
          }
        : undefined,
    },
    include: { prizeRules: true },
  });
  await recordAudit({ actorId, actorRole: 'admin', action: 'ROUND_CREATED', targetType: 'BingoRound', targetId: round.id });
  return round;
}

export async function updateRound(id: string, input: UpdateRoundInput, actorId: string) {
  const existing = await getRoundById(id);
  if (!['SCHEDULED'].includes(existing.status)) {
    throw new ValidationError('Can only update rounds in SCHEDULED status');
  }
  const updated = await prisma.bingoRound.update({
    where: { id },
    data: {
      ...(input.scheduledStart ? { scheduledStart: new Date(input.scheduledStart) } : {}),
      ...(input.salesDeadline ? { salesDeadline: new Date(input.salesDeadline) } : {}),
      ...(input.maxTickets !== undefined ? { maxTickets: input.maxTickets } : {}),
    },
  });
  await recordAudit({ actorId, actorRole: 'admin', action: 'ROUND_UPDATED', targetType: 'BingoRound', targetId: id, metadata: { before: existing, after: updated } });
  return updated;
}

async function transitionRound(
  id: string,
  to: RoundStatus,
  actorId: string,
  extra?: Partial<{ startedAt: Date; completedAt: Date; cancelledAt: Date; cancellationReason: string }>,
) {
  const round = await prisma.bingoRound.findUnique({ where: { id } });
  if (!round) throw new NotFoundError('Round');
  const allowed = VALID_TRANSITIONS[round.status];
  if (!allowed.includes(to)) throw new RoundStateError(round.status, to);

  const updated = await prisma.bingoRound.update({
    where: { id },
    data: { status: to, ...extra },
  });
  await recordAudit({
    actorId,
    actorRole: 'admin',
    action: 'ROUND_STATUS_CHANGED',
    targetType: 'BingoRound',
    targetId: id,
    roundId: id,
    metadata: { from: round.status, to },
  });

  broadcastRoundStatus(id, to);

  return updated;
}

export const openSales = (id: string, actorId: string) =>
  transitionRound(id, RoundStatus.OPEN_FOR_SALE, actorId);

export const closeSales = (id: string, actorId: string) =>
  transitionRound(id, RoundStatus.SALES_CLOSED, actorId);

export const startRound = (id: string, actorId: string) =>
  transitionRound(id, RoundStatus.IN_PROGRESS, actorId, { startedAt: new Date() });

export const completeRound = (id: string, actorId: string) =>
  transitionRound(id, RoundStatus.COMPLETED, actorId, { completedAt: new Date() });

export async function cancelRound(id: string, input: CancelRoundInput, actorId: string) {
  return transitionRound(id, RoundStatus.CANCELLED, actorId, {
    cancelledAt: new Date(),
    cancellationReason: input.reason,
  });
}
