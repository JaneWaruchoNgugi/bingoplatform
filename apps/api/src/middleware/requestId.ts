import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string | undefined) ?? uuidv4();
  // pino-http types req.id as string | number; our middleware always sets a string
  (req as Request & { id: string }).id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
