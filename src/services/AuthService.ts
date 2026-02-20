import crypto from 'node:crypto';
import { UserQueries } from '../db/queries/users.js';
import { ValidationError, NotFoundError } from '../shared/errors.js';

interface MagicLinkToken {
  email: string;
  token: string;
  expiresAt: number;
}

export class AuthService {
  private magicLinkTokens = new Map<string, MagicLinkToken>();

  constructor(private userQueries: UserQueries) {}

  /** Request a magic link. Returns the token (in production, this would be emailed). */
  requestMagicLink(email: string): { token: string; message: string } {
    if (!email || !email.includes('@')) {
      throw new ValidationError('Invalid email address');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    this.magicLinkTokens.set(token, { email, token, expiresAt });

    // Stub: In production, send email here
    // await sendEmail(email, `Your magic link: https://soulvssoul.com/auth/verify/${token}`);

    return { token, message: 'Magic link sent (stubbed — token returned for development)' };
  }

  /** Verify a magic link token and create/get user */
  verifyMagicLink(token: string, sessionId: string): { userId: string; displayName: string; email: string } {
    const entry = this.magicLinkTokens.get(token);
    if (!entry) {
      throw new ValidationError('Invalid or expired token');
    }

    if (Date.now() > entry.expiresAt) {
      this.magicLinkTokens.delete(token);
      throw new ValidationError('Token expired');
    }

    this.magicLinkTokens.delete(token);

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
