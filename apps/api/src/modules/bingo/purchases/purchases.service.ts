import { randomBytes } from 'crypto';
import { Prisma, RoundStatus, PurchaseStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { getWalletAdapter } from '../../../lib/wallet';
import { NotFoundError, ValidationError, SalesClosedError, ConflictError } from '../../../lib/errors';
import { generateCard } from '../cards/card.service';
import type { CreatePurchaseInput } from './purchases.schema';

function generateSerial(roundId: string): string {
  return `BNG-${roundId.slice(0, 8).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function createPurchase(
  roundId: string,
  playerId: string,
  input: CreatePurchaseInput,
) {
  const round = await prisma.bingoRound.findUnique({
    where: { id: roundId },
    include: { category: true },
  });
  if (!round) throw new NotFoundError('Round');
  if (round.status !== RoundStatus.OPEN_FOR_SALE) throw new SalesClosedError();

  const { ticketCount, idempotencyKey } = input;
  if (ticketCount > round.category.maxTicketsPerPurchase) {
    throw new ValidationError(
      `Maximum ${round.category.maxTicketsPerPurchase} tickets per purchase`,
    );
  }
  if (round.maxTickets !== null && round.totalTickets + ticketCount > round.maxTickets) {
    throw new ValidationError('Not enough tickets available');
  }

  // Idempotency: return existing purchase if key already used
  const existing = await prisma.bingoPurchase.findUnique({ where: { idempotencyKey } });
  if (existing) {
    const tickets = await prisma.bingoTicket.findMany({ where: { purchaseId: existing.id } });
    return { purchase: existing, tickets };
  }

  const totalAmount = round.category.priceMinorUnits * ticketCount;
  const currency = round.category.currency;

  // Debit wallet (mock in dev/test)
  const wallet = getWalletAdapter();
  const debitResult = await wallet.debit(
    playerId,
    totalAmount,
    currency,
    idempotencyKey,
    `Bingo tickets for round ${roundId}`,
  );

  // Transactionally create purchase, financial ref, tickets, and cards
  const result = await prisma.$transaction(async (tx) => {
    // Optimistic-lock round totalTickets
    const locked = await tx.bingoRound.findUnique({ where: { id: roundId }, select: { totalTickets: true, maxTickets: true, version: true } });
    if (!locked) throw new NotFoundError('Round');
    if (locked.maxTickets !== null && locked.totalTickets + ticketCount > locked.maxTickets) {
      throw new ValidationError('Not enough tickets available');
    }

    const finRef = await tx.bingoFinancialReference.create({
      data: {
        externalRef: debitResult.externalRef,
        type: 'DEBIT',
        amountMinorUnits: totalAmount,
        currency,
        status: debitResult.status,
        playerId,
      },
    });

    const purchase = await tx.bingoPurchase.create({
      data: {
        roundId,
        playerId,
        status: debitResult.status === 'CONFIRMED' ? PurchaseStatus.CONFIRMED : PurchaseStatus.PENDING,
        ticketCount,
        pricePerTicket: round.category.priceMinorUnits,
        totalAmount,
        currency,
        idempotencyKey,
        financialRefId: finRef.id,
      },
    });

    const tickets = await Promise.all(
      Array.from({ length: ticketCount }).map(async () => {
        const ticket = await tx.bingoTicket.create({
          data: {
            roundId,
            purchaseId: purchase.id,
            playerId,
            serialNumber: generateSerial(roundId),
          },
        });
        const card = generateCard();
        await tx.bingoCard.create({ data: { ticketId: ticket.id, numbers: card } });
        return ticket;
      }),
    );

    await tx.bingoRound.update({
      where: { id: roundId },
      data: { totalTickets: { increment: ticketCount }, version: { increment: 1 } },
    });

    return { purchase, tickets };
  });

  return result;
}

export async function getPurchaseById(id: string) {
  const p = await prisma.bingoPurchase.findUnique({
    where: { id },
    include: { tickets: { select: { id: true, serialNumber: true, isVoid: true } } },
  });
  if (!p) throw new NotFoundError('Purchase');
  return p;
}

export async function listMyPurchases(playerId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [purchases, total] = await prisma.$transaction([
    prisma.bingoPurchase.findMany({
      where: { playerId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.bingoPurchase.count({ where: { playerId } }),
  ]);
  return { purchases, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getTicketById(id: string) {
  const t = await prisma.bingoTicket.findUnique({
    where: { id },
    include: { card: true },
  });
  if (!t) throw new NotFoundError('Ticket');
  return t;
}

export async function getTicketCard(id: string) {
  const t = await prisma.bingoTicket.findUnique({
    where: { id },
    include: { card: true },
  });
  if (!t) throw new NotFoundError('Ticket');
  if (!t.card) throw new NotFoundError('Card');
  return t.card;
}

export async function listMyTickets(playerId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [tickets, total] = await prisma.$transaction([
    prisma.bingoTicket.findMany({
      where: { playerId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { card: true },
    }),
    prisma.bingoTicket.count({ where: { playerId } }),
  ]);
  return { tickets, total, page, limit, totalPages: Math.ceil(total / limit) };
}
