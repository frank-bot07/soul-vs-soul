import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { ReplayService } from '../../../src/services/ReplayService.js';
import { ReplayQueries } from '../../../src/db/queries/replays.js';
import { runMigrations } from '../../../src/db/migrator.js';

describe('ReplayService', () => {
  let db: Database.Database;
  let service: ReplayService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    // Need a game to reference
    db.prepare("INSERT INTO sessions (id, expires_at) VALUES ('s1', 9999999999)").run();
    db.prepare("INSERT INTO agents (id, display_id, name, personality, system_prompt, avatar_seed) VALUES ('a1', 'd_a1', 'Agent1', 'test', 'test', 'x')").run();
    db.prepare("INSERT INTO games (id, status, mode, creator_session, config) VALUES ('g1', 'running', 'elimination', 's1', '{}')").run();
    db.prepare("INSERT INTO game_agents (game_id, agent_id) VALUES ('g1', 'a1')").run();

    const queries = new ReplayQueries(db);
    service = new ReplayService(queries);
  });

  afterEach(() => {
    db.close();
  });

  it('records events with sequential sequence numbers', () => {
    service.record('g1', 'game:start', { agents: [] });
    service.record('g1', 'round:start', { round: 1 });
    service.record('g1', 'round:end', { round: 1 });

    const events = service.getReplay('g1');
    expect(events).toHaveLength(3);
    expect(events[0]!.sequence).toBe(1);
    expect(events[1]!.sequence).toBe(2);
    expect(events[2]!.sequence).toBe(3);
    expect(events[0]!.event_type).toBe('game:start');
  });

  it('returns events in order', () => {
    service.record('g1', 'a', { x: 1 });
    service.record('g1', 'b', { x: 2 });
    service.record('g1', 'c', { x: 3 });

    const events = service.getReplay('g1');
    expect(events.map((e) => e.event_type)).toEqual(['a', 'b', 'c']);
  });

  it('stores JSON data correctly', () => {
    service.record('g1', 'test', { foo: 'bar', num: 42 });
    const events = service.getReplay('g1');
    expect(JSON.parse(events[0]!.data)).toEqual({ foo: 'bar', num: 42 });
  });

  it('returns correct event count', () => {
    expect(service.getEventCount('g1')).toBe(0);
    service.record('g1', 'a', {});
    service.record('g1', 'b', {});
    expect(service.getEventCount('g1')).toBe(2);
  });

  it('returns empty array for unknown game', () => {
    expect(service.getReplay('nonexistent')).toEqual([]);
  });

  it('cleanup removes sequence tracking', () => {
    service.record('g1', 'a', {});
    service.cleanup('g1');
    // After cleanup, new recordings start from 1 again
    // But old events are still in DB
    expect(service.getReplay('g1')).toHaveLength(1);
  });
});
