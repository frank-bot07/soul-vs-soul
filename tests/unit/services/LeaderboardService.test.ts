import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { LeaderboardService } from '../../../src/services/LeaderboardService.js';
import { LeaderboardQueries } from '../../../src/db/queries/leaderboard.js';
import { runMigrations } from '../../../src/db/migrator.js';

describe('LeaderboardService', () => {
  let db: Database.Database;
  let service: LeaderboardService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    db.prepare("INSERT INTO sessions (id, expires_at) VALUES ('s1', 9999999999)").run();
    db.prepare("INSERT INTO agents (id, display_id, name, personality, system_prompt, avatar_seed) VALUES ('a1', 'd_a1', 'Agent1', 'test', 'test', 'x')").run();
    db.prepare("INSERT INTO agents (id, display_id, name, personality, system_prompt, avatar_seed) VALUES ('a2', 'd_a2', 'Agent2', 'test', 'test', 'y')").run();
    db.prepare("INSERT INTO agents (id, display_id, name, personality, system_prompt, avatar_seed) VALUES ('a3', 'd_a3', 'Agent3', 'test', 'test', 'z')").run();

    const queries = new LeaderboardQueries(db);
    service = new LeaderboardService(queries);
  });

  afterEach(() => {
    db.close();
  });

  describe('ELO calculations', () => {
    it('calculates expected score correctly', () => {
      // Equal ratings → 0.5
      expect(LeaderboardService.expectedScore(1000, 1000)).toBeCloseTo(0.5);
      // Higher rating → higher expected
      expect(LeaderboardService.expectedScore(1200, 1000)).toBeGreaterThan(0.5);
      expect(LeaderboardService.expectedScore(800, 1000)).toBeLessThan(0.5);
    });

    it('calculates new rating correctly', () => {
      // Win when expected to lose → big gain
      const gain = LeaderboardService.calculateNewRating(1000, 0.25, 1);
      expect(gain).toBeGreaterThan(1000);
      expect(gain).toBe(1000 + Math.round(32 * (1 - 0.25)));

      // Lose when expected to win → big loss
      const loss = LeaderboardService.calculateNewRating(1200, 0.75, 0);
      expect(loss).toBeLessThan(1200);
    });
  });

  describe('updateFromGame', () => {
    it('updates leaderboard after a game', () => {
      service.updateFromGame({
        gameId: 'g1',
        finalStandings: [
          { agentId: 'a1', displayId: 'd_a1', name: 'Agent1', score: 100, placement: 1 },
          { agentId: 'a2', displayId: 'd_a2', name: 'Agent2', score: 50, placement: 2 },
        ],
      });

      const entries = service.getLeaderboard();
      expect(entries).toHaveLength(2);

      const a1 = service.getAgentStats('a1');
      const a2 = service.getAgentStats('a2');
      expect(a1!.total_games).toBe(1);
      expect(a1!.total_wins).toBe(1);
      expect(a1!.elo_rating).toBeGreaterThan(1000);
      expect(a2!.total_games).toBe(1);
      expect(a2!.total_wins).toBe(0);
      expect(a2!.elo_rating).toBeLessThan(1000);
    });

    it('handles 3-player games', () => {
      service.updateFromGame({
        gameId: 'g1',
        finalStandings: [
          { agentId: 'a1', displayId: 'd_a1', name: 'Agent1', score: 100, placement: 1 },
          { agentId: 'a2', displayId: 'd_a2', name: 'Agent2', score: 75, placement: 2 },
          { agentId: 'a3', displayId: 'd_a3', name: 'Agent3', score: 50, placement: 3 },
        ],
      });

      const a1 = service.getAgentStats('a1');
      const a3 = service.getAgentStats('a3');
      expect(a1!.elo_rating).toBeGreaterThan(a3!.elo_rating);
    });

    it('accumulates stats over multiple games', () => {
      service.updateFromGame({
        gameId: 'g1',
        finalStandings: [
          { agentId: 'a1', displayId: 'd_a1', name: 'Agent1', score: 100, placement: 1 },
          { agentId: 'a2', displayId: 'd_a2', name: 'Agent2', score: 50, placement: 2 },
        ],
      });

      service.updateFromGame({
        gameId: 'g2',
        finalStandings: [
          { agentId: 'a2', displayId: 'd_a2', name: 'Agent2', score: 100, placement: 1 },
          { agentId: 'a1', displayId: 'd_a1', name: 'Agent1', score: 50, placement: 2 },
        ],
      });

      const a1 = service.getAgentStats('a1');
      expect(a1!.total_games).toBe(2);
      expect(a1!.total_wins).toBe(1);
    });
  });

  it('returns count', () => {
    expect(service.getCount()).toBe(0);
    service.updateFromGame({
      gameId: 'g1',
      finalStandings: [
        { agentId: 'a1', displayId: 'd_a1', name: 'Agent1', score: 100, placement: 1 },
        { agentId: 'a2', displayId: 'd_a2', name: 'Agent2', score: 50, placement: 2 },
      ],
    });
    expect(service.getCount()).toBe(2);
  });
});
