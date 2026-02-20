import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createApp } from '../../../src/app.js';
import { initDb, closeDb } from '../../../src/db/index.js';
import { GameWebSocketServer } from '../../../src/ws/WebSocketServer.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

describe('Full Game Lifecycle', () => {
  let server: Server;
  let _wsServer: GameWebSocketServer;
  let baseUrl: string;
  let dbPath: string;
  let cookie: string;

  beforeAll(async () => {
    dbPath = path.join(os.tmpdir(), `svs-fullgame-${Date.now()}.db`);
    process.env['DATABASE_PATH'] = dbPath;
    process.env['NODE_ENV'] = 'test';

    initDb(dbPath);
    const app = createApp();
    server = createServer(app);
    _wsServer = new GameWebSocketServer(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 3000;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    _wsServer.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDb();
    try { fs.unlinkSync(dbPath); } catch { /* ok */ }
    try { fs.unlinkSync(dbPath + '-wal'); } catch { /* ok */ }
    try { fs.unlinkSync(dbPath + '-shm'); } catch { /* ok */ }
  });

  it('creates agents, creates game, starts game, and gets results', async () => {
    // Create two agents
    const agent1Res = await fetch(`${baseUrl}/api/v1/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Fighter A', personality: 'A brave warrior who fights with honor and courage' }),
    });
    expect(agent1Res.status).toBe(201);
    const setCookie = agent1Res.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/svs_session=([^;]+)/);
      if (match) cookie = `svs_session=${match[1]}`;
    }
    const agent1 = await agent1Res.json() as { id: string };

    const agent2Res = await fetch(`${baseUrl}/api/v1/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({ name: 'Test Fighter B', personality: 'A cunning trickster who uses wit and deception' }),
    });
    expect(agent2Res.status).toBe(201);
    const agent2 = await agent2Res.json() as { id: string };

    // Create game
    const gameRes = await fetch(`${baseUrl}/api/v1/games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({ agents: [agent1.id, agent2.id], mode: 'elimination' }),
    });
    expect(gameRes.status).toBe(201);
    const game = await gameRes.json() as { id: string; status: string };
    expect(game.status).toBe('pending');

    // Start game
    const startRes = await fetch(`${baseUrl}/api/v1/games/${game.id}/start`, {
      method: 'POST',
      headers: cookie ? { Cookie: cookie } : {},
    });
    expect(startRes.status).toBe(200);

    // Wait for game to complete (uses placeholder responses in test mode)
    await new Promise((r) => setTimeout(r, 500));

    // Get results
    const resultsRes = await fetch(`${baseUrl}/api/v1/games/${game.id}/results`, {
      headers: cookie ? { Cookie: cookie } : {},
    });
    expect(resultsRes.status).toBe(200);
    const results = await resultsRes.json() as { status: string; gameId: string };
    expect(results.gameId).toBe(game.id);
  });
});
