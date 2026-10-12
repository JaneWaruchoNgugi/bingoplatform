import { ClaimStatus, AllocationStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { getWalletAdapter } from '../../../lib/wallet';
import { NotFoundError, ValidationError } from '../../../lib/errors';
import { checkWin, type WinPattern } from '../cards/card.service';
import { recordAudit } from '../../../lib/audit';
import { broadcastRoundCompleted } from '../live/socket';
import { logger } from '../../../lib/logger';

// Accepted pattern types — evaluated server-side only.
const VALID_WIN_PATTERNS = new Set<string>([
  'ANY_ROW', 'ANY_COL', 'ANY_DIAG', 'FULL_HOUSE', 'FOUR_CORNERS',
]);

export async function getTicketWins(ticketId: string, playerId: string) {
  const ticket = await prisma.bingoTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new NotFoundError('Ticket');
  if (ticket.playerId !== playerId) throw new ValidationError('Not your ticket');
  return prisma.bingoWinClaim.findMany({
    where: { ticketId },
    include: { prizeRule: { select: { name: true } } },
  });
}

export async function listMyWins(playerId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [claims, total] = await prisma.$transaction([
    prisma.bingoWinClaim.findMany({
      where: { playerId },
      skip,
      take: limit,
      orderBy: { claimedAt: 'desc' },
      include: { prizeRule: { select: { name: true } } },
    }),
    prisma.bingoWinClaim.count({ where: { playerId } }),
  ]);
  return { claims, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function listMyPrizes(playerId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [allocations, total] = await prisma.$transaction([
    prisma.bingoPrizeAllocation.findMany({
      where: { playerId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { claim: { include: { prizeRule: { select: { name: true } } } } },
    }),
    prisma.bingoPrizeAllocation.count({ where: { playerId } }),
  ]);
  return { allocations, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getBingoHistory(playerId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [rounds, total] = await prisma.$transaction([
    prisma.bingoRound.findMany({
      where: { tickets: { some: { playerId } } },
      skip,
      take: limit,
      orderBy: { scheduledStart: 'desc' },
      include: { category: { select: { name: true, slug: true } } },
    }),
    prisma.bingoRound.count({ where: { tickets: { some: { playerId } } } }),
  ]);
  return { rounds, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Server-side win verification ────────────────────────────────────────────
// Called by admin after draws. Safe to call multiple times — upserts are idempotent.

export async function verifyAndClaimWins(roundId: string, actorId: string) {
  const round = await prisma.bingoRound.findUnique({
    where: { id: roundId },
    include: { prizeRules: { where: { isActive: true } }, drawEvents: true },
  });
  if (!round) throw new NotFoundError('Round');

  // Sort by sequence so callLimit slicing evaluates draws in call order.
  const orderedDraws = round.drawEvents.slice().sort((a, b) => a.sequence - b.sequence);
  const allDrawnNumbers = new Set(orderedDraws.map((d) => d.number));

  const tickets = await prisma.bingoTicket.findMany({
    where: { roundId, isVoid: false },
    include: { card: true },
  });

  const claims: Array<{ ticketId: string; playerId: string; prizeRuleId: string }> = [];

  for (const ticket of tickets) {
    if (!ticket.card) continue;
    for (const rule of round.prizeRules) {
      const patternType = (rule.pattern as { type?: string }).type;
      if (!patternType || !VALID_WIN_PATTERNS.has(patternType)) continue;

      // callLimit: evaluate only the first N draws for this rule.
      // "Did the pattern complete within N calls?" — not "does it win with all draws?"
      const effectiveDrawn =
        rule.callLimit !== null
          ? new Set(orderedDraws.slice(0, rule.callLimit).map((d) => d.number))
          : allDrawnNumbers;

      const won = checkWin(patternType as WinPattern, ticket.card.numbers, effectiveDrawn);
      if (won) {
        claims.push({ ticketId: ticket.id, playerId: ticket.playerId, prizeRuleId: rule.id });
      }
    }
  }

  // Upsert claims — idempotent on (ticketId, prizeRuleId).
  // update: {} means a repeated call for the same win does nothing.
  const saved = await prisma.$transaction(
    claims.map((c) =>
      prisma.bingoWinClaim.upsert({
        where: { ticketId_prizeRuleId: { ticketId: c.ticketId, prizeRuleId: c.prizeRuleId } },
        create: { roundId, ...c, status: ClaimStatus.VERIFIED, verifiedAt: new Date() },
        update: {},
      }),
    ),
  );

  await recordAudit({
    actorId,
    actorRole: 'system',
    action: 'WINS_VERIFIED',
    targetType: 'BingoRound',
    targetId: roundId,
    roundId,
    metadata: { claimsFound: saved.length },
  });

  return saved;
}

// ─── Prize settlement (mock — real money disabled) ───────────────────────────
// Idempotent: already-SETTLED allocations are skipped. PENDING allocations are
// retried using the same deterministic idempotency key so the wallet deduplicates.

export async function settleAllocations(roundId: string, actorId: string) {
  const claims = await prisma.bingoWinClaim.findMany({
    where: { roundId, status: ClaimStatus.VERIFIED },
    include: { prizeRule: true },
  });

  const wallet = getWalletAdapter();
  const results = [];

  for (const claim of claims) {
    const prize = claim.prizeRule.prizeMinorUnits ?? 0;
    if (prize <= 0) {
      // Percentage-based prizes need the pot total before they can be settled.
      // Calculation is not yet implemented — requires business rule approval.
      if (claim.prizeRule.prizePercentage) {
        logger.warn(
          { claimId: claim.id, prizeRuleId: claim.prizeRuleId },
          'Percentage-based prize not settled — calculation not yet implemented',
        );
      }
      continue;
    }

    const existing = await prisma.bingoPrizeAllocation.findUnique({ where: { claimId: claim.id } });
    if (existing?.status === AllocationStatus.SETTLED) {
      results.push({ claimId: claim.id, status: 'already_settled' });
      continue;
    }

    const idempKey = `settle-${claim.id}`;
    const credit = await wallet.credit(claim.playerId, prize, 'KES', idempKey, `Prize: ${claim.prizeRule.name}`);

    const finRef = await prisma.bingoFinancialReference.create({
      data: {
        externalRef: credit.externalRef,
        type: 'CREDIT',
        amountMinorUnits: prize,
        currency: 'KES',
        status: credit.status,
        playerId: claim.playerId,
      },
    });

    await prisma.bingoPrizeAllocation.upsert({
      where: { claimId: claim.id },
      create: {
        roundId,
        claimId: claim.id,
        playerId: claim.playerId,
        amountMinorUnits: prize,
        currency: 'KES',
        status: credit.status === 'CONFIRMED' ? AllocationStatus.SETTLED : AllocationStatus.PENDING,
        financialRefId: finRef.id,
        settledAt: credit.status === 'CONFIRMED' ? new Date() : null,
      },
      update: {
        status: credit.status === 'CONFIRMED' ? AllocationStatus.SETTLED : AllocationStatus.PENDING,
        settledAt: credit.status === 'CONFIRMED' ? new Date() : null,
      },
    });

    await prisma.bingoWinClaim.update({
      where: { id: claim.id },
      data: { status: credit.status === 'CONFIRMED' ? ClaimStatus.SETTLED : ClaimStatus.ALLOCATED },
    });

    results.push({ claimId: claim.id, status: credit.status });
  }

  await recordAudit({
    actorId,
    actorRole: 'system',
    action: 'PRIZES_SETTLED',
    targetType: 'BingoRound',
    targetId: roundId,
    roundId,
    metadata: { count: results.length },
  });

  broadcastRoundCompleted(roundId, { settledCount: results.length });

  return results;
}
