import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../../../src/app.js';
import { initDb, closeDb, getDb } from '../../../src/db/index.js';
import type { Express } from 'express';
import { request } from '../helpers.js';

describe('Replay API', () => {
  let app: Express;

  beforeEach(() => {
    initDb(':memory:');
    app = createApp();

    const db = getDb();
    db.prepare("INSERT INTO sessions (id, expires_at) VALUES ('s1', 9999999999)").run();
    db.prepare("INSERT INTO agents (id, display_id, name, personality, system_prompt, avatar_seed) VALUES ('a1', 'd_a1', 'Agent1', 'test', 'test', 'x')").run();
    db.prepare("INSERT INTO games (id, status, mode, creator_session, config) VALUES ('g1', 'completed', 'elimination', 's1', '{}')").run();
    db.prepare("INSERT INTO game_agents (game_id, agent_id) VALUES ('g1', 'a1')").run();
    db.prepare("INSERT INTO replay_events (game_id, sequence, event_type, data, timestamp) VALUES ('g1', 1, 'game:start', '{\"agents\":[]}', 1000)").run();
    db.prepare("INSERT INTO replay_events (game_id, sequence, event_type, data, timestamp) VALUES ('g1', 2, 'round:start', '{\"round\":1}', 1001)").run();
  });

  afterEach(() => {
    closeDb();
  });

  it('GET /api/v1/games/:id/replay returns replay events', async () => {
    const res = await request(app, 'GET', '/api/v1/games/g1/replay');
    expect(res.status).toBe(200);
    expect(res.body['gameId']).toBe('g1');
    expect(res.body['totalEvents']).toBe(2);
    const events = res.body['events'] as Array<{ sequence: number; eventType: string }>;
    expect(events).toHaveLength(2);
    expect(events[0]!.eventType).toBe('game:start');
    expect(events[1]!.eventType).toBe('round:start');
  });

  it('returns 404 for unknown game', async () => {
    const res = await request(app, 'GET', '/api/v1/games/nonexistent/replay');
    expect(res.status).toBe(404);
  });
});
