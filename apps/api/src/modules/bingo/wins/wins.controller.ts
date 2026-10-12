import type { Request, Response, NextFunction } from 'express';
import { ok, fail } from '../../../types/response';
import { ticketIdSchema } from '../purchases/purchases.schema';
import { paginationSchema } from '../../users/users.schema';
import { getTicketWins, listMyWins, listMyPrizes, getBingoHistory } from './wins.service';

export async function getTicketWinsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const tId = ticketIdSchema.safeParse(req.params['ticketId']);
    if (!tId.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid ticket ID', req.id)); return; }
    const playerId = req.player?.playerId ?? '';
    res.json(ok(await getTicketWins(tId.data, playerId), req.id));
  } catch (e) { next(e); }
}

export async function listMyWinsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const p = paginationSchema.safeParse(req.query);
    if (!p.success) { res.status(400).json(fail('VALIDATION_ERROR', 'Invalid pagination', req.id)); return; }
    const playerId = req.player?.playerId ?? '';
    const result = await listMyWins(playerId, p.data.page, p.data.limit);
    const { claims, ...meta } = result;
    res.json(ok(claims, req.id, meta));
  } catch (e) { next(e); }
}

export async function listMyPrizesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const p = paginationSchema.safeParse(req.query);
    if (!p.success) { res.status(400).json(fail('VALIDATION_ERROR', 'Invalid pagination', req.id)); return; }
    const playerId = req.player?.playerId ?? '';
    const result = await listMyPrizes(playerId, p.data.page, p.data.limit);
    const { allocations, ...meta } = result;
    res.json(ok(allocations, req.id, meta));
  } catch (e) { next(e); }
}

export async function getBingoHistoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const p = paginationSchema.safeParse(req.query);
    if (!p.success) { res.status(400).json(fail('VALIDATION_ERROR', 'Invalid pagination', req.id)); return; }
    const playerId = req.player?.playerId ?? '';
    const result = await getBingoHistory(playerId, p.data.page, p.data.limit);
    const { rounds, ...meta } = result;
    res.json(ok(rounds, req.id, meta));
  } catch (e) { next(e); }
}
