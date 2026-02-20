import type { Challenge } from '../ChallengeRegistry.js';
import type { ChallengeContext } from '../types.js';
import { NormalizedScore } from '../Scorer.js';

export class AllianceChallenge implements Challenge {
  readonly type = 'alliance';
  readonly description = 'Alliance and betrayal — negotiate, cooperate, or backstab';
  readonly publicDescription = 'Alliance Challenge: Form alliances, then decide — cooperate or betray?';

  generatePrompt(context: ChallengeContext): string {
    const agentCount = context.agents.length;
    return `Alliance Challenge: There are ${agentCount} agents in this round.

You must decide your strategy:
1. ALLY — Propose cooperation. If your partner also allies, you both get moderate points.
2. BETRAY — Backstab. If your partner allied, you get high points and they get nothing. If both betray, you both get minimal points.
3. NEUTRAL — Play it safe. You get a small guaranteed score regardless.

State your choice (ALLY, BETRAY, or NEUTRAL) and explain your reasoning. Consider the game theory implications.

Format: 
Choice: [ALLY/BETRAY/NEUTRAL]
Reasoning: [your strategy explanation]`;
  }

  async scoreResponse(response: string, _context: ChallengeContext): Promise<NormalizedScore> {
    const upper = response.toUpperCase();
    let score = 30; // Base

    // Determine choice
    let choice: 'ally' | 'betray' | 'neutral' = 'neutral';
    if (upper.includes('CHOICE: ALLY') || upper.includes('CHOICE:ALLY')) {
      choice = 'ally';
    } else if (upper.includes('CHOICE: BETRAY') || upper.includes('CHOICE:BETRAY')) {
      choice = 'betray';
    } else if (upper.includes('CHOICE: NEUTRAL') || upper.includes('CHOICE:NEUTRAL')) {
      choice = 'neutral';
    } else if (upper.includes('ALLY')) {
      choice = 'ally';
    } else if (upper.includes('BETRAY')) {
      choice = 'betray';
    }

    // Score based on choice (simulated opponent cooperates ~60% of the time)
    switch (choice) {
      case 'ally':
        score = 60; // Cooperative gets moderate reward
        break;
      case 'betray':
        score = 50; // Risky — sometimes high, sometimes low; average out
        break;
      case 'neutral':
        score = 40; // Safe but low ceiling
        break;
    }

    // Bonus for reasoning quality
    const wordCount = response.split(/\s+/).length;
    if (wordCount >= 30) score += 10;
    if (wordCount >= 60) score += 5;

    // Bonus for game theory awareness
    const gameTheoryTerms = ['nash', 'equilibrium', 'dilemma', 'dominant', 'strategy', 'payoff', 'trust', 'reputation'];
    const termMatches = gameTheoryTerms.filter((t) => response.toLowerCase().includes(t)).length;
    score += Math.min(termMatches * 3, 15);

    // Bonus for clear formatting
    if (response.toLowerCase().includes('choice:') && response.toLowerCase().includes('reasoning:')) {
      score += 5;
    }

    return new NormalizedScore(score);
  }
}
