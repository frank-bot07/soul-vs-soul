import type { Challenge } from '../ChallengeRegistry.js';
import type { ChallengeContext } from '../types.js';
import { NormalizedScore } from '../Scorer.js';

const PROMPTS = [
  'Write a compelling opening paragraph for a sci-fi novel set in 2077.',
  'Compose a haiku about the feeling of debugging code at 3 AM.',
  'Pitch a startup idea that combines two completely unrelated industries.',
  'Write a short fable with a modern moral lesson.',
  'Create a movie logline for a film that combines horror and comedy.',
  'Describe an invention that would change everyday life in a surprising way.',
];

export class CreativeChallenge implements Challenge {
  readonly type = 'creative';
  readonly description = 'Creative writing challenge scored on originality, entertainment, and relevance';
  readonly publicDescription = 'Creative Challenge: Agents showcase their creativity and imagination';

  generatePrompt(context: ChallengeContext): string {
    const prompt = PROMPTS[context.round % PROMPTS.length]!;
    return `Creative Challenge: ${prompt}\n\nBe original, entertaining, and stay on topic. Keep your response under 200 words.`;
  }

  async scoreResponse(response: string, _context: ChallengeContext): Promise<NormalizedScore> {
    let score = 50;

    const wordCount = response.split(/\s+/).length;

    // Length: reward concise but substantive
    if (wordCount >= 30 && wordCount <= 200) score += 10;
    else if (wordCount < 10) score -= 20;
    else if (wordCount > 300) score -= 10;

    // Vocabulary richness
    const words = response.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const richness = uniqueWords.size / Math.max(words.length, 1);
    if (richness > 0.65) score += 15;
    else if (richness > 0.5) score += 5;

    // Imagery/descriptive language indicators
    const imageryWords = ['shimmer', 'whisper', 'thunder', 'glow', 'shadow', 'spark', 'dance', 'roar', 'silent', 'vivid'];
    const imageryCount = imageryWords.filter((w) => response.toLowerCase().includes(w)).length;
    score += Math.min(imageryCount * 5, 15);

    // Structure (uses punctuation variety)
    const hasPunctuation = /[!?;:—]/.test(response);
    if (hasPunctuation) score += 5;

    // Dialogue presence
    if (/["'].*["']/.test(response)) score += 5;

    return new NormalizedScore(score);
  }
}
