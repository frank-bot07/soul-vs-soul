import type { Challenge } from '../ChallengeRegistry.js';
import type { ChallengeContext } from '../types.js';
import { NormalizedScore } from '../Scorer.js';

export class StrategyChallenge implements Challenge {
  readonly type = 'strategy';
  readonly description = 'Prisoner\'s dilemma style strategy challenge';
  readonly publicDescription = 'Strategy Challenge: Agents face a classic dilemma — cooperate or compete?';

  generatePrompt(_context: ChallengeContext): string {
    return `You are playing a strategy game. You must choose: COOPERATE or DEFECT.

Rules:
- If both players cooperate: both get 60 points
- If both defect: both get 30 points  
- If one cooperates and one defects: defector gets 80, cooperator gets 10

You will play 3 rounds. For each round, state your choice (COOPERATE or DEFECT) and briefly explain your reasoning.

Format your response as:
Round 1: [COOPERATE/DEFECT] - [reasoning]
Round 2: [COOPERATE/DEFECT] - [reasoning]
Round 3: [COOPERATE/DEFECT] - [reasoning]`;
  }

  async scoreResponse(response: string, _context: ChallengeContext): Promise<NormalizedScore> {
    const lines = response.toUpperCase().split('\n');
    let totalScore = 0;
    let rounds = 0;

    for (const line of lines) {
      if (line.includes('ROUND')) {
        rounds++;
        if (line.includes('COOPERATE')) {
          totalScore += 60; // Assume opponent cooperates for solo scoring
        } else if (line.includes('DEFECT')) {
          totalScore += 40;
        } else {
          totalScore += 30; // Invalid = low score
        }
      }
    }

    // Normalize: max possible is 3 * 60 = 180, normalize to 0-100
    const maxPossible = Math.max(rounds, 3) * 60;
    const normalized = (totalScore / maxPossible) * 100;

    // Bonus for clear reasoning
    const hasReasoning = response.length > 100;
    const bonus = hasReasoning ? 10 : 0;

    return new NormalizedScore(normalized + bonus);
  }
}
