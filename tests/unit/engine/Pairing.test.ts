import { describe, it, expect } from 'vitest';
import { PairingManager } from '../../../src/engine/Pairing.js';
import type { ActiveAgent } from '../../../src/engine/types.js';

function makeAgent(id: string): ActiveAgent {
  return { id, displayId: `d_${id}`, name: `Agent ${id}`, personality: '', systemPrompt: '', avatarSeed: 'x', score: 0, eliminated: false };
}

describe('PairingManager', () => {
  const pairing = new PairingManager();

  it('pairs even number of agents', () => {
    const agents = [makeAgent('1'), makeAgent('2'), makeAgent('3'), makeAgent('4')];
    const matchups = pairing.createMatchups(agents, 1);
    expect(matchups.length).toBe(2);
    expect(matchups.every((m) => m.type === 'head-to-head')).toBe(true);
    expect(matchups.every((m) => m.agents.length === 2)).toBe(true);
  });

  it('handles odd number with BYE', () => {
    const agents = [makeAgent('1'), makeAgent('2'), makeAgent('3')];
    const matchups = pairing.createMatchups(agents, 1);
    const byes = matchups.filter((m) => m.type === 'bye');
    const heads = matchups.filter((m) => m.type === 'head-to-head');
    expect(byes.length).toBe(1);
    expect(heads.length).toBe(1);
    expect(byes[0]!.agents.length).toBe(1);
  });

  it('rotates BYE across rounds', () => {
    const agents = [makeAgent('1'), makeAgent('2'), makeAgent('3')];
    const bye1 = pairing.createMatchups(agents, 1).find((m) => m.type === 'bye')!.agents[0]!.id;
    const bye2 = pairing.createMatchups(agents, 2).find((m) => m.type === 'bye')!.agents[0]!.id;
    const bye3 = pairing.createMatchups(agents, 3).find((m) => m.type === 'bye')!.agents[0]!.id;
    // At least one should be different (rotation)
    const byeIds = new Set([bye1, bye2, bye3]);
    expect(byeIds.size).toBeGreaterThan(1);
  });

  it('skips eliminated agents', () => {
    const agents = [makeAgent('1'), makeAgent('2'), { ...makeAgent('3'), eliminated: true }, makeAgent('4')];
    const matchups = pairing.createMatchups(agents, 1);
    const allAgents = matchups.flatMap((m) => m.agents);
    expect(allAgents.find((a) => a.id === '3')).toBeUndefined();
  });

  it('returns empty for less than 2 agents', () => {
    expect(pairing.createMatchups([makeAgent('1')], 1)).toEqual([]);
    expect(pairing.createMatchups([], 1)).toEqual([]);
  });
});
