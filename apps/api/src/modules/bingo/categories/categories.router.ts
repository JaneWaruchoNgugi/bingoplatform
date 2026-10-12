import { Router } from 'express';
import {
  getCategories,
  getCategory,
  getCategoryRoundsHandler,
} from './categories.controller';

const router = Router();

router.get('/', getCategories);
router.get('/:categoryId', getCategory);
router.get('/:categoryId/rounds', getCategoryRoundsHandler);

export { router as categoriesRouter };
