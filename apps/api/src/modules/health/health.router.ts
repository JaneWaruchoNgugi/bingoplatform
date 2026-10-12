import { Router } from 'express';
import { liveness, readiness } from './health.controller';

const router = Router();

router.get('/', liveness);
router.get('/live', liveness);   // alias — does NOT check external dependencies
router.get('/ready', readiness);

export { router as healthRouter };
