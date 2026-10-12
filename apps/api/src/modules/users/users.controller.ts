import type { Request, Response, NextFunction } from 'express';
import { uuidSchema, paginationSchema, createUserSchema } from './users.schema';
import {
  listUsers,
  getUserById as findUserById,
  createUser as insertUser,
} from './users.service';
import { ok, fail } from '../../types/response';

export async function getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      res
        .status(400)
        .json(fail('VALIDATION_ERROR', 'Invalid query parameters', req.id, parsed.error.flatten()));
      return;
    }
    const result = await listUsers(parsed.data);
    res.status(200).json(ok(result.users, req.id, result.pagination));
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = uuidSchema.safeParse(req.params['id']);
    if (!parsed.success) {
      res.status(400).json(fail('INVALID_UUID', 'Invalid user ID — must be a valid UUID', req.id));
      return;
    }
    const user = await findUserById(parsed.data);
    if (!user) {
      res.status(404).json(fail('NOT_FOUND', 'User not found', req.id));
      return;
    }
    res.status(200).json(ok(user, req.id));
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json(fail('VALIDATION_ERROR', 'Invalid request body', req.id, parsed.error.flatten()));
      return;
    }
    const result = await insertUser(parsed.data);
    if ('type' in result) {
      res.status(409).json(
        fail(
          'CONFLICT',
          `${result.field === 'email' ? 'Email' : 'Username'} is already taken`,
          req.id,
        ),
      );
      return;
    }
    res.status(201).json(ok(result.user, req.id));
  } catch (err) {
    next(err);
  }
}
