import type Database from 'better-sqlite3';

export interface ReplayEventRow {
  id: number;
  game_id: string;
  sequence: number;
  event_type: string;
  data: string;
  timestamp: number;
}

export class ReplayQueries {
  constructor(private db: Database.Database) {}

  insert(gameId: string, sequence: number, eventType: string, data: string): void {
    this.db
      .prepare('INSERT INTO replay_events (game_id, sequence, event_type, data, timestamp) VALUES (?, ?, ?, ?, ?)')
      .run(gameId, sequence, eventType, data, Math.floor(Date.now() / 1000));
  }

  getByGame(gameId: string): ReplayEventRow[] {
    return this.db
      .prepare('SELECT * FROM replay_events WHERE game_id = ? ORDER BY sequence ASC')
      .all(gameId) as ReplayEventRow[];
  }

  getCount(gameId: string): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM replay_events WHERE game_id = ?').get(gameId) as { cnt: number };
    return row.cnt;
  }
}
