import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../lib/logger';
import { AppError } from '../lib/errors';
import { fail } from '../types/response';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // _next required by Express 4 signature
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(fail(err.code, err.message, req.id));
    return;
  }

  // express.json() body-parser sets err.status = 400 on malformed JSON
  if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400) {
    res.status(400).json(fail('INVALID_JSON', 'Malformed JSON body', req.id));
    return;
  }

  logger.error({ err, requestId: req.id, method: req.method, path: req.path }, 'Unhandled error');

  res.status(500).json(
    fail(
      'INTERNAL_ERROR',
      'An internal error occurred',
      req.id,
      config.NODE_ENV === 'development' ? { stack: err.stack } : undefined,
    ),
  );
}
