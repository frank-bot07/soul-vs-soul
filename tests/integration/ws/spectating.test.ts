import { describe, it, expect, afterEach } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { GameWebSocketServer } from '../../../src/ws/WebSocketServer.js';
import WebSocket from 'ws';

function createTestServer(): Promise<{ httpServer: HttpServer; wsServer: GameWebSocketServer; port: number; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const httpServer = createServer();
    const wsServer = new GameWebSocketServer(httpServer);
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        httpServer,
        wsServer,
        port,
        close: async () => {
          wsServer.close();
          await new Promise<void>((r) => httpServer.close(() => r()));
        },
      });
    });
  });
}

function connectWs(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.once('message', (data) => {
      resolve(JSON.parse(data.toString()));
    });
  });
}

describe('WebSocket spectating integration', () => {
  let cleanup: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }
  });

  it('full spectating flow: connect, subscribe, receive events', async () => {
    const server = await createTestServer();
    cleanup = server.close;

    const ws = await connectWs(server.port);

    // Subscribe
    const subMsg = waitForMessage(ws);
    ws.send(JSON.stringify({ type: 'SUBSCRIBE', gameId: 'test-game' }));
    const sub = await subMsg;
    expect(sub['type']).toBe('SUBSCRIBED');

    // Receive broadcast
    const eventMsg = waitForMessage(ws);
    server.wsServer.broadcast('test-game', 'CHALLENGE', {
      type: 'debate',
      description: 'Test challenge',
    });
    const event = await eventMsg;
    expect(event['type']).toBe('CHALLENGE');

    // Receive elimination
    const elimMsg = waitForMessage(ws);
    server.wsServer.broadcast('test-game', 'ELIMINATION', {
      agentId: 'agent-1',
      round: 2,
    });
    const elim = await elimMsg;
    expect(elim['type']).toBe('ELIMINATION');

    ws.close();
  });

  it('RESYNC triggers callback', async () => {
    const server = await createTestServer();
    cleanup = server.close;

    let resyncGameId = '';
    server.wsServer.onResyncRequest = (gameId, resyncWs) => {
      resyncGameId = gameId;
      resyncWs.send(JSON.stringify({
        type: 'FULL_STATE',
        data: { gameId, round: 3, agents: [], currentChallenge: null, spectatorCount: 1 },
      }));
    };

    const ws = await connectWs(server.port);

    // Subscribe first
    const subMsg = waitForMessage(ws);
    ws.send(JSON.stringify({ type: 'SUBSCRIBE', gameId: 'resync-game' }));
    await subMsg;

    // Request resync
    const resyncMsg = waitForMessage(ws);
    ws.send(JSON.stringify({ type: 'RESYNC' }));
    const state = await resyncMsg;

    expect(resyncGameId).toBe('resync-game');
    expect(state['type']).toBe('FULL_STATE');

    ws.close();
  });

  it('does not receive events from other games', async () => {
    const server = await createTestServer();
    cleanup = server.close;

    const ws = await connectWs(server.port);

    // Subscribe to game-a
    const subMsg = waitForMessage(ws);
    ws.send(JSON.stringify({ type: 'SUBSCRIBE', gameId: 'game-a' }));
    await subMsg;

    // Broadcast to game-b — should NOT arrive
    server.wsServer.broadcast('game-b', 'ROUND_START', { round: 1 });

    // Broadcast to game-a — SHOULD arrive
    const eventMsg = waitForMessage(ws);
    server.wsServer.broadcast('game-a', 'ROUND_START', { round: 1 });
    const event = await eventMsg;
    expect(event['type']).toBe('ROUND_START');

    ws.close();
  });

  it('multiple spectators receive same broadcast', async () => {
    const server = await createTestServer();
    cleanup = server.close;

    const ws1 = await connectWs(server.port);
    const ws2 = await connectWs(server.port);
    const ws3 = await connectWs(server.port);

    // All subscribe to same game
    for (const ws of [ws1, ws2, ws3]) {
      const msg = waitForMessage(ws);
      ws.send(JSON.stringify({ type: 'SUBSCRIBE', gameId: 'multi-game' }));
      await msg;
    }

    expect(server.wsServer.getSpectatorCount('multi-game')).toBe(3);

    // Broadcast
    const promises = [ws1, ws2, ws3].map((ws) => waitForMessage(ws));
    server.wsServer.broadcast('multi-game', 'GAME_END', { winner: 'agent-x' });
    const results = await Promise.all(promises);

    for (const r of results) {
      expect(r['type']).toBe('GAME_END');
    }

    ws1.close();
    ws2.close();
    ws3.close();
  });
});
