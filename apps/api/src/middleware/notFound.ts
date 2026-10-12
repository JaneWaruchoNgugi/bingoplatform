import type { Request, Response } from 'express';
import { fail } from '../types/response';

export function notFound(req: Request, res: Response): void {
  res.status(404).json(
    fail('NOT_FOUND', `Route ${req.method} ${req.path} not found`, req.id),
  );
}
