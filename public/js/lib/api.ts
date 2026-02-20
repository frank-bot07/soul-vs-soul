/** REST API client */

const BASE = '/api/v1';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'UNKNOWN', message: res.statusText }));
    throw new ApiError(body.error ?? 'UNKNOWN', body.message ?? res.statusText, res.status);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface AgentResponse {
  id: string;
  displayId: string;
  name: string;
  personality?: string;
  avatarSeed: string;
  playCount?: number;
  winCount?: number;
  createdAt?: string;
}

export interface GameResponse {
  id: string;
  status: string;
  agents: AgentResponse[];
  mode: string;
  createdAt: string;
}

export function listAgents(): Promise<AgentResponse[]> {
  return request<AgentResponse[]>('/agents');
}

export function getAgent(id: string): Promise<AgentResponse> {
  return request<AgentResponse>(`/agents/${encodeURIComponent(id)}`);
}

export function createAgent(name: string, personality: string): Promise<AgentResponse> {
  return request<AgentResponse>('/agents', {
    method: 'POST',
    body: JSON.stringify({ name, personality }),
  });
}

export function listGames(): Promise<GameResponse[]> {
  return request<GameResponse[]>('/games');
}

export function getGame(id: string): Promise<GameResponse> {
  return request<GameResponse>(`/games/${encodeURIComponent(id)}`);
}

export function createGame(agentIds: string[], mode: string = 'elimination'): Promise<GameResponse> {
  return request<GameResponse>('/games', {
    method: 'POST',
    body: JSON.stringify({ agents: agentIds, mode }),
  });
}

export function startGame(id: string): Promise<GameResponse> {
  return request<GameResponse>(`/games/${encodeURIComponent(id)}/start`, {
    method: 'POST',
  });
}

export interface GameResultsResponse {
  gameId: string;
  status: string;
  winner: string | null;
  agents: Array<{ agent_id: string; final_score: number | null; placement: number | null }>;
}

export function getGameResults(id: string): Promise<GameResultsResponse> {
  return request<GameResultsResponse>(`/games/${encodeURIComponent(id)}/results`);
}

// Replay
export interface ReplayResponse {
  gameId: string;
  status: string;
  totalEvents: number;
  events: Array<{ sequence: number; eventType: string; data: Record<string, unknown>; timestamp: number }>;
}

export function getReplay(id: string): Promise<ReplayResponse> {
  return request<ReplayResponse>(`/games/${encodeURIComponent(id)}/replay`);
}

// Leaderboard
export interface LeaderboardResponse {
  entries: Array<{
    agent_id: string; name: string; display_id: string; avatar_seed: string;
    elo_rating: number; total_games: number; total_wins: number;
  }>;
  total: number;
}

export function getLeaderboard(limit = 20, offset = 0): Promise<LeaderboardResponse> {
  return request<LeaderboardResponse>(`/leaderboard?limit=${limit}&offset=${offset}`);
}

// User profiles
export interface UserProfileResponse {
  id: string;
  displayName: string;
  joinedAt: number;
  agents: Array<{ id: string; name: string; play_count: number; win_count: number }>;
  recentGames: Array<{ game_id: string; placement: number | null; status: string }>;
  stats: { totalGames: number; wins: number; losses: number; winRate: number };
}

export function getUserProfile(id: string): Promise<UserProfileResponse> {
  return request<UserProfileResponse>(`/users/${encodeURIComponent(id)}`);
}

// Agent search
export function searchAgents(opts: { search?: string; sort?: string; preset?: string; limit?: number; offset?: number }): Promise<{ agents: AgentResponse[] }> {
  const params = new URLSearchParams();
  if (opts.search) params.set('search', opts.search);
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.preset) params.set('preset', opts.preset);
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.offset) params.set('offset', String(opts.offset));
  return request<{ agents: AgentResponse[] }>(`/agents?${params.toString()}`);
}

// Game lobby
export function listGamesFiltered(opts: { status?: string; sort?: string; limit?: number; offset?: number }): Promise<{ games: Array<{ id: string; status: string; mode: string; created_at: number }> }> {
  const params = new URLSearchParams();
  if (opts.status) params.set('status', opts.status);
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.offset) params.set('offset', String(opts.offset));
  return request<{ games: Array<{ id: string; status: string; mode: string; created_at: number }> }>(`/games?${params.toString()}`);
}
