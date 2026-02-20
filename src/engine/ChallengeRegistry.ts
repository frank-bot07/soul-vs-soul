import type { ChallengeContext } from './types.js';
import { NormalizedScore } from './Scorer.js';

export interface Challenge {
  readonly type: string;
  readonly description: string;
  readonly publicDescription: string;
  generatePrompt(context: ChallengeContext): string;
  scoreResponse(response: string, context: ChallengeContext): Promise<NormalizedScore>;
}

export class ChallengeRegistry {
  private challenges = new Map<string, Challenge>();

  register(challenge: Challenge): void {
    this.challenges.set(challenge.type, challenge);
  }

  get(type: string): Challenge | undefined {
    return this.challenges.get(type);
  }

  getRandom(): Challenge {
    const types = [...this.challenges.values()];
    if (types.length === 0) {
      throw new Error('No challenges registered');
    }
    return types[Math.floor(Math.random() * types.length)]!;
  }

  getAll(): Challenge[] {
    return [...this.challenges.values()];
  }
}
