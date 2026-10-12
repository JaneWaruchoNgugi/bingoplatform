import type { Request, Response } from 'express';
import { getReadiness } from './health.service';
import { ok, fail } from '../../types/response';

export async function liveness(req: Request, res: Response): Promise<void> {
  res.status(200).json(ok({ status: 'ok' }, req.id));
}

export async function readiness(req: Request, res: Response): Promise<void> {
  const result = await getReadiness();
  if (result.ready) {
    res.status(200).json(ok(result, req.id));
  } else {
    res
      .status(503)
      .json(
        fail('SERVICE_UNAVAILABLE', 'One or more dependencies are unavailable', req.id, result),
      );
  }
}
