import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load root monorepo .env first (apps/api -> bingo-platform/.env)
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
// Local .env fills any remaining gaps without overriding
dotenv.config();

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default('info'),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const missing = Object.entries(errors)
      .map(([k, v]) => `${k}: ${(v ?? []).join(', ')}`)
      .join('; ');
    console.error(`Invalid environment configuration — ${missing}`);
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
