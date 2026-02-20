import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../../src/app.js';
import { initDb, closeDb } from '../../../src/db/index.js';
import type { Server } from 'node:http';

describe('Game API Integration', () => {
  let server: Server;
  let port: number;
  let cookie: string;
  const agentIds: string[] = [];

  beforeAll(async () => {
    initDb(':memory:');
    const app = createApp();
    server = app.listen(0);
    const addr = server.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;

    // Create agents first
    for (const name of ['Alpha', 'Beta', 'Gamma']) {
      const res = await fetch(`http://localhost:${port}/api/v1/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify({ name, personality: `${name} personality with enough text content` }),
      });
      const setCookie = res.headers.get('set-cookie');
      if (setCookie && !cookie) cookie = setCookie.split(';')[0]!;
      const body = (await res.json()) as { id: string };
      agentIds.push(body.id);
    }
  });

  afterAll(() => {
    server.close();
    closeDb();
  });

  it('POST /api/v1/games creates a game', async () => {
    const res = await fetch(`http://localhost:${port}/api/v1/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ agents: agentIds.slice(0, 2), mode: 'elimination' }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['status']).toBe('pending');
    expect(body['id']).toBeDefined();
  });

  it('POST /api/v1/games/:id/start starts a game', async () => {
    // Create game
    const createRes = await fetch(`http://localhost:${port}/api/v1/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ agents: agentIds.slice(0, 2), mode: 'elimination' }),
    });
    const game = (await createRes.json()) as { id: string };

    const res = await fetch(`http://localhost:${port}/api/v1/games/${game.id}/start`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['status']).toBe('running');
  });

  it('GET /api/v1/games/:id returns game status', async () => {
    const createRes = await fetch(`http://localhost:${port}/api/v1/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ agents: agentIds.slice(0, 2), mode: 'round_robin' }),
    });
    const game = (await createRes.json()) as { id: string };

    const res = await fetch(`http://localhost:${port}/api/v1/games/${game.id}`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['status']).toBe('pending');
  });

  it('POST /api/v1/games rejects invalid input', async () => {
    const res = await fetch(`http://localhost:${port}/api/v1/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ agents: ['not-a-uuid'], mode: 'elimination' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/games rejects nonexistent agents', async () => {
    const res = await fetch(`http://localhost:${port}/api/v1/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        agents: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'],
        mode: 'elimination',
      }),
    });
    // Should fail with validation error since agents don't exist
    expect(res.status).toBe(400);
  });
});
