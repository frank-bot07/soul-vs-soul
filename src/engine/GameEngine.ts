import { EventEmitter } from 'node:events';
import type { Agent, ActiveAgent, GameConfig, GameState, GameEventMap, PublicAgent, Standing, RoundResult } from './types.js';
import type { ChallengeRegistry } from './ChallengeRegistry.js';
import { PairingManager } from './Pairing.js';
import { NormalizedScore } from './Scorer.js';

type EventKey = keyof GameEventMap;

export class GameEngine extends EventEmitter {
  private games = new Map<string, GameState>();
  private pairing = new PairingManager();
  private queryHandler?: (agentId: string, prompt: string) => Promise<string>;

  constructor(private challengeRegistry: ChallengeRegistry) {
    super();
  }

  setQueryHandler(handler: (agentId: string, prompt: string) => Promise<string>): void {
    this.queryHandler = handler;
  }

  override emit<K extends EventKey>(event: K, data: GameEventMap[K]): boolean {
    return super.emit(event, data);
  }

  override on<K extends EventKey>(event: K, listener: (data: GameEventMap[K]) => void): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  private toPublicAgent(a: ActiveAgent): PublicAgent {
    return {
      displayId: a.displayId,
      name: a.name,
      avatarSeed: a.avatarSeed,
      score: a.score,
      eliminated: a.eliminated,
    };
  }

  private getActiveAgents(state: GameState): ActiveAgent[] {
    return state.agents.filter((a) => !a.eliminated);
  }

  private calculateRounds(agentCount: number): number {
    if (agentCount <= 2) return 1;
    return Math.ceil(Math.log2(agentCount));
  }

  private calculateStandings(state: GameState): Standing[] {
    return [...state.agents]
      .sort((a, b) => b.score - a.score)
      .map((a, i) => ({
        agentId: a.id,
        displayId: a.displayId,
        name: a.name,
        score: a.score,
        placement: i + 1,
        ...(a.eliminated ? { eliminatedRound: state.currentRound } : {}),
      }));
  }

  async runGame(gameId: string, agents: Agent[], config: GameConfig): Promise<void> {
    const state: GameState = {
      gameId,
      agents: agents.map((a) => ({ ...a, score: 0, eliminated: false })),
      currentRound: 0,
      config,
    };
    this.games.set(gameId, state);

    const totalRounds = this.calculateRounds(agents.length);
    this.emit('game:start', {
      gameId,
      agents: state.agents.map((a) => this.toPublicAgent(a)),
      rounds: totalRounds,
    });

    try {
      while (this.getActiveAgents(state).length > 1 && state.currentRound < totalRounds) {
        await this.runRound(state);
      }

      const active = this.getActiveAgents(state);
      const winner = active.reduce((best, a) => (a.score > best.score ? a : best), active[0]!);

      this.emit('game:end', {
        gameId,
        winner: this.toPublicAgent(winner),
        finalStandings: this.calculateStandings(state),
      });
    } catch (err) {
      this.emit('game:error', { gameId, error: String(err) });
    } finally {
      this.games.delete(gameId);
    }
  }

  private async runRound(state: GameState): Promise<void> {
    state.currentRound++;
    const matchups = this.pairing.createMatchups(state.agents, state.currentRound);

    this.emit('round:start', {
      gameId: state.gameId,
      round: state.currentRound,
      matchups: matchups.map((m) => ({
        type: m.type,
        agentDisplayIds: m.agents.map((a) => a.displayId),
      })),
    });

    const challenge = this.challengeRegistry.getRandom();
    this.emit('challenge:start', {
      gameId: state.gameId,
      challenge: {
        type: challenge.type,
        description: challenge.description,
        publicDescription: challenge.publicDescription,
      },
    });

    const roundResults: RoundResult[] = [];

    for (const matchup of matchups) {
      if (matchup.type === 'bye') {
        // BYE agent gets average score of all round results so far, or 50
        const byeAgent = matchup.agents[0]!;
        const avg = roundResults.length > 0
          ? roundResults.reduce((s, r) => s + r.score, 0) / roundResults.length
          : 50;
        const byeScore = new NormalizedScore(avg);
        byeAgent.score += byeScore.value;
        roundResults.push({ agentId: byeAgent.id, score: byeScore.value });
        continue;
      }

      for (const agent of matchup.agents) {
        const prompt = challenge.generatePrompt({
          round: state.currentRound,
          agents: matchup.agents,
          criteria: challenge.description,
        });

        this.emit('agent:query', { gameId: state.gameId, agentId: agent.id, prompt });

        let response: string;
        try {
          response = this.queryHandler
            ? await this.queryHandler(agent.id, prompt)
            : `[Agent ${agent.name} response placeholder]`;
        } catch {
          response = '[Agent failed to respond]';
        }

        const score = await challenge.scoreResponse(response, {
          round: state.currentRound,
          agents: matchup.agents,
          criteria: challenge.description,
        });

        agent.score += score.value;

        this.emit('agent:response', {
          gameId: state.gameId,
          agentId: agent.displayId,
          response,
          score: score.value,
        });

        roundResults.push({ agentId: agent.id, score: score.value, response });
      }
    }

    this.emit('round:end', {
      gameId: state.gameId,
      round: state.currentRound,
      results: roundResults,
    });

    // Elimination: remove lowest scorer if elimination mode
    if (state.config.mode === 'elimination' && this.getActiveAgents(state).length > 2) {
      const active = this.getActiveAgents(state);
      const lowest = active.reduce((min, a) => (a.score < min.score ? a : min), active[0]!);
      lowest.eliminated = true;

      this.emit('elimination', {
        gameId: state.gameId,
        agentId: lowest.displayId,
        round: state.currentRound,
      });
    }
  }
}
