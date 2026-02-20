import { Router } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

router.get('/healthz', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// #19 — Readiness check with DB connectivity
router.get('/health/ready', (_req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT 1 as ok').get() as { ok: number } | undefined;
    if (row?.ok === 1) {
      res.json({ status: 'ready', db: 'ok', timestamp: new Date().toISOString() });
    } else {
      res.status(503).json({ status: 'not ready', db: 'error' });
    }
  } catch {
    res.status(503).json({ status: 'not ready', db: 'unavailable' });
  }
});

export default router;
