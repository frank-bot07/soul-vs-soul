import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import type { AuthService } from '../services/AuthService.js';

export function createAuthRoutes(authService?: AuthService): Router {
  const router = Router();

  // GET /api/auth/session — get current session info
  router.get('/api/auth/session', authenticate, (req, res) => {
    res.json({
      sessionId: req.session?.id,
      userId: req.session?.userId ?? null,
      createdAt: req.session?.createdAt,
      expiresAt: req.session?.expiresAt,
    });
  });

  // POST /api/auth/session — create/refresh session
  router.post('/api/auth/session', authenticate, (req, res) => {
    res.status(201).json({
      sessionId: req.session?.id,
      userId: req.session?.userId ?? null,
      createdAt: req.session?.createdAt,
      expiresAt: req.session?.expiresAt,
    });
  });

  // POST /api/v1/auth/magic-link
  router.post('/api/v1/auth/magic-link', authenticate, (req, res, next) => {
    try {
      if (!authService) {
        res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'Auth service not configured' });
        return;
      }
      const { email } = req.body as { email: string };
      const result = authService.requestMagicLink(email);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/auth/verify
  router.post('/api/v1/auth/verify', authenticate, (req, res, next) => {
    try {
      if (!authService) {
        res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'Auth service not configured' });
        return;
      }
      const { token } = req.body as { token: string };
      const result = authService.verifyMagicLink(token, req.sessionId!);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/auth/me
  router.get('/api/v1/auth/me', authenticate, (req, res, next) => {
    try {
      if (!authService || !req.session?.userId) {
        res.json({ authenticated: false, userId: null });
        return;
      }
      const user = authService.getUser(req.session.userId);
      res.json({ authenticated: true, ...user });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

// Default export for backward compatibility
const defaultRouter = createAuthRoutes();
export default defaultRouter;
