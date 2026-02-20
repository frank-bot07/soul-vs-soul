import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';

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

export default router;
