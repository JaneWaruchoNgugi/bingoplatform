import { Router } from 'express';
import { getUsers, getUserById, createUser } from './users.controller';

const router = Router();

// NOTE: These endpoints require authentication + authorization before public production use.
router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', createUser);

export { router as usersRouter };
