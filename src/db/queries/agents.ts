import type Database from 'better-sqlite3';

const PUBLIC_FIELDS = 'id, display_id, name, personality, avatar_seed, is_preset, play_count, win_count, created_at';

export interface AgentRow {
  id: string;
  display_id: string;
  name: string;
  personality: string;
  system_prompt: string;
  avatar_seed: string;
  is_preset: number;
  creator_session: string | null;
  creator_user: string | null;
  play_count: number;
  win_count: number;
  created_at: number;
}

export type PublicAgentRow = Omit<AgentRow, 'system_prompt' | 'creator_session' | 'creator_user'>;

export class AgentQueries {
  constructor(private db: Database.Database) {}

  getPublic(id: string): PublicAgentRow | undefined {
    return this.db.prepare(`SELECT ${PUBLIC_FIELDS} FROM agents WHERE id = ?`).get(id) as PublicAgentRow | undefined;
  }

  getInternal(id: string): AgentRow | undefined {
    return this.db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as AgentRow | undefined;
  }

  listPublic(limit = 50, offset = 0): PublicAgentRow[] {
    return this.db.prepare(`SELECT ${PUBLIC_FIELDS} FROM agents ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(limit, offset) as PublicAgentRow[];
  }

  create(agent: {
    id: string;
    displayId: string;
    name: string;
    personality: string;
    systemPrompt: string;
    avatarSeed: string;
    creatorSession: string | null;
  }): void {
    this.db
      .prepare(
        'INSERT INTO agents (id, display_id, name, personality, system_prompt, avatar_seed, creator_session) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(agent.id, agent.displayId, agent.name, agent.personality, agent.systemPrompt, agent.avatarSeed, agent.creatorSession);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM agents WHERE id = ?').run(id);
    return result.changes > 0;
  }

  listFiltered(opts: { limit?: number; offset?: number; search?: string; sort?: string; preset?: boolean }): PublicAgentRow[] {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (opts.search) {
      conditions.push('name LIKE ?');
      params.push(`%${opts.search}%`);
    }
    if (opts.preset === true) {
      conditions.push('is_preset = 1');
    } else if (opts.preset === false) {
      conditions.push('is_preset = 0');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'ORDER BY created_at DESC';
    if (opts.sort === 'popular') orderBy = 'ORDER BY play_count DESC';
    else if (opts.sort === 'winrate') orderBy = 'ORDER BY CASE WHEN play_count > 0 THEN CAST(win_count AS REAL) / play_count ELSE 0 END DESC';
    else if (opts.sort === 'newest') orderBy = 'ORDER BY created_at DESC';

    params.push(limit, offset);
    return this.db.prepare(`SELECT ${PUBLIC_FIELDS} FROM agents ${where} ${orderBy} LIMIT ? OFFSET ?`).all(...params) as PublicAgentRow[];
  }

  getCreatorSession(id: string): string | null {
    const row = this.db.prepare('SELECT creator_session FROM agents WHERE id = ?').get(id) as { creator_session: string | null } | undefined;
    return row?.creator_session ?? null;
  }
}
