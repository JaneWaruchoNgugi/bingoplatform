import { Router } from 'express';
import {
  listRoundsHandler,
  getRoundHandler,
  getRoundStateHandler,
  getRoundNumbersHandler,
  getRoundWinnersHandler,
  getRoundResultsHandler,
} from './rounds.controller';

const router = Router();

router.get('/', listRoundsHandler);
router.get('/:roundId', getRoundHandler);
router.get('/:roundId/state', getRoundStateHandler);
router.get('/:roundId/results', getRoundResultsHandler);
router.get('/:roundId/numbers', getRoundNumbersHandler);
router.get('/:roundId/winners', getRoundWinnersHandler);

export { router as roundsRouter };
