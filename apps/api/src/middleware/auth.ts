import type { Request, Response, NextFunction } from 'express';
import {
  getAuthAdapter,
  MOCK_PLAYER_HEADER,
  MOCK_ADMIN_HEADER,
  type PlayerContext,
  type AdminContext,
} from '../lib/auth';
import { fail } from '../types/response';
import { config } from '../config';

declare global {
  namespace Express {
    interface Request {
      player?: PlayerContext;
      admin?: AdminContext;
    }
  }
}

export function requirePlayer(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    try {
      const adapter = getAuthAdapter();
      let player: PlayerContext | null = null;

      const authHeader = req.headers['authorization'];
      if (authHeader?.startsWith('Bearer ')) {
        player = await adapter.verifyPlayerToken(authHeader.slice(7));
      } else if (config.NODE_ENV !== 'production') {
        const mockId = req.headers[MOCK_PLAYER_HEADER] as string | undefined;
        if (mockId) player = await adapter.verifyPlayerToken(mockId);
      }

      if (!player) {
        res.status(401).json(fail('UNAUTHORIZED', 'Authentication required', req.id));
        return;
      }
      req.player = player;
      next();
    } catch (err) {
      next(err);
    }
  })();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    try {
      if (config.NODE_ENV === 'production') {
        // Production: only real JWT-based admin auth (not yet implemented)
        res.status(401).json(fail('UNAUTHORIZED', 'Admin authentication required', req.id));
        return;
      }
      const adapter = getAuthAdapter();
      const token =
        (req.headers['authorization'] as string | undefined)?.replace('Bearer ', '') ??
        (req.headers[MOCK_ADMIN_HEADER] as string | undefined) ??
        '';
      const admin = await adapter.verifyAdminToken(token);
      if (!admin) {
        res.status(403).json(fail('FORBIDDEN', 'Admin authorization required', req.id));
        return;
      }
      req.admin = admin;
      next();
    } catch (err) {
      next(err);
    }
  })();
}
