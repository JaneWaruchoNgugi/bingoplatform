import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/bingo_test',
      REDIS_URL: 'redis://localhost:6379',
      NODE_ENV: 'test',
      PORT: '3333',
      LOG_LEVEL: 'silent',
    },
  },
});
