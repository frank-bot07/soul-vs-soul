import type { Challenge } from '../ChallengeRegistry.js';
import type { ChallengeContext } from '../types.js';
import { NormalizedScore } from '../Scorer.js';

const TOPICS = [
  'Is artificial intelligence a net positive for humanity?',
  'Should space exploration be prioritized over solving Earth problems?',
  'Is social media making society better or worse?',
  'Should universal basic income be implemented globally?',
  'Is privacy more important than security?',
  'Should genetic engineering of humans be allowed?',
  'Is democracy the best form of government?',
  'Should art created by AI be considered real art?',
];

export class DebateChallenge implements Challenge {
  readonly type = 'debate';
  readonly description = 'Two agents debate a topic, scored on persuasiveness, logic, and creativity';
  readonly publicDescription = 'Debate Challenge: Agents argue their positions on a provocative topic';

  generatePrompt(context: ChallengeContext): string {
    const topic = TOPICS[context.round % TOPICS.length]!;
    return `You are participating in a debate. Your topic is: "${topic}"\n\nPresent your argument clearly and persuasively. Be creative, use logic, and make compelling points. You have one response to make your case. Keep it under 300 words.`;
  }

  async scoreResponse(response: string, _context: ChallengeContext): Promise<NormalizedScore> {
    // Without LLM judge, use heuristic scoring
    let score = 50; // Base score

    // Length bonus (reward substantive responses, penalize too short/long)
    const wordCount = response.split(/\s+/).length;
    if (wordCount >= 50 && wordCount <= 300) score += 15;
    else if (wordCount >= 30) score += 5;
    else if (wordCount < 10) score -= 20;

    // Structure bonus (paragraphs, arguments)
    const paragraphs = response.split(/\n\n+/).length;
    if (paragraphs >= 2) score += 10;

    // Reasoning indicators
    const reasoningWords = ['because', 'therefore', 'however', 'furthermore', 'moreover', 'consequently'];
    const reasoningCount = reasoningWords.filter((w) => response.toLowerCase().includes(w)).length;
    score += Math.min(reasoningCount * 5, 15);

    // Variety bonus
    const uniqueWords = new Set(response.toLowerCase().split(/\s+/));
    const uniqueRatio = uniqueWords.size / Math.max(wordCount, 1);
    if (uniqueRatio > 0.6) score += 10;

    return new NormalizedScore(score);
  }
}
