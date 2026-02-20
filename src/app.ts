import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import healthRouter from './routes/health.js';

export function createApp(): express.Express {
  const app = express();

  // Security
  app.use(helmet());
  app.use(
    cors({
      origin: config.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      maxAge: 86400,
    }),
  );

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Parsing
  app.use(express.json({ limit: '100kb' }));

  // Routes
  app.use(healthRouter);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
