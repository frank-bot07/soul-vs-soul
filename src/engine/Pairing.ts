import type { ActiveAgent, Matchup } from './types.js';

export class PairingManager {
  createMatchups(agents: ActiveAgent[], round: number): Matchup[] {
    const active = agents.filter((a) => !a.eliminated);
    if (active.length < 2) return [];

    const shuffled = this.seededShuffle(active, round);
    const matchups: Matchup[] = [];

    if (shuffled.length % 2 === 1) {
      const byeIndex = round % shuffled.length;
      const byeAgent = shuffled.splice(byeIndex, 1)[0]!;
      matchups.push({ type: 'bye', agents: [byeAgent] });
    }

    for (let i = 0; i < shuffled.length; i += 2) {
      matchups.push({
        type: 'head-to-head',
        agents: [shuffled[i]!, shuffled[i + 1]!],
      });
    }

    return matchups;
  }

  private seededShuffle<T>(arr: T[], seed: number): T[] {
    const result = [...arr];
    let s = seed;
    for (let i = result.length - 1; i > 0; i--) {
      s = ((s * 1664525 + 1013904223) >>> 0);
      const j = s % (i + 1);
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }
}
