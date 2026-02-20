import { describe, it, expect, vi } from 'vitest';
import { GameEngine } from '../../../src/engine/GameEngine.js';
import { ChallengeRegistry } from '../../../src/engine/ChallengeRegistry.js';
import { DebateChallenge } from '../../../src/engine/challenges/debate.js';
import type { Agent } from '../../../src/engine/types.js';

function makeAgent(id: string): Agent {
  return { id, displayId: `d_${id}`, name: `Agent ${id}`, personality: 'test personality text', systemPrompt: 'test', avatarSeed: 'x' };
}

describe('GameEngine', () => {
  it('emits game:start and game:end events', async () => {
    const registry = new ChallengeRegistry();
    registry.register(new DebateChallenge());
    const engine = new GameEngine(registry);

    const events: string[] = [];
    engine.on('game:start', () => events.push('game:start'));
    engine.on('game:end', () => events.push('game:end'));
    engine.on('round:start', () => events.push('round:start'));
    engine.on('round:end', () => events.push('round:end'));
    engine.on('challenge:start', () => events.push('challenge:start'));

    await engine.runGame('g1', [makeAgent('a'), makeAgent('b')], { mode: 'elimination', visibility: 'public' });

    expect(events).toContain('game:start');
    expect(events).toContain('game:end');
    expect(events).toContain('round:start');
    expect(events).toContain('round:end');
  });

  it('emits agent:query and agent:response for each agent', async () => {
    const registry = new ChallengeRegistry();
    registry.register(new DebateChallenge());
    const engine = new GameEngine(registry);

    const queries: string[] = [];
    const responses: string[] = [];
    engine.on('agent:query', (d) => queries.push(d.agentId));
    engine.on('agent:response', (d) => responses.push(d.agentId));

    await engine.runGame('g2', [makeAgent('a'), makeAgent('b')], { mode: 'elimination', visibility: 'public' });

    expect(queries).toContain('a');
    expect(queries).toContain('b');
    // agent:response now emits displayId instead of internal id
    expect(responses).toContain('d_a');
    expect(responses).toContain('d_b');
  });

  it('emits elimination in elimination mode with >2 agents', async () => {
    const registry = new ChallengeRegistry();
    registry.register(new DebateChallenge());
    const engine = new GameEngine(registry);

    const eliminations: string[] = [];
    engine.on('elimination', (d) => eliminations.push(d.agentId));

    await engine.runGame('g3', [makeAgent('a'), makeAgent('b'), makeAgent('c'), makeAgent('d')], {
      mode: 'elimination',
      visibility: 'public',
    });

    expect(eliminations.length).toBeGreaterThan(0);
  });

  it('uses custom query handler when set', async () => {
    const registry = new ChallengeRegistry();
    registry.register(new DebateChallenge());
    const engine = new GameEngine(registry);

    const handler = vi.fn().mockResolvedValue('Custom response because I think therefore I am furthermore');
    engine.setQueryHandler(handler);

    await engine.runGame('g4', [makeAgent('a'), makeAgent('b')], { mode: 'round_robin', visibility: 'public' });

    expect(handler).toHaveBeenCalled();
  });

  it('emits game:error on engine failure', async () => {
    const registry = new ChallengeRegistry();
    // No challenges registered — will throw
    const engine = new GameEngine(registry);

    const errors: string[] = [];
    engine.on('game:error', (d) => errors.push(d.error));

    await engine.runGame('g5', [makeAgent('a'), makeAgent('b')], { mode: 'elimination', visibility: 'public' });

    expect(errors.length).toBe(1);
  });
});
