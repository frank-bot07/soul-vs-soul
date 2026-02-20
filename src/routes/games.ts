import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { GameCreateSchema, type GameCreateInput } from '../shared/schemas.js';
import type { GameService } from '../services/GameService.js';

export function createGameRoutes(gameService: GameService): Router {
  const router = Router();

  // POST /api/v1/games — create game
  router.post('/api/v1/games', authenticate, validate(GameCreateSchema), async (req, res, next) => {
    try {
      const validated = (req as typeof req & { validated: GameCreateInput }).validated;
      const result = await gameService.createGame(validated, req.sessionId!);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/games/:id/start — start game
  router.post('/api/v1/games/:id/start', authenticate, async (req, res, next) => {
    try {
      await gameService.startGame(req.params['id'] as string);
      res.json({ status: 'running' });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/games/:id — get game status
  router.get('/api/v1/games/:id', authenticate, (req, res, next) => {
    try {
      const game = gameService.getGame(req.params['id'] as string);
      res.json(game);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/games/:id/results — get results
  router.get('/api/v1/games/:id/results', authenticate, (req, res, next) => {
    try {
      const results = gameService.getResults(req.params['id'] as string);
      res.json(results);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
