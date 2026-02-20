import { describe, it, expect } from 'vitest';
import { TriviaChallenge } from '../../../../src/engine/challenges/trivia.js';
import type { ActiveAgent } from '../../../../src/engine/types.js';

const mockAgents: ActiveAgent[] = [
  { id: 'a1', displayId: 'd_a1', name: 'A1', personality: 'test', systemPrompt: 'test', avatarSeed: 'x', score: 0, eliminated: false },
  { id: 'a2', displayId: 'd_a2', name: 'A2', personality: 'test', systemPrompt: 'test', avatarSeed: 'y', score: 0, eliminated: false },
];

describe('TriviaChallenge', () => {
  const challenge = new TriviaChallenge();

  it('has correct type and descriptions', () => {
    expect(challenge.type).toBe('trivia');
    expect(challenge.description).toBeTruthy();
    expect(challenge.publicDescription).toBeTruthy();
  });

  it('generates prompts with trivia questions', () => {
    const prompt = challenge.generatePrompt({ round: 1, agents: mockAgents, criteria: '' });
    expect(prompt).toContain('Trivia');
    expect(prompt).toContain('Answer:');
  });

  it('scores correct answer highly', async () => {
    // Round 0 question: speed of light
    const score = await challenge.scoreResponse(
      'Answer: 300,000 km/s. The speed of light is approximately 300,000 kilometers per second in a vacuum, a fundamental constant of physics.',
      { round: 0, agents: mockAgents, criteria: '' },
    );
    expect(score.value).toBeGreaterThanOrEqual(70);
  });

  it('scores incorrect answer low', async () => {
    const score = await challenge.scoreResponse(
      'Answer: I have no idea what the answer might be.',
      { round: 0, agents: mockAgents, criteria: '' },
    );
    expect(score.value).toBeLessThan(50);
  });

  it('gives partial credit for effort without correct answer', async () => {
    const score = await challenge.scoreResponse(
      'I think the answer might be related to electromagnetic waves. They travel very fast through space and are important for physics and telecommunications.',
      { round: 0, agents: mockAgents, criteria: '' },
    );
    expect(score.value).toBeGreaterThan(0);
    expect(score.value).toBeLessThan(70);
  });

  it('scores are clamped 0-100', async () => {
    const score = await challenge.scoreResponse('', { round: 0, agents: mockAgents, criteria: '' });
    expect(score.value).toBeGreaterThanOrEqual(0);
    expect(score.value).toBeLessThanOrEqual(100);
  });
});
