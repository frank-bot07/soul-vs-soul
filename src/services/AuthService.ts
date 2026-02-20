import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import { UserQueries } from '../db/queries/users.js';
import { ValidationError, NotFoundError } from '../shared/errors.js';
import { logger } from '../logger.js';

export class AuthService {
  constructor(
    private userQueries: UserQueries,
    private db: Database.Database,
  ) {
    // Ensure magic_link_tokens table exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS magic_link_tokens (
        token TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);

    // Periodic cleanup of expired tokens
    this.cleanupExpiredTokens();
    setInterval(() => this.cleanupExpiredTokens(), 15 * 60 * 1000);
  }

  private cleanupExpiredTokens(): void {
    try {
      const now = Math.floor(Date.now() / 1000);
      const result = this.db.prepare('DELETE FROM magic_link_tokens WHERE expires_at < ?').run(now);
      if (result.changes > 0) {
        logger.info({ deleted: result.changes }, 'Cleaned up expired magic link tokens');
      }
    } catch (err) {
      logger.error({ err }, 'Magic link token cleanup failed');
    }
  }

  /** Request a magic link. Returns the token (in production, this would be emailed). */
  requestMagicLink(email: string): { token: string; message: string } {
    if (!email || !email.includes('@')) {
      throw new ValidationError('Invalid email address');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Math.floor(Date.now() / 1000) + 15 * 60; // 15 minutes

    this.db
      .prepare('INSERT INTO magic_link_tokens (token, email, expires_at) VALUES (?, ?, ?)')
      .run(token, email, expiresAt);

    return { token, message: 'Magic link sent (stubbed — token returned for development)' };
  }

  /** Verify a magic link token and create/get user */
  verifyMagicLink(token: string, sessionId: string): { userId: string; displayName: string; email: string } {
    const now = Math.floor(Date.now() / 1000);
    const entry = this.db
      .prepare('SELECT token, email, expires_at FROM magic_link_tokens WHERE token = ?')
      .get(token) as { token: string; email: string; expires_at: number } | undefined;

    if (!entry) {
      throw new ValidationError('Invalid or expired token');
    }

    if (now > entry.expires_at) {
      this.db.prepare('DELETE FROM magic_link_tokens WHERE token = ?').run(token);
      throw new ValidationError('Token expired');
    }

    this.db.prepare('DELETE FROM magic_link_tokens WHERE token = ?').run(token);

    // Find or create user
    let user = this.userQueries.getByEmail(entry.email);
    if (!user) {
      const userId = crypto.randomUUID();
      const displayName = entry.email.split('@')[0] ?? 'User';
      this.userQueries.create({
        id: userId,
        email: entry.email,
        displayName,
        authProvider: 'magic_link',
      });
      user = this.userQueries.getById(userId);
    }

    if (!user) throw new ValidationError('Failed to create user');

    // Link session to user
    this.userQueries.linkSession(user.id, sessionId);

    return { userId: user.id, displayName: user.display_name, email: user.email ?? '' };
  }

  /** Get user profile */
  getUser(userId: string) {
    const user = this.userQueries.getById(userId);
    if (!user) throw new NotFoundError('User');
    return user;
  }

  /** Get user profile with their agents and game history */
  getUserProfile(userId: string) {
    const user = this.userQueries.getById(userId);
    if (!user) throw new NotFoundError('User');

    const agents = this.userQueries.getAgents(userId);
    const games = this.userQueries.getGameHistory(userId);

    const wins = games.filter((g) => g.placement === 1).length;
    const totalGames = games.length;

    return {
      id: user.id,
      displayName: user.display_name,
      joinedAt: user.created_at,
      agents,
      recentGames: games,
      stats: {
        totalGames,
        wins,
        losses: totalGames - wins,
        winRate: totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0,
      },
    };
  }
}
