import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createApp } from '../../src/app.js';
import { initDb, closeDb } from '../../src/db/index.js';
import { GameWebSocketServer } from '../../src/ws/WebSocketServer.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

describe('E2E Smoke Tests', () => {
  let server: Server;
  let wsServer: GameWebSocketServer;
  let baseUrl: string;
  let dbPath: string;
  let cookie: string;

  beforeAll(async () => {
    dbPath = path.join(os.tmpdir(), `svs-smoke-${Date.now()}.db`);
    process.env['DATABASE_PATH'] = dbPath;
    process.env['NODE_ENV'] = 'test';

    initDb(dbPath);
    const app = createApp();
    server = createServer(app);
    wsServer = new GameWebSocketServer(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 3000;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    wsServer.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDb();
    try { fs.unlinkSync(dbPath); } catch { /* ok */ }
    try { fs.unlinkSync(dbPath + '-wal'); } catch { /* ok */ }
    try { fs.unlinkSync(dbPath + '-shm'); } catch { /* ok */ }
  });

  it('GET /healthz returns 200', async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('ok');
  });

  it('GET /api/v1/agents returns preset agents', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents`);
    expect(res.status).toBe(200);
    // Capture session cookie
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/svs_session=([^;]+)/);
      if (match) cookie = `svs_session=${match[1]}`;
    }
    const body = await res.json() as { agents: Array<{ name: string; is_preset: number }> };
    expect(body.agents.length).toBeGreaterThanOrEqual(12);
    const presets = body.agents.filter((a) => a.is_preset === 1);
    expect(presets.length).toBe(12);
  });

  it('POST /api/v1/games creates a game with preset agents', async () => {
    // Get agents
    const agentsRes = await fetch(`${baseUrl}/api/v1/agents`, {
      headers: cookie ? { Cookie: cookie } : {},
    });
    const { agents } = await agentsRes.json() as { agents: Array<{ id: string }> };
    const twoAgents = agents.slice(0, 2).map((a) => a.id);

    const res = await fetch(`${baseUrl}/api/v1/games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({ agents: twoAgents, mode: 'elimination' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; status: string };
    expect(body.id).toBeTruthy();
    expect(body.status).toBe('pending');
  });
});
