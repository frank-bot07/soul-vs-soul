import type Database from 'better-sqlite3';

export interface UserRow {
  id: string;
  email: string | null;
  display_name: string;
  auth_provider: string | null;
  created_at: number;
  updated_at: number;
}

export class UserQueries {
  constructor(private db: Database.Database) {}

  getById(id: string): UserRow | undefined {
    return this.db
      .prepare('SELECT id, email, display_name, auth_provider, created_at, updated_at FROM users WHERE id = ?')
      .get(id) as UserRow | undefined;
  }

  getByEmail(email: string): UserRow | undefined {
    return this.db
      .prepare('SELECT id, email, display_name, auth_provider, created_at, updated_at FROM users WHERE email = ?')
      .get(email) as UserRow | undefined;
  }

  create(user: { id: string; email: string | null; displayName: string; authProvider: string | null }): void {
    const now = Math.floor(Date.now() / 1000);
    this.db
      .prepare('INSERT INTO users (id, email, display_name, auth_provider, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(user.id, user.email, user.displayName, user.authProvider, now, now);
  }

  update(id: string, updates: { displayName?: string; email?: string }): void {
    const now = Math.floor(Date.now() / 1000);
    if (updates.displayName !== undefined) {
      this.db.prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?').run(updates.displayName, now, id);
    }
    if (updates.email !== undefined) {
      this.db.prepare('UPDATE users SET email = ?, updated_at = ? WHERE id = ?').run(updates.email, now, id);
    }
  }

  linkSession(userId: string, sessionId: string): void {
    this.db.prepare('UPDATE sessions SET user_id = ? WHERE id = ?').run(userId, sessionId);
  }

  getAgents(userId: string): Array<{ id: string; display_id: string; name: string; avatar_seed: string; play_count: number; win_count: number }> {
    return this.db
      .prepare('SELECT id, display_id, name, avatar_seed, play_count, win_count FROM agents WHERE creator_user = ?')
      .all(userId) as Array<{ id: string; display_id: string; name: string; avatar_seed: string; play_count: number; win_count: number }>;
  }

  getGameHistory(userId: string, limit = 20): Array<{ game_id: string; agent_id: string; final_score: number | null; placement: number | null; status: string; created_at: number }> {
    return this.db
      .prepare(
        `SELECT ga.game_id, ga.agent_id, ga.final_score, ga.placement, g.status, g.created_at
         FROM game_agents ga
         JOIN games g ON g.id = ga.game_id
         JOIN agents a ON a.id = ga.agent_id
         WHERE a.creator_user = ?
         ORDER BY g.created_at DESC
         LIMIT ?`,
      )
      .all(userId, limit) as Array<{ game_id: string; agent_id: string; final_score: number | null; placement: number | null; status: string; created_at: number }>;
  }
}
