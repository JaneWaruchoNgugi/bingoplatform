import { Router } from 'express';
import { requirePlayer } from '../../middleware/auth';
import { categoriesRouter } from './categories/categories.router';
import { roundsRouter } from './rounds/rounds.router';
import {
  createPurchaseHandler,
  getTicketHandler,
  getTicketCardHandler,
  getPurchaseHandler,
  listMyPurchasesHandler,
  listMyTicketsHandler,
} from './purchases/purchases.controller';
import {
  getTicketWinsHandler,
  listMyWinsHandler,
  listMyPrizesHandler,
  getBingoHistoryHandler,
} from './wins/wins.controller';
import { roundIdSchema } from './rounds/rounds.schema';

const router = Router();

// Public category & round routes
router.use('/categories', categoriesRouter);
router.use('/rounds', roundsRouter);

// Auth-gated purchase
router.post('/rounds/:roundId/purchases', requirePlayer, createPurchaseHandler);

// Auth-gated ticket/purchase reads
router.get('/purchases/:purchaseId', requirePlayer, getPurchaseHandler);
router.get('/tickets/:ticketId', requirePlayer, getTicketHandler);
router.get('/tickets/:ticketId/card', requirePlayer, getTicketCardHandler);
router.get('/tickets/:ticketId/wins', requirePlayer, getTicketWinsHandler);
router.get('/me/tickets', requirePlayer, listMyTicketsHandler);
router.get('/me/purchases', requirePlayer, listMyPurchasesHandler);
router.get('/me/wins', requirePlayer, listMyWinsHandler);
router.get('/me/prizes', requirePlayer, listMyPrizesHandler);
router.get('/history', requirePlayer, getBingoHistoryHandler);

export { router as bingoRouter };
