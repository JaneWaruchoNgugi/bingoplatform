import { describe, it, expect } from 'vitest';
import {
  AppError,
  NotFoundError,
  ConflictError,
  ValidationError,
  ForbiddenError,
  RoundStateError,
  SalesClosedError,
} from '../../src/lib/errors';

describe('AppError hierarchy', () => {
  it('NotFoundError has 404 status', () => {
    const e = new NotFoundError('Round');
    expect(e.statusCode).toBe(404);
    expect(e.code).toBe('NOT_FOUND');
    expect(e.message).toBe('Round not found');
  });

  it('ConflictError has 409 status', () => {
    const e = new ConflictError('duplicate');
    expect(e.statusCode).toBe(409);
  });

  it('ValidationError has 400 status', () => {
    expect(new ValidationError('bad').statusCode).toBe(400);
  });

  it('ForbiddenError has 403 status', () => {
    expect(new ForbiddenError().statusCode).toBe(403);
  });

  it('RoundStateError encodes transition info', () => {
    const e = new RoundStateError('SCHEDULED', 'IN_PROGRESS');
    expect(e.statusCode).toBe(409);
    expect(e.message).toContain('SCHEDULED');
    expect(e.message).toContain('IN_PROGRESS');
  });

  it('SalesClosedError has 409 status', () => {
    expect(new SalesClosedError().statusCode).toBe(409);
    expect(new SalesClosedError().code).toBe('SALES_CLOSED');
  });

  it('all are instances of AppError', () => {
    expect(new NotFoundError('X')).toBeInstanceOf(AppError);
    expect(new ConflictError('X')).toBeInstanceOf(AppError);
    expect(new ForbiddenError()).toBeInstanceOf(AppError);
  });
});
