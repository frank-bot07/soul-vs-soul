import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validateUUIDParams } from '../middleware/validateParams.js';
import type { ReplayService } from '../services/ReplayService.js';
import type { GameQueries } from '../db/queries/games.js';
import { NotFoundError } from '../shared/errors.js';

/** Strip raw LLM response content and internal IDs from replay event data */
function sanitizeReplayEvent(eventType: string, data: Record<string, unknown>): Record<string, unknown> {
  if (eventType === 'agent:response') {
    const sanitized = { ...data, response: '[redacted]' };
    return sanitized;
  }
  if (eventType === 'round:end') {
    const results = data['results'] as Array<Record<string, unknown>> | undefined;
    if (results) {
      return {
        ...data,
        results: results.map((r) => {
          const { response, ...rest } = r;
          void response;
          return rest;
        }),
      };
    }
  }
  return data;
}

export function createReplayRoutes(replayService: ReplayService, gameQueries: GameQueries): Router {
  const router = Router();

  // GET /api/v1/games/:id/replay — get replay events
  router.get('/api/v1/games/:id/replay', authenticate, validateUUIDParams('id'), (req, res, next) => {
    try {
      const gameId = req.params['id'] as string;
      const game = gameQueries.get(gameId);
      if (!game) throw new NotFoundError('Game');

      const events = replayService.getReplay(gameId);
      res.json({
        gameId,
        status: game.status,
        totalEvents: events.length,
        events: events
          .filter((e) => e.event_type !== 'agent:query')
          .map((e) => ({
            sequence: e.sequence,
            eventType: e.event_type,
            data: sanitizeReplayEvent(e.event_type, JSON.parse(e.data) as Record<string, unknown>),
            timestamp: e.timestamp,
          })),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
