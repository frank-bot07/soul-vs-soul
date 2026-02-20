import rateLimit from 'express-rate-limit';

import type { Request, Response } from 'express';

const isTest = process.env['NODE_ENV'] === 'test';
const skip = isTest ? (_req: Request, _res: Response) => true : undefined;

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many requests' },
  skip,
});

export const createGameRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many requests' },
  skip,
});

export const createAgentRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many requests' },
  skip,
});
