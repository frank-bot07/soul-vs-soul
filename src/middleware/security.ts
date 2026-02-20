import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

function buildConnectSrc(): string {
  const origins = config.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean)
    .map((o) => o.replace('https://', 'wss://').replace('http://', 'ws://'));
  return `'self' ${origins.join(' ')}`;
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  const connectSrc = buildConnectSrc();
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src ${connectSrc}; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // #18 — HSTS
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  next();
}
