import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../../src/db/migrator.js';

// We test session creation logic directly via the DB
describe('Auth middleware (session logic)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates a session in the database', () => {
    const id = 'test-session-id';
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 86400;

    db.prepare('INSERT INTO sessions (id, data, expires_at) VALUES (?, ?, ?)').run(id, '{}', expiresAt);

    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as { id: string; expires_at: number };
    expect(row).toBeDefined();
    expect(row.id).toBe(id);
    expect(row.expires_at).toBe(expiresAt);
  });

  it('expired sessions are not returned', () => {
    const id = 'expired-session';
    const past = Math.floor(Date.now() / 1000) - 100;

    db.prepare('INSERT INTO sessions (id, data, expires_at) VALUES (?, ?, ?)').run(id, '{}', past);

    const now = Math.floor(Date.now() / 1000);
    const row = db.prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > ?').get(id, now);
    expect(row).toBeUndefined();
  });

  it('sessions store IP and user agent', () => {
    const id = 'full-session';
    const now = Math.floor(Date.now() / 1000);

    db.prepare('INSERT INTO sessions (id, data, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)').run(
      id,
      '{}',
      now + 86400,
      '127.0.0.1',
      'TestAgent/1.0',
    );

    const row = db.prepare('SELECT ip_address, user_agent FROM sessions WHERE id = ?').get(id) as {
      ip_address: string;
      user_agent: string;
    };
    expect(row.ip_address).toBe('127.0.0.1');
    expect(row.user_agent).toBe('TestAgent/1.0');
  });
});
