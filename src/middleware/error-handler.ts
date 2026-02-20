import type { Request, Response, NextFunction } from 'express';
import { logger } from '../logger.js';
import { config } from '../config.js';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public isOperational = true,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError && err.isOperational) {
    logger.warn({ err, path: req.path }, 'Operational error');
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
    return;
  }

  logger.error({ err, path: req.path }, 'Unexpected error');
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    ...(config.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
