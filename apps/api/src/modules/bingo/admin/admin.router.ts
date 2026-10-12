import { Router } from 'express';
import { requireAdmin } from '../../../middleware/auth';
import {
  getCategories,
  createCategoryHandler,
  updateCategoryHandler,
} from '../categories/categories.controller';
import {
  createRoundHandler,
  updateRoundHandler,
  openSalesHandler,
  closeSalesHandler,
  startRoundHandler,
  cancelRoundHandler,
  listRoundsHandler,
  getRoundHandler,
} from '../rounds/rounds.controller';
import { completeRound } from '../rounds/rounds.service';
import { drawNumber } from '../draws/draws.service';
import { verifyAndClaimWins, settleAllocations } from '../wins/wins.service';
import { getWalletAdapter } from '../../../lib/wallet';
import { ok, fail } from '../../../types/response';
import { roundIdSchema } from '../rounds/rounds.schema';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../lib/prisma';
import { paginationSchema } from '../../users/users.schema';

const router = Router();
router.use(requireAdmin);

// ── Categories ────────────────────────────────────────────────────────────────
router.get('/bingo/categories', getCategories);
router.post('/bingo/categories', createCategoryHandler);
router.patch('/bingo/categories/:categoryId', updateCategoryHandler);

// ── Rounds ────────────────────────────────────────────────────────────────────
router.get('/bingo/rounds', listRoundsHandler);
router.post('/bingo/rounds', createRoundHandler);
router.get('/bingo/rounds/:roundId', getRoundHandler);
router.patch('/bingo/rounds/:roundId', updateRoundHandler);
router.post('/bingo/rounds/:roundId/open-sales', openSalesHandler);
router.post('/bingo/rounds/:roundId/close-sales', closeSalesHandler);
router.post('/bingo/rounds/:roundId/start', startRoundHandler);
router.post('/bingo/rounds/:roundId/cancel', cancelRoundHandler);

// Complete round: IN_PROGRESS → COMPLETED
router.post('/bingo/rounds/:roundId/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = roundIdSchema.safeParse(req.params['roundId']);
    if (!r.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid round ID', req.id)); return; }
    const actorId = req.admin?.adminId ?? 'system';
    res.json(ok(await completeRound(r.data, actorId), req.id));
  } catch (e) { next(e); }
});

// ── Draw (admin-only) ─────────────────────────────────────────────────────────
router.post('/bingo/rounds/:roundId/draw', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = roundIdSchema.safeParse(req.params['roundId']);
    if (!r.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid round ID', req.id)); return; }
    const actorId = req.admin?.adminId ?? 'system';
    res.status(201).json(ok(await drawNumber(r.data, actorId), req.id));
  } catch (e) { next(e); }
});

// ── Win lifecycle ─────────────────────────────────────────────────────────────
router.post('/bingo/rounds/:roundId/verify-wins', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = roundIdSchema.safeParse(req.params['roundId']);
    if (!r.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid round ID', req.id)); return; }
    const actorId = req.admin?.adminId ?? 'system';
    res.json(ok(await verifyAndClaimWins(r.data, actorId), req.id));
  } catch (e) { next(e); }
});

// Settle prizes (MOCK — real money disabled)
router.post('/bingo/rounds/:roundId/settle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = roundIdSchema.safeParse(req.params['roundId']);
    if (!r.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid round ID', req.id)); return; }
    const actorId = req.admin?.adminId ?? 'system';
    res.json(ok(await settleAllocations(r.data, actorId), req.id));
  } catch (e) { next(e); }
});

// ── Purchase reconciliation ───────────────────────────────────────────────────
// Resolves PENDING purchases whose wallet transaction outcome is still unknown.
// Calls wallet.reconcile(externalRef) and updates purchase + financial ref status.
const purchaseIdSchema = z.string().uuid();

router.post('/bingo/purchases/:purchaseId/reconcile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pId = purchaseIdSchema.safeParse(req.params['purchaseId']);
    if (!pId.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid purchase ID', req.id)); return; }

    const purchase = await prisma.bingoPurchase.findUnique({
      where: { id: pId.data },
      include: { financialRef: true },
    });
    if (!purchase) { res.status(404).json(fail('NOT_FOUND', 'Purchase not found', req.id)); return; }
    if (purchase.status !== 'PENDING') {
      res.json(ok({ purchaseId: pId.data, status: purchase.status, reconciled: false, reason: 'not_pending' }, req.id));
      return;
    }
    if (!purchase.financialRef) {
      res.status(409).json(fail('NO_FINANCIAL_REF', 'Purchase has no financial reference to reconcile', req.id));
      return;
    }

    const wallet = getWalletAdapter();
    const outcome = await wallet.reconcile(purchase.financialRef.externalRef);

    const newPurchaseStatus = outcome.status === 'CONFIRMED' ? 'CONFIRMED' : 'FAILED';
    const newFinRefStatus = outcome.status;

    await prisma.$transaction([
      prisma.bingoPurchase.update({
        where: { id: pId.data },
        data: { status: newPurchaseStatus as 'CONFIRMED' | 'FAILED' },
      }),
      prisma.bingoFinancialReference.update({
        where: { id: purchase.financialRefId! },
        data: { status: newFinRefStatus },
      }),
    ]);

    // If reconciliation failed, void all tickets for this purchase
    if (outcome.status === 'FAILED') {
      await prisma.bingoTicket.updateMany({
        where: { purchaseId: pId.data },
        data: { isVoid: true },
      });
    }

    res.json(ok({ purchaseId: pId.data, status: newPurchaseStatus, reconciled: true, walletStatus: outcome.status }, req.id));
  } catch (e) { next(e); }
});

// ── Reports ───────────────────────────────────────────────────────────────────
router.get('/bingo/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalRounds, totalPurchases, totalTickets, totalCategories, pendingPurchases] =
      await prisma.$transaction([
        prisma.bingoRound.count(),
        prisma.bingoPurchase.count(),
        prisma.bingoTicket.count(),
        prisma.bingoCategory.count(),
        prisma.bingoPurchase.count({ where: { status: 'PENDING' } }),
      ]);
    res.json(ok({ totalRounds, totalPurchases, totalTickets, totalCategories, pendingPurchases }, req.id));
  } catch (e) { next(e); }
});

// ── Audit events ──────────────────────────────────────────────────────────────
router.get('/bingo/audit-events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const p = paginationSchema.safeParse(req.query);
    if (!p.success) { res.status(400).json(fail('VALIDATION_ERROR', 'Invalid pagination', req.id)); return; }
    const roundId = req.query['roundId'] as string | undefined;
    const skip = (p.data.page - 1) * p.data.limit;
    const where = roundId ? { roundId } : {};
    const [events, total] = await prisma.$transaction([
      prisma.bingoAuditEvent.findMany({ where, skip, take: p.data.limit, orderBy: { createdAt: 'desc' } }),
      prisma.bingoAuditEvent.count({ where }),
    ]);
    res.json(ok(events, req.id, { page: p.data.page, limit: p.data.limit, total, totalPages: Math.ceil(total / p.data.limit) }));
  } catch (e) { next(e); }
});

// Results alias
router.get('/bingo/results/:roundId', getRoundHandler);

export { router as adminRouter };
