import { describe, it, expect, afterEach } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { GameWebSocketServer } from '../../../src/ws/WebSocketServer.js';
import WebSocket from 'ws';

function createTestServer(): { httpServer: HttpServer; wsServer: GameWebSocketServer; port: number; close: () => Promise<void> } {
  const httpServer = createServer();
  const wsServer = new GameWebSocketServer(httpServer);

  return new Promise((resolve) => {
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
  }) as unknown as { httpServer: HttpServer; wsServer: GameWebSocketServer; port: number; close: () => Promise<void> };
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

describe('GameWebSocketServer', () => {
  let cleanup: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }
  });

  it('accepts connections and handles SUBSCRIBE', async () => {
    const server = await createTestServer();
    cleanup = server.close;

    const ws = await connectWs(server.port);
    const msgPromise = waitForMessage(ws);
    ws.send(JSON.stringify({ type: 'SUBSCRIBE', gameId: '00000000-0000-4000-8000-000000000001' }));
    const msg = await msgPromise;

    expect(msg['type']).toBe('SUBSCRIBED');
    expect((msg['data'] as Record<string, unknown>)['gameId']).toBe('00000000-0000-4000-8000-000000000001');
    expect(server.wsServer.getSpectatorCount('00000000-0000-4000-8000-000000000001')).toBe(1);

    ws.close();
  });

  it('handles UNSUBSCRIBE', async () => {
    const server = await createTestServer();
    cleanup = server.close;

    const ws = await connectWs(server.port);

    // Subscribe first
    let msgPromise = waitForMessage(ws);
    ws.send(JSON.stringify({ type: 'SUBSCRIBE', gameId: '00000000-0000-4000-8000-000000000002' }));
    await msgPromise;

    // Unsubscribe
    msgPromise = waitForMessage(ws);
    ws.send(JSON.stringify({ type: 'UNSUBSCRIBE' }));
    await msgPromise;

    expect(server.wsServer.getSpectatorCount('00000000-0000-4000-8000-000000000002')).toBe(0);
    ws.close();
  });

  it('broadcasts to spectators of a game', async () => {
    const server = await createTestServer();
    cleanup = server.close;

    const ws1 = await connectWs(server.port);
    const ws2 = await connectWs(server.port);

    // Subscribe both to same game
    let msg1 = waitForMessage(ws1);
    ws1.send(JSON.stringify({ type: 'SUBSCRIBE', gameId: '00000000-0000-4000-8000-000000000003' }));
    await msg1;

    let msg2 = waitForMessage(ws2);
    ws2.send(JSON.stringify({ type: 'SUBSCRIBE', gameId: '00000000-0000-4000-8000-000000000003' }));
    await msg2;

    // Broadcast
    msg1 = waitForMessage(ws1);
    msg2 = waitForMessage(ws2);
    server.wsServer.broadcast('00000000-0000-4000-8000-000000000003', 'ROUND_START', { round: 1 });

    const [r1, r2] = await Promise.all([msg1, msg2]);
    expect(r1['type']).toBe('ROUND_START');
    expect(r2['type']).toBe('ROUND_START');

    ws1.close();
    ws2.close();
  });

  it('cleans up on disconnect', async () => {
    const server = await createTestServer();
    cleanup = server.close;

    const ws = await connectWs(server.port);
    const msgPromise = waitForMessage(ws);
    ws.send(JSON.stringify({ type: 'SUBSCRIBE', gameId: '00000000-0000-4000-8000-000000000004' }));
    await msgPromise;

    expect(server.wsServer.getSpectatorCount('00000000-0000-4000-8000-000000000004')).toBe(1);

    ws.close();
    // Give time for close handler
    await new Promise((r) => setTimeout(r, 100));
    expect(server.wsServer.getSpectatorCount('00000000-0000-4000-8000-000000000004')).toBe(0);
  });

  it('rejects invalid messages', async () => {
    const server = await createTestServer();
    cleanup = server.close;

    const ws = await connectWs(server.port);
    const msgPromise = waitForMessage(ws);
    ws.send('not json!!!');
    const msg = await msgPromise;

    expect(msg['type']).toBe('ERROR');
    ws.close();
  });
});
