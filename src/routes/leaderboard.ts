import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import type { LeaderboardService } from '../services/LeaderboardService.js';
import { NotFoundError } from '../shared/errors.js';

export function createLeaderboardRoutes(leaderboardService: LeaderboardService): Router {
  const router = Router();

  // GET /api/v1/leaderboard
  router.get('/api/v1/leaderboard', authenticate, (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query['limit']) || 20, 100);
      const offset = Number(req.query['offset']) || 0;
      const entries = leaderboardService.getLeaderboard(limit, offset);
      const total = leaderboardService.getCount();
      res.json({ entries, total, limit, offset });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/leaderboard/:agentId
  router.get('/api/v1/leaderboard/:agentId', authenticate, (req, res, next) => {
    try {
      const agentId = req.params['agentId'] as string;
      const stats = leaderboardService.getAgentStats(agentId);
      if (!stats) throw new NotFoundError('Leaderboard entry');
      res.json(stats);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
