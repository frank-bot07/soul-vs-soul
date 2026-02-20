export interface Agent {
  id: string;
  displayId: string;
  name: string;
  personality: string;
  systemPrompt: string;
  avatarSeed: string;
}

export interface ActiveAgent extends Agent {
  score: number;
  eliminated: boolean;
}

export interface PublicAgent {
  displayId: string;
  name: string;
  avatarSeed: string;
  score: number;
  eliminated: boolean;
}

export interface Matchup {
  type: 'head-to-head' | 'bye';
  agents: ActiveAgent[];
}

export interface ChallengeInfo {
  type: string;
  description: string;
  publicDescription: string;
}

export interface ChallengeContext {
  round: number;
  agents: ActiveAgent[];
  criteria: string;
}

export interface RoundResult {
  agentId: string;
  score: number;
  response?: string;
}

export interface Standing {
  agentId: string;
  displayId: string;
  name: string;
  score: number;
  placement: number;
  eliminatedRound?: number;
}

export interface GameConfig {
  mode: 'elimination' | 'round_robin';
  visibility: 'public' | 'private';
}

export interface GameState {
  gameId: string;
  agents: ActiveAgent[];
  currentRound: number;
  config: GameConfig;
}

export type GameEventMap = {
  'game:start': { gameId: string; agents: PublicAgent[]; rounds: number };
  'round:start': { gameId: string; round: number; matchups: Array<{ type: string; agentDisplayIds: string[] }> };
  'challenge:start': { gameId: string; challenge: ChallengeInfo };
  'agent:query': { gameId: string; agentId: string; prompt: string };
  'agent:response': { gameId: string; agentId: string; response: string; score: number };
  'round:end': { gameId: string; round: number; results: RoundResult[] };
  'elimination': { gameId: string; agentId: string; round: number };
  'game:end': { gameId: string; winner: PublicAgent; finalStandings: Standing[] };
  'game:error': { gameId: string; error: string };
};
