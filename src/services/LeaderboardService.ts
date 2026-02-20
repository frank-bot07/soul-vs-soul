import { LeaderboardQueries } from '../db/queries/leaderboard.js';
import type { Standing } from '../engine/types.js';

const DEFAULT_ELO = 1000;
const K_FACTOR = 32;

export class LeaderboardService {
  constructor(private leaderboardQueries: LeaderboardQueries) {}

  /** Calculate expected score using ELO formula */
  static expectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  /** Calculate new ELO rating */
  static calculateNewRating(currentRating: number, expectedScore: number, actualScore: number): number {
    return Math.round(currentRating + K_FACTOR * (actualScore - expectedScore));
  }

  updateFromGame(data: { gameId: string; finalStandings: Standing[] }): void {
    const standings = data.finalStandings;
    if (standings.length < 2) return;

    // Get current ratings for all agents
    const ratings = new Map<string, number>();
    for (const s of standings) {
      const entry = this.leaderboardQueries.getByAgent(s.agentId);
      ratings.set(s.agentId, entry?.elo_rating ?? DEFAULT_ELO);
    }

    // Calculate new ratings using pairwise ELO
    const newRatings = new Map<string, number>();
    for (const s of standings) {
      newRatings.set(s.agentId, ratings.get(s.agentId)!);
    }

    // Each pair: higher-placed agent "wins" vs lower-placed
    for (let i = 0; i < standings.length; i++) {
      for (let j = i + 1; j < standings.length; j++) {
        const a = standings[i]!;
        const b = standings[j]!;
        const ratingA = ratings.get(a.agentId)!;
        const ratingB = ratings.get(b.agentId)!;
        const expectedA = LeaderboardService.expectedScore(ratingA, ratingB);
        const expectedB = 1 - expectedA;

        // a placed higher (lower placement number = better)
        const actualA = 1;
        const actualB = 0;

        const deltaA = K_FACTOR * (actualA - expectedA) / (standings.length - 1);
        const deltaB = K_FACTOR * (actualB - expectedB) / (standings.length - 1);

        newRatings.set(a.agentId, newRatings.get(a.agentId)! + deltaA);
        newRatings.set(b.agentId, newRatings.get(b.agentId)! + deltaB);
      }
    }

    // Update DB
    const winnerId = standings[0]!.agentId;
    for (const s of standings) {
      const current = this.leaderboardQueries.getByAgent(s.agentId);
      const isWinner = s.agentId === winnerId;
      this.leaderboardQueries.upsert(s.agentId, {
        eloRating: Math.round(newRatings.get(s.agentId)!),
        totalGames: (current?.total_games ?? 0) + 1,
        totalWins: (current?.total_wins ?? 0) + (isWinner ? 1 : 0),
        totalScore: (current?.total_score ?? 0) + s.score,
      });
    }
  }

  getLeaderboard(limit = 20, offset = 0) {
    return this.leaderboardQueries.getTop(limit, offset);
  }

  getAgentStats(agentId: string) {
    return this.leaderboardQueries.getByAgent(agentId);
  }

  getCount(): number {
    return this.leaderboardQueries.count();
  }
}
