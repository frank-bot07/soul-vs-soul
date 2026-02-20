import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import type { ReplayService } from '../services/ReplayService.js';
import type { GameQueries } from '../db/queries/games.js';
import { NotFoundError } from '../shared/errors.js';

export function createReplayRoutes(replayService: ReplayService, gameQueries: GameQueries): Router {
  const router = Router();

  // GET /api/v1/games/:id/replay — get replay events
  router.get('/api/v1/games/:id/replay', authenticate, (req, res, next) => {
    try {
      const gameId = req.params['id'] as string;
      const game = gameQueries.get(gameId);
      if (!game) throw new NotFoundError('Game');

      const events = replayService.getReplay(gameId);
      res.json({
        gameId,
        status: game.status,
        totalEvents: events.length,
        events: events.map((e) => ({
          sequence: e.sequence,
          eventType: e.event_type,
          data: JSON.parse(e.data),
          timestamp: e.timestamp,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
