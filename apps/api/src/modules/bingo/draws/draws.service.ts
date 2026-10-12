import { randomInt } from 'crypto';
import { RoundStatus, Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { NotFoundError, ValidationError, RoundStateError, ConflictError } from '../../../lib/errors';
import { recordAudit } from '../../../lib/audit';
import { broadcastDraw } from '../live/socket';

export async function drawNumber(roundId: string, actorId: string) {
  const round = await prisma.bingoRound.findUnique({ where: { id: roundId } });
  if (!round) throw new NotFoundError('Round');
  if (round.status !== RoundStatus.IN_PROGRESS) {
    throw new RoundStateError(round.status, 'DRAW');
  }

  const drawn = await prisma.bingoDrawEvent.findMany({
    where: { roundId },
    select: { number: true, sequence: true },
    orderBy: { sequence: 'asc' },
  });
  const drawnSet = new Set(drawn.map((d) => d.number));

  // Build the remaining pool and pick one number with uniform distribution.
  // Cleaner and bounded compared to rejection sampling.
  const available: number[] = [];
  for (let n = 1; n <= 75; n++) {
    if (!drawnSet.has(n)) available.push(n);
  }
  if (available.length === 0) throw new ValidationError('All 75 numbers have been drawn');

  const number = available[randomInt(available.length)]!;
  const sequence = drawn.length + 1;

  let event: Awaited<ReturnType<typeof prisma.bingoDrawEvent.create>>;
  try {
    event = await prisma.bingoDrawEvent.create({
      data: { roundId, sequence, number, drawnBy: actorId },
    });
  } catch (err) {
    // Two concurrent draws can race past the read and collide on the unique
    // (roundId, sequence) or (roundId, number) constraint.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Draw collision — another draw is in progress, try again');
    }
    throw err;
  }

  await recordAudit({
    actorId,
    actorRole: 'system',
    action: 'DRAW_EXECUTED',
    targetType: 'BingoDrawEvent',
    targetId: event.id,
    roundId,
    metadata: { sequence, number },
  });

  await broadcastDraw(roundId, { sequence, number, drawnAt: event.drawnAt });

  return event;
}

export async function getDrawHistory(roundId: string) {
  const round = await prisma.bingoRound.findUnique({ where: { id: roundId }, select: { id: true } });
  if (!round) throw new NotFoundError('Round');
  return prisma.bingoDrawEvent.findMany({
    where: { roundId },
    orderBy: { sequence: 'asc' },
  });
}
