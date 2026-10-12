import type { Request, Response, NextFunction } from 'express';
import { ok, fail } from '../../../types/response';
import { roundIdSchema } from '../rounds/rounds.schema';
import { purchaseIdSchema, ticketIdSchema, createPurchaseSchema } from './purchases.schema';
import { paginationSchema } from '../../users/users.schema';
import {
  createPurchase,
  getPurchaseById,
  listMyPurchases,
  getTicketById,
  getTicketCard,
  listMyTickets,
} from './purchases.service';

export async function createPurchaseHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const rId = roundIdSchema.safeParse(req.params['roundId']);
    if (!rId.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid round ID', req.id)); return; }
    const body = createPurchaseSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json(fail('VALIDATION_ERROR', 'Invalid body', req.id, body.error.flatten())); return; }
    const playerId = req.player?.playerId ?? '';
    const result = await createPurchase(rId.data, playerId, body.data);
    res.status(201).json(ok(result, req.id));
  } catch (e) { next(e); }
}

export async function getPurchaseHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const pId = purchaseIdSchema.safeParse(req.params['purchaseId']);
    if (!pId.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid purchase ID', req.id)); return; }
    const purchase = await getPurchaseById(pId.data);
    if (purchase.playerId !== req.player?.playerId) { res.status(403).json(fail('FORBIDDEN', 'Not your purchase', req.id)); return; }
    res.json(ok(purchase, req.id));
  } catch (e) { next(e); }
}

export async function listMyPurchasesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const p = paginationSchema.safeParse(req.query);
    if (!p.success) { res.status(400).json(fail('VALIDATION_ERROR', 'Invalid pagination', req.id)); return; }
    const playerId = req.player?.playerId ?? '';
    const result = await listMyPurchases(playerId, p.data.page, p.data.limit);
    const { purchases, ...meta } = result;
    res.json(ok(purchases, req.id, meta));
  } catch (e) { next(e); }
}

export async function getTicketHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const tId = ticketIdSchema.safeParse(req.params['ticketId']);
    if (!tId.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid ticket ID', req.id)); return; }
    const ticket = await getTicketById(tId.data);
    if (ticket.playerId !== req.player?.playerId) { res.status(403).json(fail('FORBIDDEN', 'Not your ticket', req.id)); return; }
    res.json(ok(ticket, req.id));
  } catch (e) { next(e); }
}

export async function getTicketCardHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const tId = ticketIdSchema.safeParse(req.params['ticketId']);
    if (!tId.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid ticket ID', req.id)); return; }
    const ticket = await getTicketById(tId.data);
    if (ticket.playerId !== req.player?.playerId) { res.status(403).json(fail('FORBIDDEN', 'Not your ticket', req.id)); return; }
    res.json(ok(await getTicketCard(tId.data), req.id));
  } catch (e) { next(e); }
}

export async function listMyTicketsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const p = paginationSchema.safeParse(req.query);
    if (!p.success) { res.status(400).json(fail('VALIDATION_ERROR', 'Invalid pagination', req.id)); return; }
    const playerId = req.player?.playerId ?? '';
    const result = await listMyTickets(playerId, p.data.page, p.data.limit);
    const { tickets, ...meta } = result;
    res.json(ok(tickets, req.id, meta));
  } catch (e) { next(e); }
}
