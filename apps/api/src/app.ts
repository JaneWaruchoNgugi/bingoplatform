import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { logger } from './lib/logger';
import { requestId } from './middleware/requestId';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';
import { healthRouter } from './modules/health/health.router';
import { bingoRouter } from './modules/bingo/bingo.router';
import { adminRouter } from './modules/bingo/admin/admin.router';
import { openApiSpec } from './openapi/spec';

export function createApp(): express.Application {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'x-mock-player-id', 'x-mock-admin-token'],
      exposedHeaders: ['X-Request-Id'],
    }),
  );
  app.use(requestId);
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));

  if (config.NODE_ENV !== 'test') {
    app.use(pinoHttp({ logger }));
  }

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded' } },
    }),
  );

  // Docs
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get('/api/openapi.json', (_req, res) => res.json(openApiSpec));

  // Routes
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/bingo', bingoRouter);
  app.use('/api/v1/admin', adminRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
