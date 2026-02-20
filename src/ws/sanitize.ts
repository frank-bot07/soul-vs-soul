interface InternalAgent {
  id?: string;
  displayId: string;
  name: string;
  avatarSeed?: string;
  avatar?: string;
  score: number;
  eliminated: boolean;
  systemPrompt?: string;
  apiKey?: string;
  personality?: string;
}

interface InternalGameState {
  gameId: string;
  round?: number;
  currentRound?: number;
  phase?: string;
  agents: InternalAgent[];
  currentChallenge?: {
    type: string;
    publicDescription: string;
    description?: string;
    responses?: Array<{
      agentDisplayId: string;
      sanitizedResponse: string;
      rawResponse?: string;
      normalizedScore: number;
    }>;
  };
  spectators?: { size: number };
  startedAt?: number;
}

export interface PublicGameState {
  gameId: string;
  round: number;
  phase?: string;
  agents: Array<{
    displayId: string;
    name: string;
    avatar?: string;
    score: number;
    eliminated: boolean;
  }>;
  currentChallenge: {
    type: string;
    description: string;
    responses?: Array<{
      agentDisplayId: string;
      response: string;
      score: number;
    }>;
  } | null;
  spectatorCount: number;
  startedAt?: number;
}

export function sanitizeGameState(state: InternalGameState): PublicGameState {
  return {
    gameId: state.gameId,
    round: state.currentRound ?? state.round ?? 0,
    phase: state.phase,
    agents: state.agents.map((a) => ({
      displayId: a.displayId,
      name: a.name,
      avatar: a.avatar ?? a.avatarSeed,
      score: a.score,
      eliminated: a.eliminated,
    })),
    currentChallenge: state.currentChallenge
      ? {
          type: state.currentChallenge.type,
          description: state.currentChallenge.publicDescription,
          responses: state.currentChallenge.responses?.map((r) => ({
            agentDisplayId: r.agentDisplayId,
            response: r.sanitizedResponse,
            score: r.normalizedScore,
          })),
        }
      : null,
    spectatorCount: state.spectators?.size ?? 0,
    startedAt: state.startedAt,
  };
}
