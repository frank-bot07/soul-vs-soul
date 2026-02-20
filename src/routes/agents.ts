import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AgentCreateSchema } from '../shared/schemas.js';
import type { AgentService } from '../services/AgentService.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10240 } });

export function createAgentRoutes(agentService: AgentService): Router {
  const router = Router();

  // POST /api/v1/agents — create agent
  router.post('/api/v1/agents', authenticate, validate(AgentCreateSchema), (req, res, next) => {
    try {
      const validated = (req as typeof req & { validated: { name: string; personality: string } }).validated;
      const result = agentService.create(validated, req.sessionId ?? null);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/agents — list agents with search, sort, filter
  router.get('/api/v1/agents', authenticate, (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query['limit']) || 50, 100);
      const offset = Number(req.query['offset']) || 0;
      const search = (req.query['search'] as string) || undefined;
      const sort = (req.query['sort'] as string) || 'newest';
      const presetParam = req.query['preset'] as string | undefined;
      const preset = presetParam === 'true' ? true : presetParam === 'false' ? false : undefined;

      const agents = agentService.listFiltered({ limit, offset, search, sort, preset });
      res.json({ agents });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/agents/:id — get agent
  router.get('/api/v1/agents/:id', authenticate, (req, res, next) => {
    try {
      const agent = agentService.get(req.params['id'] as string);
      res.json(agent);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/v1/agents/:id — delete agent
  router.delete('/api/v1/agents/:id', authenticate, (req, res, next) => {
    try {
      agentService.delete(req.params['id'] as string, req.sessionId!);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/agents/upload — upload .md file
  router.post('/api/v1/agents/upload', authenticate, upload.single('file'), (req, res, next) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: 'No file uploaded' });
        return;
      }
      const result = agentService.parseUploadedFile(file.buffer, file.mimetype);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
