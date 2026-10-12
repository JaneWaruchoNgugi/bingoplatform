import http from 'http';
import { createApp } from './app';
import { config } from './config';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { connectRedis, disconnectRedis } from './lib/redis';
import { initSocket } from './modules/bingo/live/socket';
import { getWalletAdapter, mockWalletAdapter } from './lib/wallet';
import { getAuthAdapter, mockAuthAdapter } from './lib/auth';

function assertAdaptersNotMocked(): void {
  if (config.NODE_ENV !== 'production') return;
  if (getWalletAdapter() === mockWalletAdapter) {
    console.error('FATAL: mockWalletAdapter is still active in production. Call setWalletAdapter() with a real implementation.');
    process.exit(1);
  }
  if (getAuthAdapter() === mockAuthAdapter) {
    console.error('FATAL: mockAuthAdapter is still active in production. Call setAuthAdapter() with a real implementation.');
    process.exit(1);
  }
}

async function startServer(): Promise<void> {
  assertAdaptersNotMocked();

  const app = createApp();
  const server = http.createServer(app);

  // Socket.IO — attach before listen
  initSocket(server);

  await connectRedis();
  logger.info('Dependencies connected');

  server.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Bingo Platform API listening');
    logger.info(`Swagger UI:   http://localhost:${config.PORT}/api/docs`);
    logger.info(`OpenAPI JSON: http://localhost:${config.PORT}/api/openapi.json`);
  });

  async function gracefulShutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Shutdown signal received');
    server.close(async () => {
      try {
        await prisma.$disconnect();
        await disconnectRedis();
        logger.info('Clean shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    });
    setTimeout(() => { logger.warn('Forced shutdown after timeout'); process.exit(1); }, 10_000).unref();
  }

  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => { logger.error({ reason }, 'Unhandled promise rejection'); });
  process.on('uncaughtException', (err) => { logger.error({ err }, 'Uncaught exception — exiting'); process.exit(1); });
}

startServer().catch((err: unknown) => { console.error('Failed to start server:', err); process.exit(1); });
