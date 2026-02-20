import crypto from 'node:crypto';
import { GameQueries } from '../db/queries/games.js';
import { AgentQueries } from '../db/queries/agents.js';
import { GameEngine } from '../engine/GameEngine.js';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors.js';
import type { Agent, GameConfig } from '../engine/types.js';

export class GameService {
  private locks = new Map<string, Promise<void>>();

  constructor(
    private gameQueries: GameQueries,
    private agentQueries: AgentQueries,
    private engine: GameEngine,
  ) {
    this.wireEngineEvents();
  }

  private wireEngineEvents(): void {
    this.engine.on('game:start', (data) => {
      this.gameQueries.setTotalRounds(data.gameId, data.rounds);
    });

    this.engine.on('round:end', (data) => {
      this.gameQueries.updateRound(data.gameId, data.round);
    });

    this.engine.on('game:end', (data) => {
      this.gameQueries.updateStatus(data.gameId, 'completed');
      // Find actual agent id from displayId
      const standings = data.finalStandings;
      if (standings[0]) {
        this.gameQueries.setWinner(data.gameId, standings[0].agentId);
        for (const s of standings) {
          this.gameQueries.updateAgentResult(data.gameId, s.agentId, s.score, s.placement, s.eliminatedRound);
        }
      }
    });

    this.engine.on('game:error', (data) => {
      this.gameQueries.updateStatus(data.gameId, 'cancelled');
    });
  }

  async createGame(input: { agents: string[]; mode: string; visibility: string }, sessionId: string) {
    // Validate all agents exist
    for (const agentId of input.agents) {
      const agent = this.agentQueries.getPublic(agentId);
      if (!agent) throw new ValidationError(`Agent ${agentId} not found`);
    }

    const id = crypto.randomUUID();
    this.gameQueries.create({
      id,
      mode: input.mode,
      visibility: input.visibility,
      creatorSession: sessionId,
      config: JSON.stringify({}),
    });

    for (const agentId of input.agents) {
      this.gameQueries.addAgent(id, agentId);
    }

    return { id, status: 'pending', mode: input.mode, createdAt: new Date().toISOString() };
  }

  async startGame(gameId: string): Promise<void> {
    await this.withLock(gameId, async () => {
      const game = this.gameQueries.get(gameId);
      if (!game) throw new NotFoundError('Game');
      if (game.status !== 'pending') throw new ConflictError('Game already started');

      this.gameQueries.updateStatus(gameId, 'running');

      const gameAgents = this.gameQueries.getAgents(gameId);
      const agents: Agent[] = [];
      for (const ga of gameAgents) {
        const agentRow = this.agentQueries.getInternal(ga.agent_id);
        if (!agentRow) continue;
        agents.push({
          id: agentRow.id,
          displayId: agentRow.display_id,
          name: agentRow.name,
          personality: agentRow.personality,
          systemPrompt: agentRow.system_prompt,
          avatarSeed: agentRow.avatar_seed,
        });
      }

      const config: GameConfig = {
        mode: game.mode as 'elimination' | 'round_robin',
        visibility: game.visibility as 'public' | 'private',
      };

      // Run asynchronously — don't block the HTTP response
      void this.engine.runGame(gameId, agents, config);
    });
  }

  getGame(gameId: string) {
    const game = this.gameQueries.get(gameId);
    if (!game) throw new NotFoundError('Game');
    const agents = this.gameQueries.getAgents(gameId);
    return { ...game, agents };
  }

  listGames(opts: { limit?: number; offset?: number; status?: string; sort?: string }) {
    return this.gameQueries.listFiltered(opts);
  }

  getResults(gameId: string) {
    const game = this.gameQueries.get(gameId);
    if (!game) throw new NotFoundError('Game');
    const agents = this.gameQueries.getAgents(gameId);
    return {
      gameId,
      status: game.status,
      winner: game.winner_agent_id,
      agents: agents.sort((a, b) => (a.placement ?? 999) - (b.placement ?? 999)),
    };
  }

  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    let resolve: () => void;
    const current = new Promise<void>((r) => {
      resolve = r;
    });
    this.locks.set(key, current);

    await prev;
    try {
      return await fn();
    } finally {
      resolve!();
      if (this.locks.get(key) === current) {
        this.locks.delete(key);
      }
    }
  }
}
