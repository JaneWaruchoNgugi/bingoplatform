/**
 * Socket.IO live gameplay layer.
 * Events:
 *   round:join       – player joins a round room
 *   round:leave      – player leaves a round room
 *   round:snapshot   – server → client: current round state + draw history
 *   round:status     – server → client: round status change
 *   draw:number      – server → client: new number drawn
 *   draw:history     – server → client: full draw history on reconnect
 *   ticket:update    – server → client: ticket win state change
 *   round:completed  – server → client: round over, final results
 *
 * Auth: player ID is taken from x-mock-player-id header (dev/test).
 * Production: replace with JWT verification in the 'connection' middleware.
 *
 * Multi-instance: configure socket.io Redis adapter at the server level.
 * Currently single-instance; reconnects recover from PostgreSQL, not Redis.
 */

import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { prisma } from '../../../lib/prisma';
import { logger } from '../../../lib/logger';
import { config } from '../../../config';
import { MOCK_PLAYER_HEADER } from '../../../lib/auth';

let _io: Server | null = null;

export function getIO(): Server {
  if (!_io) throw new Error('Socket.IO not initialized');
  return _io;
}

export function initSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: config.CORS_ORIGIN, credentials: true },
    transports: ['websocket', 'polling'],
  });

  // Auth middleware
  io.use((socket, next) => {
    const playerId =
      (socket.handshake.headers[MOCK_PLAYER_HEADER] as string | undefined) ??
      socket.handshake.auth?.playerId as string | undefined;

    if (!playerId && config.NODE_ENV === 'production') {
      return next(new Error('Authentication required'));
    }
    (socket as Socket & { playerId?: string }).playerId = playerId ?? 'anonymous';
    next();
  });

  io.on('connection', (socket) => {
    const playerId = (socket as Socket & { playerId?: string }).playerId ?? 'anonymous';
    logger.info({ socketId: socket.id, playerId }, 'Socket connected');

    socket.on('round:join', async (roundId: string) => {
      try {
        const round = await prisma.bingoRound.findUnique({
          where: { id: roundId },
          select: { id: true, status: true, totalTickets: true },
        });
        if (!round) { socket.emit('error', { code: 'NOT_FOUND', message: 'Round not found' }); return; }

        await socket.join(`round:${roundId}`);

        const draws = await prisma.bingoDrawEvent.findMany({
          where: { roundId },
          orderBy: { sequence: 'asc' },
          select: { sequence: true, number: true, drawnAt: true },
        });

        socket.emit('round:snapshot', {
          round,
          draws,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        logger.error({ err, roundId }, 'round:join error');
      }
    });

    socket.on('round:leave', async (roundId: string) => {
      await socket.leave(`round:${roundId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'Socket disconnected');
    });
  });

  _io = io;
  return io;
}

/** Broadcast a new draw to all clients in a round room. */
export async function broadcastDraw(roundId: string, draw: { sequence: number; number: number; drawnAt: Date }) {
  if (!_io) return;
  _io.to(`round:${roundId}`).emit('draw:number', { roundId, ...draw });
}

/** Broadcast round status change. */
export function broadcastRoundStatus(roundId: string, status: string) {
  if (!_io) return;
  _io.to(`round:${roundId}`).emit('round:status', { roundId, status });
}

/** Broadcast round completion. */
export function broadcastRoundCompleted(roundId: string, results: unknown) {
  if (!_io) return;
  _io.to(`round:${roundId}`).emit('round:completed', { roundId, results });
}
