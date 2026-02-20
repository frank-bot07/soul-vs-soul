import type { Express } from 'express';

/** Lightweight test request helper that starts a server, makes a request, returns structured result */
export async function request(app: Express, method: string, path: string, body?: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const server = app.listen(0);
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;

  try {
    const opts: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`http://localhost:${port}${path}`, opts);
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try { json = JSON.parse(text) as Record<string, unknown>; } catch { /* empty */ }
    return { status: res.status, body: json };
  } finally {
    server.close();
  }
}
