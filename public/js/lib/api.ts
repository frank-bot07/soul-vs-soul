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
