import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const globalWithPrisma = globalThis as typeof globalThis & {
  _prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalWithPrisma._prisma ??
  new PrismaClient({
    log: config.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });

if (config.NODE_ENV !== 'production') {
  globalWithPrisma._prisma = prisma;
}
