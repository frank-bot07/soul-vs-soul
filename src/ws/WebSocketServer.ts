import { WebSocketServer as WSServer, WebSocket } from 'ws';
import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { logger } from '../logger.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  gameId?: string;
  sessionId?: string;
}

export interface WSMessage {
  type: string;
  data?: unknown;
  gameId?: string;
}

export class GameWebSocketServer {
  private wss: WSServer;
  private spectators = new Map<string, Set<ExtendedWebSocket>>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(server: HttpServer) {
    this.wss = new WSServer({ server, path: '/ws' });
    this.setupConnectionHandler();
    this.startHeartbeat();
  }

  private setupConnectionHandler(): void {
    this.wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
      const extWs = ws as ExtendedWebSocket;
      extWs.isAlive = true;

      extWs.on('pong', () => {
        extWs.isAlive = true;
      });

      extWs.on('message', (raw: Buffer | string) => {
        try {
          const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString()) as WSMessage;
          this.handleMessage(extWs, msg);
        } catch {
          extWs.send(JSON.stringify({ type: 'ERROR', data: { message: 'Invalid message format' } }));
        }
      });

      extWs.on('close', () => {
        this.removeFromGame(extWs);
      });

      extWs.on('error', () => {
        this.removeFromGame(extWs);
      });
    });
  }

  private handleMessage(ws: ExtendedWebSocket, msg: WSMessage): void {
    switch (msg.type) {
      case 'SUBSCRIBE': {
        const gameId = msg.gameId;
        if (typeof gameId !== 'string' || !UUID_RE.test(gameId)) {
          ws.send(JSON.stringify({ type: 'ERROR', data: { message: 'Valid gameId (UUID) required' } }));
          return;
        }
        this.removeFromGame(ws);
        ws.gameId = gameId;
        if (!this.spectators.has(gameId)) {
          this.spectators.set(gameId, new Set());
        }
        this.spectators.get(gameId)!.add(ws);
        ws.send(JSON.stringify({ type: 'SUBSCRIBED', data: { gameId } }));
        break;
      }
      case 'UNSUBSCRIBE': {
        this.removeFromGame(ws);
        ws.send(JSON.stringify({ type: 'UNSUBSCRIBED' }));
        break;
      }
      case 'RESYNC': {
        const gameId = ws.gameId ?? msg.gameId;
        if (typeof gameId === 'string' && UUID_RE.test(gameId)) {
          // If not subscribed yet, subscribe
          if (!ws.gameId) {
            ws.gameId = gameId;
            if (!this.spectators.has(gameId)) {
              this.spectators.set(gameId, new Set());
            }
            this.spectators.get(gameId)!.add(ws);
          }
          // Emit a resync-request event; the wiring layer handles sending state
          this.onResyncRequest?.(gameId, ws);
        } else {
          ws.send(JSON.stringify({ type: 'ERROR', data: { message: 'gameId required for RESYNC' } }));
        }
        break;
      }
      default:
        ws.send(JSON.stringify({ type: 'ERROR', data: { message: `Unknown message type: ${msg.type}` } }));
    }
  }

  onResyncRequest?: (gameId: string, ws: WebSocket) => void;

  private removeFromGame(ws: ExtendedWebSocket): void {
    if (ws.gameId) {
      const set = this.spectators.get(ws.gameId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          this.spectators.delete(ws.gameId);
        }
      }
      ws.gameId = undefined;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const extWs = ws as ExtendedWebSocket;
        if (!extWs.isAlive) {
          this.removeFromGame(extWs);
          return extWs.terminate();
        }
        extWs.isAlive = false;
        extWs.ping();
      });
    }, 30_000);
  }

  broadcast(gameId: string, type: string, data: unknown): void {
    const set = this.spectators.get(gameId);
    if (!set) return;
    const msg = JSON.stringify({ type, data });
    for (const ws of set) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }

  getSpectatorCount(gameId: string): number {
    return this.spectators.get(gameId)?.size ?? 0;
  }

  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.wss.clients.forEach((ws) => {
      ws.close(1001, 'Server shutting down');
    });
    this.wss.close();
    this.spectators.clear();
    logger.info('WebSocket server closed');
  }
}
