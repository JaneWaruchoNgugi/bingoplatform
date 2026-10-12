import { describe, it, expect } from 'vitest';
import { ok, fail } from '../../src/types/response';

describe('ok()', () => {
  it('returns success envelope', () => {
    const r = ok({ id: '1' }, 'req-001');
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ id: '1' });
    expect(r.requestId).toBe('req-001');
    expect(r.meta).toBeUndefined();
  });
  it('includes meta when provided', () => {
    const meta = { page: 1, limit: 20, total: 5, totalPages: 1 };
    const r = ok([], 'req-001', meta);
    expect(r.meta).toEqual(meta);
  });
});

describe('fail()', () => {
  it('returns error envelope', () => {
    const r = fail('NOT_FOUND', 'Resource missing', 'req-002');
    expect(r.success).toBe(false);
    expect(r.error.code).toBe('NOT_FOUND');
    expect(r.error.message).toBe('Resource missing');
    expect(r.requestId).toBe('req-002');
  });
  it('includes details when provided', () => {
    const r = fail('VALIDATION_ERROR', 'Bad input', 'req-003', { field: 'email' });
    expect(r.error.details).toEqual({ field: 'email' });
  });
});
