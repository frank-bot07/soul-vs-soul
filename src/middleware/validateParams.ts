import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../shared/errors.js';

const UUID_SCHEMA = z.string().uuid('Invalid ID format');

/**
 * Middleware that validates route params are valid UUIDs.
 * Usage: validateUUIDParams('id', 'agentId')
 */
export function validateUUIDParams(...paramNames: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    for (const name of paramNames) {
      const value = req.params[name];
      if (value !== undefined) {
        const result = UUID_SCHEMA.safeParse(value);
        if (!result.success) {
          next(new ValidationError(`Invalid ${name} format`));
          return;
        }
      }
    }
    next();
  };
}
