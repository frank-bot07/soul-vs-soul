import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import type { Express } from 'express';

// Lightweight supertest alternative using native fetch isn't great here.
// We'll test by calling the handler directly.
describe('Health endpoint', () => {
  let app: Express;

  it('GET /healthz returns 200', async () => {
    app = createApp();

    // Use node's built-in test approach: start server, fetch, stop
    const server = app.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;

    try {
      const res = await fetch(`http://localhost:${port}/healthz`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.status).toBe('ok');
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('timestamp');
    } finally {
      server.close();
    }
  });
});
