import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../../../src/app.js';
import { initDb, closeDb, getDb } from '../../../src/db/index.js';
import type { Express } from 'express';
import { request } from '../helpers.js';

describe('Leaderboard API', () => {
  let app: Express;

  beforeEach(() => {
    initDb(':memory:');
    app = createApp();

    // Seed some leaderboard data
    const db = getDb();
    db.prepare("INSERT INTO agents (id, display_id, name, personality, system_prompt, avatar_seed) VALUES ('00000000-0000-4000-8000-000000000001', 'd_a1', 'TopAgent', 'test', 'test', 'x')").run();
    db.prepare("INSERT INTO agents (id, display_id, name, personality, system_prompt, avatar_seed) VALUES ('00000000-0000-4000-8000-000000000002', 'd_a2', 'MidAgent', 'test', 'test', 'y')").run();
    const now = Math.floor(Date.now() / 1000);
    db.prepare('INSERT INTO leaderboard (agent_id, total_games, total_wins, total_score, elo_rating, last_played_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('00000000-0000-4000-8000-000000000001', 10, 7, 500, 1200, now, now);
    db.prepare('INSERT INTO leaderboard (agent_id, total_games, total_wins, total_score, elo_rating, last_played_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('00000000-0000-4000-8000-000000000002', 5, 2, 200, 950, now, now);
  });

  afterEach(() => {
    closeDb();
  });

  it('GET /api/v1/leaderboard returns sorted entries', async () => {
    const res = await request(app, 'GET', '/api/v1/leaderboard');
    expect(res.status).toBe(200);
    const entries = res.body['entries'] as Array<{ name: string; elo_rating: number }>;
    expect(entries).toHaveLength(2);
    expect(entries[0]!.name).toBe('TopAgent');
    expect(entries[0]!.elo_rating).toBe(1200);
    expect(res.body['total']).toBe(2);
  });

  it('supports pagination', async () => {
    const res = await request(app, 'GET', '/api/v1/leaderboard?limit=1&offset=0');
    expect(res.status).toBe(200);
    const entries = res.body['entries'] as Array<{ name: string }>;
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe('TopAgent');

    const res2 = await request(app, 'GET', '/api/v1/leaderboard?limit=1&offset=1');
    expect(res2.status).toBe(200);
    const entries2 = res2.body['entries'] as Array<{ name: string }>;
    expect(entries2).toHaveLength(1);
    expect(entries2[0]!.name).toBe('MidAgent');
  });

  it('GET /api/v1/leaderboard/:agentId returns agent stats', async () => {
    const res = await request(app, 'GET', '/api/v1/leaderboard/00000000-0000-4000-8000-000000000001');
    expect(res.status).toBe(200);
    expect(res.body.elo_rating).toBe(1200);
    expect(res.body.total_games).toBe(10);
  });

  it('returns 404 for unknown agent', async () => {
    const res = await request(app, 'GET', '/api/v1/leaderboard/00000000-0000-4000-8000-ffffffffffff');
    expect(res.status).toBe(404);
  });
});
