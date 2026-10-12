import { prisma } from '../../lib/prisma';
import { getRedisClient } from '../../lib/redis';

export interface ReadinessResult {
  database: boolean;
  redis: boolean;
  ready: boolean;
}

export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function checkRedis(): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (!client.isOpen) return false;
    const reply = await client.ping();
    return reply === 'PONG';
  } catch {
    return false;
  }
}

export async function getReadiness(): Promise<ReadinessResult> {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  return { database, redis, ready: database && redis };
}
