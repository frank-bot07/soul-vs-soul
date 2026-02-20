import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../../../src/app.js';
import { initDb, closeDb, getDb } from '../../../src/db/index.js';
import type { Express } from 'express';
import { request } from '../helpers.js';

describe('Users API', () => {
  let app: Express;

  beforeEach(() => {
    initDb(':memory:');
    app = createApp();

    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    db.prepare("INSERT INTO users (id, email, display_name, auth_provider, created_at, updated_at) VALUES ('u1', 'test@example.com', 'TestUser', 'magic_link', ?, ?)").run(now, now);
  });

  afterEach(() => {
    closeDb();
  });

  it('GET /api/v1/users/:id returns user profile', async () => {
    const res = await request(app, 'GET', '/api/v1/users/u1');
    expect(res.status).toBe(200);
    expect(res.body['displayName']).toBe('TestUser');
    expect(res.body['stats']).toBeDefined();
  });

  it('returns 404 for unknown user', async () => {
    const res = await request(app, 'GET', '/api/v1/users/nonexistent');
    expect(res.status).toBe(404);
  });

  it('GET /api/v1/auth/me returns unauthenticated for anonymous', async () => {
    const res = await request(app, 'GET', '/api/v1/auth/me');
    expect(res.status).toBe(200);
    expect(res.body['authenticated']).toBe(false);
  });
});
