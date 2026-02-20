import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/index.js';

export interface Session {
  id: string;
  userId: string | null;
  data: Record<string, unknown>;
  createdAt: number;
  expiresAt: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    session?: Session;
    sessionId?: string;
  }
}

const ANON_TTL = 24 * 60 * 60; // 24h in seconds
const AUTH_TTL = 30 * 24 * 60 * 60; // 30d

function getOrCreateSession(req: Request, res: Response): Session {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  // Check API key auth
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer svs_live_')) {
    const apiKey = authHeader.slice(7);
    // For Phase 1, just validate format and create a session
    // Full bcrypt key lookup comes in a later phase
    const sessionId = crypto.createHash('sha256').update(apiKey).digest('hex');

    const existing = db.prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > ?').get(sessionId, now) as
      | { id: string; user_id: string | null; data: string; created_at: number; expires_at: number }
      | undefined;

    if (existing) {
      return {
        id: existing.id,
        userId: existing.user_id,
        data: JSON.parse(existing.data) as Record<string, unknown>,
        createdAt: existing.created_at,
        expiresAt: existing.expires_at,
      };
    }

    const expiresAt = now + AUTH_TTL;
    db.prepare('INSERT OR REPLACE INTO sessions (id, user_id, data, expires_at) VALUES (?, NULL, ?, ?)').run(
      sessionId,
      '{}',
      expiresAt,
    );
    return { id: sessionId, userId: null, data: {}, createdAt: now, expiresAt };
  }

  // Check cookie
  const cookies = parseCookies(req.headers.cookie ?? '');
  const sessionId = cookies['svs_session'];

  if (sessionId) {
    const existing = db.prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > ?').get(sessionId, now) as
      | { id: string; user_id: string | null; data: string; created_at: number; expires_at: number }
      | undefined;

    if (existing) {
      return {
        id: existing.id,
        userId: existing.user_id,
        data: JSON.parse(existing.data) as Record<string, unknown>,
        createdAt: existing.created_at,
        expiresAt: existing.expires_at,
      };
    }
  }

  // Create new anonymous session
  const newId = crypto.randomUUID();
  const expiresAt = now + ANON_TTL;
  db.prepare('INSERT INTO sessions (id, user_id, data, expires_at, ip_address, user_agent) VALUES (?, NULL, ?, ?, ?, ?)').run(
    newId,
    '{}',
    expiresAt,
    req.ip ?? null,
    req.headers['user-agent'] ?? null,
  );

  // Set cookie
  const secure = process.env['NODE_ENV'] === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `svs_session=${newId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${ANON_TTL}${secure}`);

  return { id: newId, userId: null, data: {}, createdAt: now, expiresAt };
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const session = getOrCreateSession(req, res);
    req.session = session;
    req.sessionId = session.id;
    next();
  } catch (err) {
    next(err);
  }
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(';')) {
    const [key, ...vals] = pair.trim().split('=');
    if (key) {
      cookies[key.trim()] = vals.join('=').trim();
    }
  }
  return cookies;
}
