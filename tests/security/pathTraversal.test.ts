import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { AgentQueries } from '../../src/db/queries/agents.js';
import { AgentService } from '../../src/services/AgentService.js';
import { runMigrations } from '../../src/db/migrator.js';

describe('Path Traversal Prevention', () => {
  let db: Database.Database;
  let service: AgentService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    service = new AgentService(new AgentQueries(db));
  });

  afterEach(() => {
    db.close();
  });

  it('rejects path with forward slashes', () => {
    expect(() => service.get('../../etc/passwd')).toThrow('Invalid agent ID');
  });

  it('rejects path with backslashes', () => {
    expect(() => service.get('..\\..\\etc\\passwd')).toThrow('Invalid agent ID');
  });

  it('rejects path with double dots', () => {
    expect(() => service.get('../secret')).toThrow('Invalid agent ID');
  });

  it('rejects non-UUID strings', () => {
    expect(() => service.get('not-a-uuid')).toThrow('Invalid agent ID');
    expect(() => service.get('')).toThrow('Invalid agent ID');
    expect(() => service.get('12345')).toThrow('Invalid agent ID');
  });

  it('accepts valid UUID', () => {
    // Will throw NotFound, not ValidationError
    expect(() => service.get('550e8400-e29b-41d4-a716-446655440000')).toThrow('not found');
  });

  it('rejects UUID-like strings with path components', () => {
    expect(() => service.get('550e8400-e29b-41d4-a716-446655440000/../hack')).toThrow('Invalid agent ID');
  });
});
