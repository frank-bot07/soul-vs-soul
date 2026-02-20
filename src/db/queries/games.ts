import type Database from 'better-sqlite3';

export interface GameRow {
  id: string;
  status: string;
  mode: string;
  visibility: string;
  current_round: number;
  total_rounds: number | null;
  winner_agent_id: string | null;
  creator_session: string;
  config: string;
  started_at: number | null;
  completed_at: number | null;
  created_at: number;
}

export interface GameAgentRow {
  game_id: string;
  agent_id: string;
  final_score: number | null;
  eliminated_round: number | null;
  placement: number | null;
}

export class GameQueries {
  constructor(private db: Database.Database) {}

  create(game: { id: string; mode: string; visibility: string; creatorSession: string; config: string }): void {
    this.db
      .prepare('INSERT INTO games (id, status, mode, visibility, creator_session, config) VALUES (?, ?, ?, ?, ?, ?)')
      .run(game.id, 'pending', game.mode, game.visibility, game.creatorSession, game.config);
  }

  get(id: string): GameRow | undefined {
    return this.db.prepare('SELECT * FROM games WHERE id = ?').get(id) as GameRow | undefined;
  }

  addAgent(gameId: string, agentId: string): void {
    this.db.prepare('INSERT INTO game_agents (game_id, agent_id) VALUES (?, ?)').run(gameId, agentId);
  }

  getAgents(gameId: string): GameAgentRow[] {
    return this.db.prepare('SELECT * FROM game_agents WHERE game_id = ?').all(gameId) as GameAgentRow[];
  }

  updateStatus(id: string, status: string): void {
    const updates: Record<string, unknown> = { status };
    if (status === 'running') updates['started_at'] = Math.floor(Date.now() / 1000);
    if (status === 'completed' || status === 'cancelled') updates['completed_at'] = Math.floor(Date.now() / 1000);

    this.db.prepare(`UPDATE games SET status = ?, started_at = COALESCE(?, started_at), completed_at = COALESCE(?, completed_at) WHERE id = ?`).run(
      status,
      status === 'running' ? Math.floor(Date.now() / 1000) : null,
      status === 'completed' || status === 'cancelled' ? Math.floor(Date.now() / 1000) : null,
      id,
    );
  }

  updateRound(id: string, round: number): void {
    this.db.prepare('UPDATE games SET current_round = ? WHERE id = ?').run(round, id);
  }

  setWinner(id: string, agentId: string): void {
    this.db.prepare('UPDATE games SET winner_agent_id = ? WHERE id = ?').run(agentId, id);
  }

  setTotalRounds(id: string, totalRounds: number): void {
    this.db.prepare('UPDATE games SET total_rounds = ? WHERE id = ?').run(totalRounds, id);
  }

  updateAgentResult(gameId: string, agentId: string, score: number, placement: number, eliminatedRound?: number): void {
    this.db
      .prepare('UPDATE game_agents SET final_score = ?, placement = ?, eliminated_round = ? WHERE game_id = ? AND agent_id = ?')
      .run(score, placement, eliminatedRound ?? null, gameId, agentId);
  }

  listRecent(limit = 20): GameRow[] {
    return this.db.prepare('SELECT * FROM games ORDER BY created_at DESC LIMIT ?').all(limit) as GameRow[];
  }
}
