import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import type { AuthService } from '../services/AuthService.js';
import { NotFoundError } from '../shared/errors.js';

export function createUserRoutes(authService: AuthService): Router {
  const router = Router();

  // GET /api/v1/users/:id — public profile
  router.get('/api/v1/users/:id', authenticate, (req, res, next) => {
    try {
      const userId = req.params['id'] as string;
      const profile = authService.getUserProfile(userId);
      res.json(profile);
    } catch (err) {
      if (err instanceof NotFoundError) {
        next(err);
      } else {
        next(err);
      }
    }
  });

  return router;
}
