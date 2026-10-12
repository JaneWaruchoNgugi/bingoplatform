import type { Request, Response, NextFunction } from 'express';
import { ok, fail } from '../../../types/response';
import {
  roundIdSchema,
  listRoundsSchema,
  createRoundSchema,
  updateRoundSchema,
  cancelRoundSchema,
} from './rounds.schema';
import {
  listRounds,
  getRoundById,
  getRoundState,
  getRoundNumbers,
  getRoundWinners,
  getRoundResults,
  createRound,
  updateRound,
  openSales,
  closeSales,
  startRound,
  cancelRound,
} from './rounds.service';

const id = (req: Request) => roundIdSchema.safeParse(req.params['roundId']);

export async function listRoundsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const p = listRoundsSchema.safeParse(req.query);
    if (!p.success) { res.status(400).json(fail('VALIDATION_ERROR', 'Invalid query', req.id, p.error.flatten())); return; }
    const result = await listRounds(p.data);
    const { rounds, ...meta } = result;
    res.json(ok(rounds, req.id, meta));
  } catch (e) { next(e); }
}

export async function getRoundHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const r = id(req);
    if (!r.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid round ID', req.id)); return; }
    res.json(ok(await getRoundById(r.data), req.id));
  } catch (e) { next(e); }
}

export async function getRoundStateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const r = id(req);
    if (!r.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid round ID', req.id)); return; }
    res.json(ok(await getRoundState(r.data), req.id));
  } catch (e) { next(e); }
}

export async function getRoundNumbersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const r = id(req);
    if (!r.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid round ID', req.id)); return; }
    res.json(ok(await getRoundNumbers(r.data), req.id));
  } catch (e) { next(e); }
}

export async function getRoundWinnersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const r = id(req);
    if (!r.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid round ID', req.id)); return; }
    res.json(ok(await getRoundWinners(r.data), req.id));
  } catch (e) { next(e); }
}

export async function getRoundResultsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const r = id(req);
    if (!r.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid round ID', req.id)); return; }
    res.json(ok(await getRoundResults(r.data), req.id));
  } catch (e) { next(e); }
}

export async function createRoundHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createRoundSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json(fail('VALIDATION_ERROR', 'Invalid body', req.id, body.error.flatten())); return; }
    const actorId = req.admin?.adminId ?? 'unknown';
    res.status(201).json(ok(await createRound(body.data, actorId), req.id));
  } catch (e) { next(e); }
}

export async function updateRoundHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const r = id(req);
    if (!r.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid round ID', req.id)); return; }
    const body = updateRoundSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json(fail('VALIDATION_ERROR', 'Invalid body', req.id, body.error.flatten())); return; }
    const actorId = req.admin?.adminId ?? 'unknown';
    res.json(ok(await updateRound(r.data, body.data, actorId), req.id));
  } catch (e) { next(e); }
}

async function transition(
  fn: (id: string, actorId: string) => Promise<unknown>,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const r = id(req);
    if (!r.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid round ID', req.id)); return; }
    const actorId = req.admin?.adminId ?? 'unknown';
    res.json(ok(await fn(r.data, actorId), req.id));
  } catch (e) { next(e); }
}

export const openSalesHandler = (req: Request, res: Response, next: NextFunction) =>
  transition(openSales, req, res, next);
export const closeSalesHandler = (req: Request, res: Response, next: NextFunction) =>
  transition(closeSales, req, res, next);
export const startRoundHandler = (req: Request, res: Response, next: NextFunction) =>
  transition(startRound, req, res, next);

export async function cancelRoundHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const r = id(req);
    if (!r.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid round ID', req.id)); return; }
    const body = cancelRoundSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json(fail('VALIDATION_ERROR', 'Reason required', req.id, body.error.flatten())); return; }
    const actorId = req.admin?.adminId ?? 'unknown';
    res.json(ok(await cancelRound(r.data, body.data, actorId), req.id));
  } catch (e) { next(e); }
}
