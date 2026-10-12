import type { Request, Response, NextFunction } from 'express';
import { ok, fail } from '../../../types/response';
import { categoryIdSchema, createCategorySchema, updateCategorySchema } from './categories.schema';
import { paginationSchema } from '../../users/users.schema';
import {
  listCategories,
  getCategoryById,
  getCategoryRounds,
  createCategory,
  updateCategory,
} from './categories.service';

export async function getCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const activeOnly = req.query['activeOnly'] !== 'false';
    const p = paginationSchema.safeParse(req.query);
    if (!p.success) { res.status(400).json(fail('VALIDATION_ERROR', 'Invalid pagination', req.id, p.error.flatten())); return; }
    const { categories, ...meta } = await listCategories(activeOnly, p.data.page, p.data.limit);
    res.json(ok(categories, req.id, meta));
  } catch (e) { next(e); }
}

export async function getCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const id = categoryIdSchema.safeParse(req.params['categoryId']);
    if (!id.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid category ID', req.id)); return; }
    const cat = await getCategoryById(id.data);
    res.json(ok(cat, req.id));
  } catch (e) { next(e); }
}

export async function getCategoryRoundsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = categoryIdSchema.safeParse(req.params['categoryId']);
    if (!id.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid category ID', req.id)); return; }
    const p = paginationSchema.safeParse(req.query);
    if (!p.success) { res.status(400).json(fail('VALIDATION_ERROR', 'Invalid pagination', req.id, p.error.flatten())); return; }
    const result = await getCategoryRounds(id.data, p.data.page, p.data.limit);
    const { rounds, ...meta } = result;
    res.json(ok(rounds, req.id, meta));
  } catch (e) { next(e); }
}

export async function createCategoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createCategorySchema.safeParse(req.body);
    if (!body.success) { res.status(400).json(fail('VALIDATION_ERROR', 'Invalid body', req.id, body.error.flatten())); return; }
    const cat = await createCategory(body.data);
    res.status(201).json(ok(cat, req.id));
  } catch (e) { next(e); }
}

export async function updateCategoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = categoryIdSchema.safeParse(req.params['categoryId']);
    if (!id.success) { res.status(400).json(fail('INVALID_UUID', 'Invalid category ID', req.id)); return; }
    const body = updateCategorySchema.safeParse(req.body);
    if (!body.success) { res.status(400).json(fail('VALIDATION_ERROR', 'Invalid body', req.id, body.error.flatten())); return; }
    const cat = await updateCategory(id.data, body.data);
    res.json(ok(cat, req.id));
  } catch (e) { next(e); }
}
