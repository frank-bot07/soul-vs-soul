import type Database from 'better-sqlite3';

export interface LeaderboardRow {
  agent_id: string;
  total_games: number;
  total_wins: number;
  total_score: number;
  elo_rating: number;
  last_played_at: number | null;
  updated_at: number;
}

export interface LeaderboardEntry extends LeaderboardRow {
  name: string;
  display_id: string;
  avatar_seed: string;
}

export class LeaderboardQueries {
  constructor(private db: Database.Database) {}

  getTop(limit = 20, offset = 0): LeaderboardEntry[] {
    return this.db
      .prepare(
        `SELECT l.*, a.name, a.display_id, a.avatar_seed
         FROM leaderboard l
         JOIN agents a ON a.id = l.agent_id
         ORDER BY l.elo_rating DESC
         LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as LeaderboardEntry[];
  }

  getByAgent(agentId: string): LeaderboardRow | undefined {
    return this.db.prepare('SELECT * FROM leaderboard WHERE agent_id = ?').get(agentId) as LeaderboardRow | undefined;
  }

  upsert(agentId: string, updates: { eloRating: number; totalGames: number; totalWins: number; totalScore: number }): void {
    const now = Math.floor(Date.now() / 1000);
    this.db
      .prepare(
        `INSERT INTO leaderboard (agent_id, elo_rating, total_games, total_wins, total_score, last_played_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(agent_id) DO UPDATE SET
           elo_rating = ?,
           total_games = ?,
           total_wins = ?,
           total_score = ?,
           last_played_at = ?,
           updated_at = ?`,
      )
      .run(
        agentId,
        updates.eloRating, updates.totalGames, updates.totalWins, updates.totalScore, now, now,
        updates.eloRating, updates.totalGames, updates.totalWins, updates.totalScore, now, now,
      );
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM leaderboard').get() as { cnt: number };
    return row.cnt;
  }
}
