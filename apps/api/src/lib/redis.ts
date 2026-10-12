import { createClient } from 'redis';
import { config } from '../config';
import { logger } from './logger';

type RedisClient = ReturnType<typeof createClient>;

let _client: RedisClient | null = null;

export function getRedisClient(): RedisClient {
  if (!_client) {
    _client = createClient({ url: config.REDIS_URL });
    _client.on('error', (err: Error) => logger.error({ err }, 'Redis client error'));
    _client.on('reconnecting', () => logger.warn('Redis reconnecting'));
  }
  return _client;
}

export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  if (!client.isOpen) {
    await client.connect();
    logger.info('Redis connected');
  }
}

export async function disconnectRedis(): Promise<void> {
  if (_client?.isOpen) {
    await _client.quit();
    logger.info('Redis disconnected');
  }
  _client = null;
}
