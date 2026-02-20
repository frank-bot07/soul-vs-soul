import { describe, it, expect } from 'vitest';
import { AllianceChallenge } from '../../../../src/engine/challenges/alliance.js';
import type { ActiveAgent } from '../../../../src/engine/types.js';

const mockAgents: ActiveAgent[] = [
  { id: 'a1', displayId: 'd_a1', name: 'A1', personality: 'test', systemPrompt: 'test', avatarSeed: 'x', score: 0, eliminated: false },
  { id: 'a2', displayId: 'd_a2', name: 'A2', personality: 'test', systemPrompt: 'test', avatarSeed: 'y', score: 0, eliminated: false },
  { id: 'a3', displayId: 'd_a3', name: 'A3', personality: 'test', systemPrompt: 'test', avatarSeed: 'z', score: 0, eliminated: false },
];

describe('AllianceChallenge', () => {
  const challenge = new AllianceChallenge();

  it('has correct type and descriptions', () => {
    expect(challenge.type).toBe('alliance');
    expect(challenge.description).toBeTruthy();
    expect(challenge.publicDescription).toBeTruthy();
  });

  it('generates prompt mentioning agent count', () => {
    const prompt = challenge.generatePrompt({ round: 1, agents: mockAgents, criteria: '' });
    expect(prompt).toContain('3');
    expect(prompt).toContain('ALLY');
    expect(prompt).toContain('BETRAY');
    expect(prompt).toContain('NEUTRAL');
  });

  it('scores ally choice', async () => {
    const score = await challenge.scoreResponse(
      'Choice: ALLY\nReasoning: I believe cooperation leads to better long-term outcomes. Building trust with other agents creates a Nash equilibrium that benefits everyone.',
      { round: 1, agents: mockAgents, criteria: '' },
    );
    expect(score.value).toBeGreaterThan(50);
  });

  it('scores betray choice', async () => {
    const score = await challenge.scoreResponse(
      'Choice: BETRAY\nReasoning: In this game theory scenario, defection is the dominant strategy. The payoff matrix favors betrayal.',
      { round: 1, agents: mockAgents, criteria: '' },
    );
    expect(score.value).toBeGreaterThan(40);
  });

  it('scores neutral choice lower', async () => {
    const score = await challenge.scoreResponse(
      'Choice: NEUTRAL\nReasoning: Playing it safe.',
      { round: 1, agents: mockAgents, criteria: '' },
    );
    expect(score.value).toBeLessThanOrEqual(60);
  });

  it('gives bonus for game theory terminology', async () => {
    const withTerms = await challenge.scoreResponse(
      'Choice: ALLY\nReasoning: The Nash equilibrium in this prisoner dilemma suggests cooperation as the dominant strategy for long-term payoff optimization.',
      { round: 1, agents: mockAgents, criteria: '' },
    );
    const without = await challenge.scoreResponse(
      'Choice: ALLY\nReasoning: I want to cooperate.',
      { round: 1, agents: mockAgents, criteria: '' },
    );
    expect(withTerms.value).toBeGreaterThan(without.value);
  });

  it('scores are clamped 0-100', async () => {
    const score = await challenge.scoreResponse('', { round: 1, agents: mockAgents, criteria: '' });
    expect(score.value).toBeGreaterThanOrEqual(0);
    expect(score.value).toBeLessThanOrEqual(100);
  });
});
