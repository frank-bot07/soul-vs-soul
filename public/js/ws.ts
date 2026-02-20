/** WebSocket client with auto-reconnection */

export interface PublicAgent {
  displayId: string;
  name: string;
  avatar?: string;
  score: number;
  eliminated: boolean;
}

export interface PublicGameState {
  gameId: string;
  round: number;
  phase?: string;
  agents: PublicAgent[];
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

export interface RoundData { gameId: string; round: number; matchups: unknown[] }
export interface ChallengeData { gameId: string; challenge: { type: string; description: string; publicDescription: string } }
export interface ResponseData { gameId: string; agentId: string; response: string; score: number }
export interface EliminationData { gameId: string; agentId: string; round: number }
export interface GameEndData { gameId: string; winner: PublicAgent; finalStandings: Array<{ agentId: string; displayId: string; name: string; score: number; placement: number }> }
export interface ErrorData { message: string }

export class GameSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private gameId: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  onFullState?: (state: PublicGameState) => void;
  onRoundStart?: (data: RoundData) => void;
  onChallenge?: (data: ChallengeData) => void;
  onResponse?: (data: ResponseData) => void;
  onElimination?: (data: EliminationData) => void;
  onGameEnd?: (data: GameEndData) => void;
  onError?: (data: ErrorData) => void;
  onDisconnected?: (reason: string) => void;
  onConnectionChange?: (connected: boolean) => void;

  connect(gameId: string): void {
    this.gameId = gameId;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  disconnect(): void {
    this.gameId = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  private doConnect(): void {
    if (!this.gameId) return;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/ws`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.onConnectionChange?.(true);
      // Subscribe and request resync
      this.ws!.send(JSON.stringify({ type: 'SUBSCRIBE', gameId: this.gameId }));
      this.ws!.send(JSON.stringify({ type: 'RESYNC', gameId: this.gameId }));
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; data: unknown };
        this.handleMessage(msg);
      } catch { /* ignore malformed */ }
    };

    this.ws.onclose = (event) => {
      this.onConnectionChange?.(false);
      if (event.code === 1000 || event.code === 1001) return;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect(): void {
    if (!this.gameId) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.onDisconnected?.('Max reconnection attempts reached');
      return;
    }
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
  }

  private handleMessage(msg: { type: string; data: unknown }): void {
    switch (msg.type) {
      case 'FULL_STATE': this.onFullState?.(msg.data as PublicGameState); break;
      case 'ROUND_START': this.onRoundStart?.(msg.data as RoundData); break;
      case 'CHALLENGE': this.onChallenge?.(msg.data as ChallengeData); break;
      case 'RESPONSE': this.onResponse?.(msg.data as ResponseData); break;
      case 'ELIMINATION': this.onElimination?.(msg.data as EliminationData); break;
      case 'GAME_END': this.onGameEnd?.(msg.data as GameEndData); break;
      case 'ERROR': this.onError?.(msg.data as ErrorData); break;
    }
  }
}
