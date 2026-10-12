import { describe, it, expect } from 'vitest';
import { uuidSchema, paginationSchema, createUserSchema } from '../../src/modules/users/users.schema';

describe('uuidSchema', () => {
  it('accepts a valid UUID v4', () => {
    expect(uuidSchema.safeParse('a3bb189e-8bf9-3888-9912-ace4e6543002').success).toBe(true);
  });
  it('rejects a plain string', () => {
    expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
  });
  it('rejects an empty string', () => {
    expect(uuidSchema.safeParse('').success).toBe(false);
  });
});

describe('paginationSchema', () => {
  it('defaults page=1 and limit=20', () => {
    const r = paginationSchema.parse({});
    expect(r).toEqual({ page: 1, limit: 20 });
  });
  it('coerces string numbers', () => {
    const r = paginationSchema.parse({ page: '2', limit: '5' });
    expect(r).toEqual({ page: 2, limit: 5 });
  });
  it('rejects limit > 100', () => {
    expect(paginationSchema.safeParse({ limit: '200' }).success).toBe(false);
  });
  it('rejects page < 1', () => {
    expect(paginationSchema.safeParse({ page: '0' }).success).toBe(false);
  });
});

describe('createUserSchema', () => {
  it('accepts minimal valid input', () => {
    expect(createUserSchema.safeParse({ username: 'jane' }).success).toBe(true);
  });
  it('accepts full valid input', () => {
    const r = createUserSchema.safeParse({
      username: 'jane_01',
      email: 'jane@example.com',
      password: 'secure-pw!',
    });
    expect(r.success).toBe(true);
  });
  it('rejects username shorter than 3 chars', () => {
    expect(createUserSchema.safeParse({ username: 'ab' }).success).toBe(false);
  });
  it('rejects username with invalid characters', () => {
    expect(createUserSchema.safeParse({ username: 'bad user!' }).success).toBe(false);
  });
  it('rejects invalid email format', () => {
    expect(createUserSchema.safeParse({ username: 'jane', email: 'not-email' }).success).toBe(false);
  });
  it('rejects password shorter than 8 chars', () => {
    expect(
      createUserSchema.safeParse({ username: 'jane', password: 'short' }).success,
    ).toBe(false);
  });
});
