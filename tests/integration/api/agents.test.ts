import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../../src/app.js';
import { initDb, closeDb } from '../../../src/db/index.js';
import type { Server } from 'node:http';

describe('Agent API Integration', () => {
  let server: Server;
  let port: number;
  let cookie: string;

  beforeAll(() => {
    initDb(':memory:');
    const app = createApp();
    server = app.listen(0);
    const addr = server.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
  });

  afterAll(() => {
    server.close();
    closeDb();
  });

  it('POST /api/v1/agents creates an agent', async () => {
    const res = await fetch(`http://localhost:${port}/api/v1/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'TestAgent', personality: 'A test agent with enough personality text' }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['name']).toBe('TestAgent');
    expect(body['id']).toBeDefined();
    expect(body['displayId']).toBeDefined();

    // Save cookie for subsequent requests
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0]!;
  });

  it('GET /api/v1/agents lists agents', async () => {
    const res = await fetch(`http://localhost:${port}/api/v1/agents`, {
      headers: cookie ? { Cookie: cookie } : {},
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { agents: Array<Record<string, unknown>> };
    expect(body.agents.length).toBeGreaterThan(0);
    // Ensure no system_prompt exposed
    for (const agent of body.agents) {
      expect(agent).not.toHaveProperty('system_prompt');
    }
  });

  it('GET /api/v1/agents/:id returns agent', async () => {
    // First create
    const createRes = await fetch(`http://localhost:${port}/api/v1/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify({ name: 'GetMe', personality: 'Get this agent personality text' }),
    });
    const created = (await createRes.json()) as { id: string };

    const res = await fetch(`http://localhost:${port}/api/v1/agents/${created.id}`, {
      headers: cookie ? { Cookie: cookie } : {},
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['name']).toBe('GetMe');
  });

  it('DELETE /api/v1/agents/:id deletes own agent', async () => {
    const createRes = await fetch(`http://localhost:${port}/api/v1/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify({ name: 'DeleteMe', personality: 'Will be deleted personality text' }),
    });
    const created = (await createRes.json()) as { id: string };

    const res = await fetch(`http://localhost:${port}/api/v1/agents/${created.id}`, {
      method: 'DELETE',
      headers: cookie ? { Cookie: cookie } : {},
    });
    expect(res.status).toBe(204);
  });

  it('POST /api/v1/agents rejects invalid input', async () => {
    const res = await fetch(`http://localhost:${port}/api/v1/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', personality: 'short' }),
    });
    expect(res.status).toBe(400);
  });
});
