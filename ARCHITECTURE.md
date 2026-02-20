# Soul vs Soul — Architecture Document

> **Version:** 1.0.0 | **Date:** 2026-02-19 | **Status:** Pre-Implementation  
> **Directive:** "Slow perfect code = fast. We get ONE shot at first impressions."

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Security Architecture](#2-security-architecture)
3. [Backend Architecture](#3-backend-architecture)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Data Layer](#5-data-layer)
6. [Game Engine Design](#6-game-engine-design)
7. [API Design](#7-api-design)
8. [Deployment & Infrastructure](#8-deployment--infrastructure)
9. [Monetization Architecture](#9-monetization-architecture)
10. [Testing Strategy](#10-testing-strategy)
11. [Scalability Roadmap](#11-scalability-roadmap)
12. [Development Phases](#12-development-phases)
13. [Code Review Issue Resolution Map](#13-code-review-issue-resolution-map)

---

## 1. System Overview

### 1.1 High-Level Architecture

```
                         ┌─────────────────────────────────┐
                         │          CDN (Cloudflare)        │
                         │   Static assets, edge caching    │
                         └──────────────┬──────────────────┘
                                        │
                         ┌──────────────▼──────────────────┐
                         │      Reverse Proxy (Caddy)       │
                         │   TLS termination, rate limit     │
                         └──────┬───────────────┬──────────┘
                                │               │
                    ┌───────────▼───┐   ┌───────▼──────────┐
                    │  Express API  │   │  WebSocket Server │
                    │  (REST + Auth)│   │  (ws library)     │
                    └───────┬───────┘   └───────┬──────────┘
                            │                   │
                    ┌───────▼───────────────────▼──────────┐
                    │           Game Engine Core            │
                    │     (EventEmitter, pure logic)        │
                    └───────┬──────────────────┬───────────┘
                            │                  │
                 ┌──────────▼──────┐  ┌────────▼──────────┐
                 │  LLM Gateway    │  │   SQLite (better-  │
                 │  (timeout+retry │  │   sqlite3-multiple)│
                 │   +circuit brk) │  │                    │
                 └──────────┬──────┘  └───────────────────┘
                            │
              ┌─────────────▼─────────────────┐
              │   LLM Providers (OpenAI, etc.) │
              └───────────────────────────────┘
```

### 1.2 Component Breakdown

| Component | Responsibility |
|-----------|---------------|
| **CDN (Cloudflare)** | Static asset delivery, DDoS protection, edge caching |
| **Reverse Proxy (Caddy)** | TLS, rate limiting, request routing |
| **Express API** | REST endpoints, authentication, input validation |
| **WebSocket Server** | Real-time game spectating, state broadcasts |
| **Game Engine** | Pure game logic via EventEmitter — zero I/O coupling |
| **LLM Gateway** | Manages all LLM API calls with timeout/retry/circuit breaker |
| **SQLite** | Game state, agents, leaderboards, replays |

### 1.3 Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Runtime** | Node.js 22 LTS | Async-native, WebSocket-friendly, team familiarity |
| **Framework** | Express 5 | Stable, minimal, async error handling built-in |
| **WebSocket** | `ws` | Lightweight, no Socket.IO bloat, protocol control |
| **Database** | SQLite via `better-sqlite3-multiple` | Zero-ops, single-file, WAL mode handles concurrent reads. Sufficient for single-server launch. Migration path to PostgreSQL when needed. |
| **Validation** | Zod | TypeScript-first, composable schemas, great errors |
| **Frontend** | Vanilla JS + Web Components | Zero build step, fast iteration, no framework churn. Lit for Web Components if complexity warrants. |
| **CSS** | Vanilla CSS with custom properties | Mobile-first, no preprocessor needed for this scale |
| **Bundler** | esbuild | Fast, simple, handles JS/CSS bundling |
| **Testing** | Vitest | Fast, ESM-native, compatible with Node |
| **Containerization** | Docker | Reproducible builds, Railway-native |
| **Deployment** | Railway | Simple, auto-deploy from Git, WebSocket support |
| **TLS** | Caddy (dev) / Cloudflare (prod) | Auto HTTPS with zero config |
| **Language** | TypeScript (strict) | Catches bugs at compile time, self-documenting |

**Why not PostgreSQL from Day 1?** SQLite with WAL mode handles thousands of concurrent readers and sequential writes — more than enough for launch. It eliminates an entire service dependency, reduces cost to $0, and simplifies deployment. We migrate when we need horizontal scaling or concurrent write throughput.

**Why not React/Vue/Svelte?** The UI is fundamentally a spectator view with tiles and animations. Web Components + vanilla JS keeps the bundle tiny (<50KB), eliminates build complexity, and removes framework lock-in. If the UI grows complex enough, we add Lit (2KB overhead) rather than a full framework.

---

## 2. Security Architecture

> **Fixes issues:** #1 (no auth), #2 (path traversal), #3 (XSS), #4 (secret leaks), #5 (CORS), #6 (temp file leaks), #10 (no validation)

### 2.1 Authentication Strategy

**Three tiers, zero friction:**

```
┌─────────────────────────────────────────────────────────┐
│                  Authentication Tiers                     │
├──────────────┬──────────────────┬────────────────────────┤
│   Casual     │   Enthusiast     │   Power User / API     │
│  (anonymous) │  (session)       │   (API key)            │
├──────────────┼──────────────────┼────────────────────────┤
│ No login     │ Optional account │ API key in header      │
│ Session      │ Email magic link │ Bearer token auth      │
│ cookie auto- │ or OAuth (X)     │ Scoped permissions     │
│ assigned     │ Session persists │ Rate limited per key   │
│              │ across devices   │                        │
└──────────────┴──────────────────┴────────────────────────┘
```

**Session implementation:**
- Every visitor gets a cryptographically random session ID via `HttpOnly; Secure; SameSite=Strict` cookie
- Sessions stored server-side in SQLite with TTL (24h anonymous, 30d authenticated)
- Session ID: `crypto.randomUUID()` — no sequential IDs, no guessable tokens
- Anonymous sessions can be "upgraded" to authenticated without data loss

**API key implementation:**
- Generated via authenticated account settings
- Format: `svs_live_<32 random bytes hex>` (prefix for easy identification)
- Stored as bcrypt hash — raw key shown once at creation
- Scoped: `games:create`, `games:read`, `agents:manage`
- Sent via `Authorization: Bearer svs_live_...` header

### 2.2 Input Validation & Sanitization

**Server-side (Zod schemas on every endpoint):**

```typescript
// Every request validated before touching business logic
const CreateGameSchema = z.object({
  agents: z.array(z.string().uuid()).min(2).max(16),
  mode: z.enum(['elimination', 'round-robin']),
  visibility: z.enum(['public', 'private']).default('public'),
});

// Agent upload validation
const AgentUploadSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[\w\s\-'.]+$/),
  personality: z.string().min(10).max(5000),
});
```

**Validation middleware:**

```typescript
function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: result.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    req.validated = result.data;
    next();
  };
}
```

**Client-side:** Zod schemas shared via `/shared/schemas.ts` — validated on both sides, server is authoritative.

**File upload validation (agent .md files):**
- Max size: 10KB
- Content-type must be `text/markdown` or `text/plain`
- Filename sanitized: strip path separators, limit to `[a-zA-Z0-9_-]`
- Files stored by UUID, never by user-supplied name — **eliminates path traversal** (#2)
- Content scanned for script tags and HTML (stripped, personality text only)

### 2.3 Path Traversal Prevention (#2)

```typescript
// NEVER construct paths from user input
// Agents stored by UUID:
// /data/agents/{uuid}.json — metadata
// /data/agents/{uuid}.md — personality file

function agentPath(agentId: string): string {
  // Validate UUID format first
  const parsed = z.string().uuid().safeParse(agentId);
  if (!parsed.success) throw new ValidationError('Invalid agent ID');
  
  const resolved = path.resolve(AGENTS_DIR, `${parsed.data}.json`);
  // Belt-and-suspenders: verify resolved path is within AGENTS_DIR
  if (!resolved.startsWith(path.resolve(AGENTS_DIR))) {
    throw new SecurityError('Path traversal attempt');
  }
  return resolved;
}
```

### 2.4 CORS Policy (#5)

```typescript
const corsOptions = {
  origin: [
    'https://soulvssoul.com',
    'https://www.soulvssoul.com',
    // Dev only, stripped in production:
    ...(isDev ? ['http://localhost:3000'] : []),
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // 24h preflight cache
};
```

**No wildcards. Ever.** Development uses explicit localhost origin.

### 2.5 Rate Limiting

```
┌──────────────────────────────────────────────────┐
│              Rate Limiting Layers                  │
├────────────────┬─────────────────────────────────┤
│ Cloudflare     │ DDoS protection, bot filtering   │
│ Caddy          │ Connection rate per IP            │
│ Express        │ Per-endpoint limits (in-memory)   │
└────────────────┴─────────────────────────────────┘
```

**Express rate limits (using `express-rate-limit` with memory store):**

| Endpoint Pattern | Window | Max Requests |
|-----------------|--------|-------------|
| `POST /api/games` | 1 min | 5 |
| `POST /api/agents` | 1 min | 10 |
| `GET /api/*` | 1 min | 60 |
| `POST /api/auth/*` | 15 min | 10 |
| WebSocket connect | 1 min | 5 per IP |

When we scale past single-server, rate limit store moves to Redis.

### 2.6 Content Security Policy

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' wss://soulvssoul.com;
  font-src 'self';
  object-src 'none';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

**No `unsafe-eval`. No `unsafe-inline` for scripts.** All JS loaded from files.

Additional headers:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 2.7 WebSocket Data Sanitization (#4)

**The golden rule: game state broadcasts NEVER include:**
- System prompts
- API keys
- Internal agent IDs (use display IDs)
- Raw LLM responses (only parsed/scored results)
- Server-side metadata (file paths, internal state)

```typescript
// Sanitization layer between engine and broadcast
function sanitizeGameState(state: InternalGameState): PublicGameState {
  return {
    gameId: state.gameId,
    round: state.currentRound,
    phase: state.phase,
    agents: state.agents.map(a => ({
      displayId: a.displayId,
      name: a.name,
      avatar: a.avatar,
      score: a.score,
      eliminated: a.eliminated,
    })),
    currentChallenge: state.currentChallenge ? {
      type: state.currentChallenge.type,
      description: state.currentChallenge.publicDescription,
      responses: state.currentChallenge.responses?.map(r => ({
        agentDisplayId: r.agentDisplayId,
        response: r.sanitizedResponse, // No raw LLM output
        score: r.normalizedScore,
      })),
    } : null,
    spectatorCount: state.spectators.size,
    startedAt: state.startedAt,
  };
}
```

### 2.8 HTTPS/TLS

- **Production:** Cloudflare handles TLS termination → origin uses Cloudflare tunnel or origin certificate
- **Development:** Caddy auto-generates local TLS via ACME
- **WebSocket:** `wss://` only in production, enforced by CSP `connect-src`
- **HSTS preload** submitted after launch stabilization

---

## 3. Backend Architecture

> **Fixes issues:** #7 (race conditions), #8 (memory leak), #9 (sync I/O), #10 (validation), #11 (monkey-patching), #13 (no timeouts), #14 (no retry)

### 3.1 Project Structure

```
src/
├── server.ts                 # Entry point, graceful startup/shutdown
├── config.ts                 # Environment config with Zod validation
├── app.ts                    # Express app factory (testable)
│
├── middleware/
│   ├── auth.ts               # Session + API key authentication
│   ├── validate.ts           # Zod validation middleware
│   ├── rateLimit.ts          # Rate limiting config
│   ├── security.ts           # Helmet, CORS, CSP headers
│   └── errorHandler.ts       # Global error handler
│
├── routes/
│   ├── games.ts              # Game CRUD + lifecycle
│   ├── agents.ts             # Agent upload + management
│   ├── auth.ts               # Session + account management
│   └── health.ts             # Health check endpoint
│
├── engine/
│   ├── GameEngine.ts         # EventEmitter-based core
│   ├── ChallengeRegistry.ts  # Pluggable challenge system
│   ├── challenges/
│   │   ├── debate.ts
│   │   ├── strategy.ts
│   │   ├── creative.ts
│   │   └── trivia.ts
│   ├── Scorer.ts             # Normalized 0-100 scoring
│   ├── Pairing.ts            # Fair pairing (handles odd counts)
│   └── types.ts              # Engine type definitions
│
├── services/
│   ├── LLMGateway.ts         # Timeout + retry + circuit breaker
│   ├── AgentService.ts       # Agent CRUD with validation
│   ├── GameService.ts        # Game lifecycle management
│   └── ReplayService.ts      # Replay recording + playback
│
├── ws/
│   ├── WebSocketServer.ts    # Connection management
│   ├── handlers.ts           # Message handlers
│   └── sanitize.ts           # State sanitization for broadcast
│
├── db/
│   ├── index.ts              # Database connection + migrations
│   ├── migrations/           # Versioned SQL migrations
│   └── queries/              # Prepared statement modules
│
└── shared/
    ├── schemas.ts            # Zod schemas (shared with frontend)
    ├── types.ts              # Shared TypeScript types
    └── constants.ts          # Shared constants
```

### 3.2 Express App Structure

```typescript
// app.ts — factory for testability
export function createApp(deps: AppDependencies): Express {
  const app = express();

  // Security middleware (order matters)
  app.use(helmet(helmetConfig));
  app.use(cors(corsOptions));
  app.use(securityHeaders);

  // Parsing
  app.use(express.json({ limit: '100kb' }));

  // Session
  app.use(sessionMiddleware);

  // Rate limiting
  app.use('/api/', globalRateLimit);

  // Routes
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRateLimit, authRoutes(deps));
  app.use('/api/games', authenticate, gameRoutes(deps));
  app.use('/api/agents', authenticate, agentRoutes(deps));

  // Static (production only — dev uses separate server)
  if (config.NODE_ENV === 'production') {
    app.use(express.static('dist/public', { maxAge: '1y', immutable: true }));
    app.get('*', (req, res) => res.sendFile('dist/public/index.html'));
  }

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
```

### 3.3 Game State Management & Race Conditions (#7)

```typescript
class GameService {
  // Mutex per game to prevent race conditions
  private locks = new Map<string, Promise<void>>();

  async startGame(gameId: string): Promise<void> {
    await this.withLock(gameId, async () => {
      const game = await this.db.getGame(gameId);
      if (game.status !== 'pending') {
        throw new ConflictError('Game already started');
      }
      // Atomic status update
      await this.db.updateGameStatus(gameId, 'running');
      this.engine.start(gameId);
    });
  }

  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Queue sequential execution per game
    const prev = this.locks.get(key) ?? Promise.resolve();
    const current = prev.then(fn, fn); // Run after previous completes
    this.locks.set(key, current.then(() => {}, () => {}));
    try {
      return await current;
    } finally {
      // Clean up if nothing else queued
      if (this.locks.get(key) === current) {
        this.locks.delete(key);
      }
    }
  }
}
```

### 3.4 Memory Management (#8)

**Game log bounded buffer:**

```typescript
class BoundedLog {
  private entries: LogEntry[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  append(entry: LogEntry): void {
    if (this.entries.length >= this.maxEntries) {
      // Flush oldest 25% to disk, keep recent 75%
      const flushCount = Math.floor(this.maxEntries * 0.25);
      this.flushToDisk(this.entries.slice(0, flushCount));
      this.entries = this.entries.slice(flushCount);
    }
    this.entries.push(entry);
  }

  private async flushToDisk(entries: LogEntry[]): Promise<void> {
    // Append to replay log in SQLite
    await this.db.appendReplayEntries(this.gameId, entries);
  }
}
```

**WebSocket connection cleanup:**

```typescript
// Automatic cleanup on disconnect
wsServer.on('connection', (ws, req) => {
  const sessionId = extractSession(req);
  
  ws.on('close', () => {
    spectatorManager.remove(sessionId);
    // No dangling references
  });

  // Heartbeat to detect dead connections
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});

// Sweep dead connections every 30s
setInterval(() => {
  wsServer.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30_000);
```

### 3.5 Async File I/O (#9)

**Rule: Zero synchronous I/O outside of startup config loading.**

```typescript
// ❌ NEVER
const data = fs.readFileSync(path);

// ✅ ALWAYS
const data = await fs.promises.readFile(path);

// For agent files — but prefer SQLite for most data.
// File I/O only for: static assets, uploaded .md files (written once, read via SQLite blob)
```

**ESLint rule to enforce:**
```json
{
  "no-restricted-properties": [
    "error",
    { "object": "fs", "property": "readFileSync" },
    { "object": "fs", "property": "writeFileSync" },
    { "object": "fs", "property": "mkdirSync" }
  ]
}
```

### 3.6 LLM Gateway (#13, #14)

```typescript
class LLMGateway {
  private circuitBreaker: CircuitBreaker;

  constructor(private config: LLMConfig) {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,     // 5 failures → open
      resetTimeoutMs: 30_000,  // Try again after 30s
      monitorWindowMs: 60_000, // Rolling 1-minute window
    });
  }

  async query(prompt: string, agentConfig: AgentLLMConfig): Promise<string> {
    return this.circuitBreaker.execute(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.config.timeoutMs // Default: 15s
      );

      try {
        return await this.callWithRetry(prompt, agentConfig, controller.signal);
      } finally {
        clearTimeout(timeout);
      }
    });
  }

  private async callWithRetry(
    prompt: string,
    config: AgentLLMConfig,
    signal: AbortSignal,
    attempt = 0
  ): Promise<string> {
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: config.systemPrompt },
            { role: 'user', content: prompt },
          ],
          max_tokens: 500,
          temperature: 0.8,
        }),
        signal,
      });

      if (!response.ok) {
        throw new LLMError(`HTTP ${response.status}`, response.status);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err) {
      if (attempt < this.config.maxRetries && this.isRetryable(err)) {
        const delay = Math.min(1000 * 2 ** attempt, 8000); // Exponential backoff, cap 8s
        await new Promise(r => setTimeout(r, delay));
        return this.callWithRetry(prompt, config, signal, attempt + 1);
      }
      throw err;
    }
  }

  private isRetryable(err: unknown): boolean {
    if (err instanceof LLMError) {
      return [429, 500, 502, 503].includes(err.statusCode);
    }
    return err instanceof TypeError; // Network error
  }
}
```

**Circuit breaker states:**
```
CLOSED → (failures >= threshold) → OPEN → (after resetTimeout) → HALF_OPEN
  ↑                                                                    │
  └────────────── (success in half-open) ──────────────────────────────┘
```

### 3.7 Temp File Management (#6)

```typescript
// No temp files for game operations — everything in memory + SQLite.
// Agent uploads: stream directly to SQLite blob, never to filesystem.

// For any case where temp files ARE needed:
class TempFileManager {
  private tracked = new Set<string>();

  async create(prefix: string): Promise<{ path: string; cleanup: () => Promise<void> }> {
    const tmpPath = path.join(os.tmpdir(), `svs-${prefix}-${crypto.randomUUID()}`);
    this.tracked.add(tmpPath);
    return {
      path: tmpPath,
      cleanup: async () => {
        await fs.promises.unlink(tmpPath).catch(() => {});
        this.tracked.delete(tmpPath);
      },
    };
  }

  // Called on graceful shutdown
  async cleanupAll(): Promise<void> {
    await Promise.all(
      [...this.tracked].map(p => fs.promises.unlink(p).catch(() => {}))
    );
    this.tracked.clear();
  }
}
```

### 3.8 Error Handling

```typescript
// Centralized error hierarchy
class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public isOperational = true
  ) {
    super(message);
  }
}

class ValidationError extends AppError {
  constructor(message: string) { super(message, 400, 'VALIDATION_ERROR'); }
}
class AuthError extends AppError {
  constructor(message = 'Unauthorized') { super(message, 401, 'AUTH_ERROR'); }
}
class NotFoundError extends AppError {
  constructor(resource: string) { super(`${resource} not found`, 404, 'NOT_FOUND'); }
}
class ConflictError extends AppError {
  constructor(message: string) { super(message, 409, 'CONFLICT'); }
}
class RateLimitError extends AppError {
  constructor() { super('Too many requests', 429, 'RATE_LIMITED'); }
}

// Global error handler
function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError && err.isOperational) {
    logger.warn({ err, path: req.path }, 'Operational error');
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
  }

  // Unexpected errors — log full details, return generic message
  logger.error({ err, path: req.path }, 'Unexpected error');
  return res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
}
```

### 3.9 Graceful Shutdown

```typescript
// server.ts
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown initiated');

  // 1. Stop accepting new connections
  httpServer.close();

  // 2. Close WebSocket connections with close frame
  wsServer.clients.forEach(ws => {
    ws.close(1001, 'Server shutting down');
  });

  // 3. Wait for in-flight games to reach checkpoint (max 10s)
  await gameService.checkpointAll({ timeoutMs: 10_000 });

  // 4. Clean up temp files
  await tempFileManager.cleanupAll();

  // 5. Close database
  db.close();

  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled errors — log and exit
process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'Unhandled rejection');
  shutdown('unhandledRejection');
});
```

---

## 4. Frontend Architecture

> **Fixes issues:** #3 (XSS via innerHTML)

### 4.1 Safe DOM Manipulation (#3)

**Absolute rule: `innerHTML` is banned.** Enforced by ESLint.

```typescript
// ❌ BANNED — XSS vector
element.innerHTML = userContent;

// ✅ Safe text content
element.textContent = userContent;

// ✅ Safe element creation
function h(tag: string, attrs: Record<string, string>, ...children: (string | Node)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  for (const child of children) {
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

// Usage:
const card = h('div', { class: 'agent-card' },
  h('h3', {}, agent.name),          // Automatically escaped
  h('p', {}, agent.personality),     // Automatically escaped
  h('span', { class: 'score' }, `Score: ${agent.score}`)
);
```

**ESLint enforcement:**
```json
{
  "no-restricted-properties": [
    "error",
    { "property": "innerHTML", "message": "Use textContent or DOM API. innerHTML is banned (XSS)." },
    { "property": "outerHTML", "message": "Use DOM API. outerHTML is banned (XSS)." }
  ],
  "no-restricted-methods": [
    "error",
    { "name": "document.write", "message": "Banned (XSS vector)." }
  ]
}
```

### 4.2 Component Structure

```
public/
├── index.html                # Shell — minimal HTML, no inline scripts
├── css/
│   ├── reset.css             # Normalize
│   ├── tokens.css            # Design tokens (colors, spacing, type scale)
│   ├── layout.css            # Grid/flex utilities
│   └── components/
│       ├── agent-tile.css
│       ├── game-arena.css
│       ├── scoreboard.css
│       └── share-card.css
├── js/
│   ├── main.ts               # Entry point, router
│   ├── dom.ts                # Safe DOM helpers (h(), render(), etc.)
│   ├── ws.ts                 # WebSocket client with reconnection
│   ├── state.ts              # Client state management
│   ├── router.ts             # Simple hash-based SPA router
│   ├── components/
│   │   ├── AgentPicker.ts    # Tile grid for agent selection
│   │   ├── GameArena.ts      # Live game view
│   │   ├── Scoreboard.ts     # Scores + elimination brackets
│   │   ├── ChallengeView.ts  # Active challenge display
│   │   ├── ShareCard.ts      # X share card generator
│   │   └── UploadForm.ts     # Agent .md upload
│   └── lib/
│       ├── api.ts            # REST API client
│       └── sanitize.ts       # Client-side content sanitization
└── assets/
    ├── icons/                # SVG icons
    └── sounds/               # Game event sounds (optional)
```

### 4.3 WebSocket Reconnection

```typescript
class GameSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private gameId: string | null = null;

  connect(gameId: string): void {
    this.gameId = gameId;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  private doConnect(): void {
    const url = `${WS_URL}/games/${this.gameId}/spectate`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      // Request full state resync on connect/reconnect
      this.ws!.send(JSON.stringify({ type: 'RESYNC' }));
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.handleMessage(msg);
    };

    this.ws.onclose = (event) => {
      if (event.code === 1000 || event.code === 1001) return; // Normal close
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.onDisconnected?.('Max reconnection attempts reached');
      return;
    }
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    this.reconnectAttempts++;
    setTimeout(() => this.doConnect(), delay);
  }

  private handleMessage(msg: WSMessage): void {
    switch (msg.type) {
      case 'FULL_STATE':    this.onFullState?.(msg.data); break;
      case 'ROUND_START':   this.onRoundStart?.(msg.data); break;
      case 'CHALLENGE':     this.onChallenge?.(msg.data); break;
      case 'RESPONSE':      this.onResponse?.(msg.data); break;
      case 'ELIMINATION':   this.onElimination?.(msg.data); break;
      case 'GAME_END':      this.onGameEnd?.(msg.data); break;
      case 'ERROR':         this.onError?.(msg.data); break;
    }
  }

  // Event callbacks set by components
  onFullState?: (state: PublicGameState) => void;
  onRoundStart?: (data: RoundData) => void;
  onChallenge?: (data: ChallengeData) => void;
  onResponse?: (data: ResponseData) => void;
  onElimination?: (data: EliminationData) => void;
  onGameEnd?: (data: GameEndData) => void;
  onError?: (data: ErrorData) => void;
  onDisconnected?: (reason: string) => void;
}
```

### 4.4 Mobile-First Design

```css
/* tokens.css — mobile-first breakpoints */
:root {
  /* Type scale (mobile) */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;

  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;

  /* Colors — dark theme (esports feel) */
  --bg-primary: #0a0a0f;
  --bg-secondary: #12121a;
  --bg-card: #1a1a2e;
  --text-primary: #e0e0e0;
  --text-secondary: #8888aa;
  --accent-primary: #6c5ce7;
  --accent-win: #00e676;
  --accent-lose: #ff5252;
  --accent-gold: #ffd700;

  /* Touch targets — minimum 44px */
  --touch-min: 44px;
}

/* Agent tile grid — mobile first */
.agent-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
  padding: var(--space-4);
}

@media (min-width: 640px) {
  .agent-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1024px) {
  .agent-grid {
    grid-template-columns: repeat(4, 1fr);
    max-width: 1200px;
    margin: 0 auto;
  }
}

/* Touch-friendly buttons */
.btn {
  min-height: var(--touch-min);
  min-width: var(--touch-min);
  padding: var(--space-3) var(--space-6);
  font-size: var(--text-base);
  border-radius: 8px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
```

### 4.5 Accessibility

- **Semantic HTML:** `<main>`, `<nav>`, `<article>`, `<button>` (not div-with-onclick)
- **ARIA labels:** All interactive elements have accessible names
- **Focus management:** Visible focus rings, skip-to-content link
- **Color contrast:** Minimum 4.5:1 ratio (WCAG AA)
- **Reduced motion:** `prefers-reduced-motion` media query disables animations
- **Screen reader announcements:** Live regions (`aria-live="polite"`) for game events
- **Keyboard navigation:** Full keyboard support for game setup and navigation

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 5. Data Layer

### 5.1 SQLite Schema

```sql
-- Enable WAL mode for concurrent reads
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Sessions
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                    -- crypto.randomUUID()
  user_id TEXT REFERENCES users(id),      -- NULL for anonymous
  data TEXT NOT NULL DEFAULT '{}',        -- JSON session data
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT
);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Users (optional accounts)
CREATE TABLE users (
  id TEXT PRIMARY KEY,                    -- UUID
  email TEXT UNIQUE,
  display_name TEXT NOT NULL,
  auth_provider TEXT,                     -- 'magic_link', 'x_oauth'
  api_key_hash TEXT,                      -- bcrypt hash of API key
  api_key_prefix TEXT,                    -- First 8 chars for identification
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Agents
CREATE TABLE agents (
  id TEXT PRIMARY KEY,                    -- UUID
  display_id TEXT NOT NULL UNIQUE,        -- Short public ID (e.g., "agent_a3x9")
  name TEXT NOT NULL,
  personality TEXT NOT NULL,              -- Markdown content (the soul)
  system_prompt TEXT NOT NULL,            -- Generated from personality (NEVER exposed)
  avatar_seed TEXT NOT NULL,              -- For deterministic avatar generation
  is_preset INTEGER NOT NULL DEFAULT 0,  -- Built-in personality tile
  creator_session TEXT,                   -- Session that created it
  creator_user TEXT REFERENCES users(id),
  play_count INTEGER NOT NULL DEFAULT 0,
  win_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_agents_preset ON agents(is_preset) WHERE is_preset = 1;
CREATE INDEX idx_agents_creator ON agents(creator_session);

-- Games
CREATE TABLE games (
  id TEXT PRIMARY KEY,                    -- UUID
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'cancelled')),
  mode TEXT NOT NULL CHECK (mode IN ('elimination', 'round_robin')),
  visibility TEXT NOT NULL DEFAULT 'public',
  current_round INTEGER NOT NULL DEFAULT 0,
  total_rounds INTEGER,
  winner_agent_id TEXT REFERENCES agents(id),
  creator_session TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',      -- JSON game config
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_created ON games(created_at DESC);

-- Game-Agent junction
CREATE TABLE game_agents (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  final_score REAL,
  eliminated_round INTEGER,
  placement INTEGER,
  PRIMARY KEY (game_id, agent_id)
);

-- Replay events (append-only log)
CREATE TABLE replay_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,              -- Ordering within game
  event_type TEXT NOT NULL,
  data TEXT NOT NULL,                     -- JSON event data (sanitized)
  timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(game_id, sequence)
);
CREATE INDEX idx_replay_game ON replay_events(game_id, sequence);

-- Leaderboard (materialized from game results)
CREATE TABLE leaderboard (
  agent_id TEXT PRIMARY KEY REFERENCES agents(id),
  total_games INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_score REAL NOT NULL DEFAULT 0,
  elo_rating REAL NOT NULL DEFAULT 1000,
  last_played_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_leaderboard_elo ON leaderboard(elo_rating DESC);

-- Rate limit tracking (for in-app rate limiting)
CREATE TABLE rate_limits (
  key TEXT NOT NULL,                      -- "ip:{ip}:{endpoint}" or "session:{id}:{endpoint}"
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);
```

### 5.2 Migration System

```typescript
// db/migrations are numbered SQL files
// 001_initial.sql, 002_add_elo.sql, etc.

class Migrator {
  async migrate(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    const applied = new Set(
      this.db.prepare('SELECT name FROM migrations').all().map(r => r.name)
    );

    const pending = this.getMigrationFiles().filter(f => !applied.has(f.name));

    for (const migration of pending) {
      this.db.transaction(() => {
        this.db.exec(migration.sql);
        this.db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
      })();
      logger.info({ migration: migration.name }, 'Applied migration');
    }
  }
}
```

### 5.3 Agent Storage & Isolation

- Agents stored in SQLite, not filesystem
- Each agent has a UUID (`id`) and a short display ID (`display_id`) for public use
- System prompts stored in DB but **never** included in API responses or WS broadcasts
- Personality text (the user-uploaded .md content) is public
- BYOK API keys stored encrypted at rest (AES-256-GCM with server key)

```typescript
// Agent query — NEVER returns system_prompt or API key
const PUBLIC_AGENT_FIELDS = 'id, display_id, name, personality, avatar_seed, play_count, win_count, created_at';

class AgentQueries {
  getPublic(id: string) {
    return this.db.prepare(
      `SELECT ${PUBLIC_AGENT_FIELDS} FROM agents WHERE id = ?`
    ).get(id);
  }

  // Only used internally by game engine
  getInternal(id: string) {
    return this.db.prepare(
      'SELECT * FROM agents WHERE id = ?'
    ).get(id);
  }
}
```

---

## 6. Game Engine Design

> **Fixes issues:** #11 (monkey-patching), #12 (scoring bugs/odd agents)

### 6.1 EventEmitter Architecture (#11)

```typescript
// Pure game logic — no I/O, no HTTP, no WebSocket
// All side effects happen via event listeners registered externally

type GameEvents = {
  'game:start': { gameId: string; agents: PublicAgent[]; rounds: number };
  'round:start': { gameId: string; round: number; matchups: Matchup[] };
  'challenge:start': { gameId: string; challenge: ChallengeInfo };
  'agent:query': { gameId: string; agentId: string; prompt: string };
  'agent:response': { gameId: string; agentId: string; response: string; score: number };
  'round:end': { gameId: string; round: number; results: RoundResult[] };
  'elimination': { gameId: string; agentId: string; round: number };
  'game:end': { gameId: string; winner: PublicAgent; finalStandings: Standing[] };
  'game:error': { gameId: string; error: string };
};

class GameEngine extends TypedEventEmitter<GameEvents> {
  private games = new Map<string, GameState>();

  constructor(
    private challengeRegistry: ChallengeRegistry,
    private llmGateway: LLMGateway,
  ) {
    super();
  }

  async runGame(gameId: string, agents: Agent[], config: GameConfig): Promise<void> {
    const state: GameState = {
      gameId,
      agents: agents.map(a => ({ ...a, score: 0, eliminated: false })),
      currentRound: 0,
      config,
    };
    this.games.set(gameId, state);

    this.emit('game:start', {
      gameId,
      agents: agents.map(toPublicAgent),
      rounds: this.calculateRounds(agents.length),
    });

    try {
      while (this.getActiveAgents(state).length > 1) {
        await this.runRound(state);
      }

      const winner = this.getActiveAgents(state)[0];
      this.emit('game:end', {
        gameId,
        winner: toPublicAgent(winner),
        finalStandings: this.calculateStandings(state),
      });
    } catch (err) {
      this.emit('game:error', { gameId, error: String(err) });
    } finally {
      this.games.delete(gameId);
    }
  }

  // ...
}
```

**No monkey-patching.** The engine is a pure EventEmitter. External systems (WebSocket broadcaster, replay recorder, DB updater) register listeners. The engine never knows about them.

```typescript
// Wiring happens at composition root (server.ts)
const engine = new GameEngine(challengeRegistry, llmGateway);

// WebSocket broadcasts
engine.on('round:start', (data) => wsBroadcaster.broadcast(data.gameId, 'ROUND_START', data));
engine.on('agent:response', (data) => wsBroadcaster.broadcast(data.gameId, 'RESPONSE', data));
engine.on('elimination', (data) => wsBroadcaster.broadcast(data.gameId, 'ELIMINATION', data));
engine.on('game:end', (data) => wsBroadcaster.broadcast(data.gameId, 'GAME_END', data));

// Replay recording
engine.on('round:start', (data) => replayService.record(data.gameId, 'round:start', data));
engine.on('agent:response', (data) => replayService.record(data.gameId, 'agent:response', data));
// ... etc

// Leaderboard updates
engine.on('game:end', (data) => leaderboardService.updateFromGame(data));
```

### 6.2 Challenge System (#12)

```typescript
interface Challenge {
  readonly type: string;
  readonly description: string;
  readonly publicDescription: string; // Safe for broadcast

  generatePrompt(context: ChallengeContext): string;
  scoreResponse(response: string, context: ChallengeContext): Promise<NormalizedScore>;
}

// Score is ALWAYS 0-100, clamped and normalized
class NormalizedScore {
  readonly value: number;

  constructor(raw: number) {
    // Clamp to 0-100 — impossible to exceed (#12)
    this.value = Math.max(0, Math.min(100, Math.round(raw)));
  }
}

class ChallengeRegistry {
  private challenges = new Map<string, Challenge>();

  register(challenge: Challenge): void {
    this.challenges.set(challenge.type, challenge);
  }

  getRandom(): Challenge {
    const types = [...this.challenges.values()];
    return types[Math.floor(Math.random() * types.length)];
  }
}
```

**Strategy challenge scoring fix (#12):**

```typescript
class StrategyChallenge implements Challenge {
  async scoreResponse(response: string, context: ChallengeContext): Promise<NormalizedScore> {
    // Use LLM-as-judge with structured output
    const evaluation = await this.llm.query(
      SCORING_PROMPT.replace('{response}', response).replace('{criteria}', context.criteria),
      JUDGE_CONFIG
    );

    const parsed = ScoreSchema.safeParse(JSON.parse(evaluation));
    if (!parsed.success) {
      // Fallback: assign median score rather than skip or error
      return new NormalizedScore(50);
    }

    // parsed.data.score is already validated by Zod as 0-100 integer
    return new NormalizedScore(parsed.data.score);
  }
}

const ScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  reasoning: z.string(),
});
```

### 6.3 Fair Pairing (#12 — odd agents)

```typescript
class PairingManager {
  /**
   * Creates fair matchups. If odd number of agents, one gets a BYE
   * (rotated so no agent gets consecutive BYEs).
   */
  createMatchups(agents: ActiveAgent[], round: number): Matchup[] {
    const active = agents.filter(a => !a.eliminated);

    if (active.length < 2) return [];

    // Shuffle for fairness
    const shuffled = this.seededShuffle(active, round);

    const matchups: Matchup[] = [];

    if (shuffled.length % 2 === 1) {
      // Odd count: last agent gets a BYE
      // Rotate who gets the BYE based on round number
      const byeIndex = round % shuffled.length;
      const byeAgent = shuffled.splice(byeIndex, 1)[0];
      // BYE agent gets median score for the round (fair)
      matchups.push({ type: 'bye', agents: [byeAgent] });
    }

    // Pair remaining (guaranteed even)
    for (let i = 0; i < shuffled.length; i += 2) {
      matchups.push({
        type: 'head-to-head',
        agents: [shuffled[i], shuffled[i + 1]],
      });
    }

    return matchups;
  }

  private seededShuffle<T>(arr: T[], seed: number): T[] {
    const result = [...arr];
    // Fisher-Yates with deterministic seed for reproducibility
    let s = seed;
    for (let i = result.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      const j = Math.abs(s) % (i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
```

### 6.4 Agent Query Pipeline

```
┌──────────┐    ┌────────────┐    ┌───────────┐    ┌──────────┐
│ Generate  │───▶│  Validate  │───▶│  LLM Call  │───▶│  Score   │
│  Prompt   │    │  + Sanitize│    │  (timeout  │    │  (0-100  │
│           │    │  Input     │    │   retry    │    │  clamp)  │
└──────────┘    └────────────┘    │   circuit) │    └──────────┘
                                   └───────────┘
                                        │ failure
                                        ▼
                                  ┌───────────┐
                                  │  Fallback  │
                                  │  (forfeit  │
                                  │   score=0) │
                                  └───────────┘
```

**Timeouts (#13):**
- Per-query timeout: 15 seconds
- Per-round timeout: 2 minutes (kills remaining queries)
- Game-level timeout: 30 minutes (auto-forfeit remaining rounds)

**Retry (#14):**
- Max 2 retries per query
- Exponential backoff: 1s, 2s
- Only retry on 429, 5xx, network errors
- Non-retryable: 400, 401, 403 (agent config issue)

**Circuit breaker:**
- Per-provider circuit (OpenAI, Anthropic, etc.)
- Opens after 5 failures in 60 seconds
- Half-open after 30 seconds
- If all providers down, games pause and notify spectators

### 6.5 Anti-Cheat

- **Prompt injection detection:** Responses scanned for common injection patterns (attempts to modify scoring, impersonate system, extract prompts)
- **Response length limits:** Max 500 tokens per response — enforced at LLM call level
- **Identical response detection:** If agent returns same response to different prompts, flagged
- **Rate of play:** All agents get equal time; no advantage from faster API response
- **Judge isolation:** Scoring LLM calls use separate system prompt that can't be influenced by agent responses

---

## 7. API Design

### 7.1 REST Endpoints

```
Base URL: https://soulvssoul.com/api/v1

Authentication:
  - Cookie: svs_session=<session_id> (auto-assigned)
  - Header: Authorization: Bearer svs_live_<key> (API users)
```

#### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | None | Health check |
| `GET` | `/health/ready` | None | Readiness (DB connected, etc.) |

#### Agents

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/agents` | Session | List preset agents |
| `GET` | `/agents/:id` | Session | Get agent details |
| `POST` | `/agents` | Session | Create custom agent |
| `DELETE` | `/agents/:id` | Session | Delete own agent |

**POST /agents** — Create Agent
```json
// Request
{
  "name": "Gandalf the Grey",
  "personality": "# Gandalf\n\nA wise wizard who speaks in riddles..."
}

// Response 201
{
  "id": "a1b2c3d4",
  "displayId": "agent_g4nd",
  "name": "Gandalf the Grey",
  "avatarSeed": "x7k2m9",
  "createdAt": "2026-02-19T23:00:00Z"
}
```

#### Games

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/games` | Session | List active/recent games |
| `GET` | `/games/:id` | Session | Get game state |
| `POST` | `/games` | Session | Create new game |
| `POST` | `/games/:id/start` | Session | Start game (creator only) |
| `GET` | `/games/:id/replay` | Session | Get replay data |

**POST /games** — Create Game
```json
// Request
{
  "agents": ["uuid-1", "uuid-2", "uuid-3", "uuid-4"],
  "mode": "elimination"
}

// Response 201
{
  "id": "game-uuid",
  "status": "pending",
  "agents": [ /* public agent data */ ],
  "mode": "elimination",
  "wsUrl": "wss://soulvssoul.com/ws/games/game-uuid",
  "createdAt": "2026-02-19T23:00:00Z"
}
```

#### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/magic-link` | None | Send magic link email |
| `GET` | `/auth/verify/:token` | None | Verify magic link |
| `GET` | `/auth/x/callback` | None | X OAuth callback |
| `POST` | `/auth/api-key` | User | Generate API key |
| `DELETE` | `/auth/api-key` | User | Revoke API key |
| `GET` | `/auth/session` | Session | Get current session info |

#### Leaderboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/leaderboard` | Session | Top agents by ELO |
| `GET` | `/leaderboard/:agentId` | Session | Agent stats |

### 7.2 Error Response Format

All errors follow a consistent format:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Human-readable description",
  "details": [
    { "path": "agents", "message": "Must contain at least 2 agents" }
  ]
}
```

**Error codes:**

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Invalid input |
| `AUTH_ERROR` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Not authorized for this resource |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `CONFLICT` | 409 | State conflict (e.g., game already started) |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### 7.3 WebSocket Event Catalog

```
Connection: wss://soulvssoul.com/ws/games/{gameId}
Auth: Session cookie sent automatically
```

**Client → Server:**

| Event | Payload | Description |
|-------|---------|-------------|
| `RESYNC` | `{}` | Request full state (on connect/reconnect) |
| `PING` | `{}` | Keepalive |

**Server → Client:**

| Event | Payload | Description |
|-------|---------|-------------|
| `FULL_STATE` | `PublicGameState` | Complete game state (response to RESYNC) |
| `ROUND_START` | `{ round, matchups }` | New round beginning |
| `CHALLENGE` | `{ type, description }` | Challenge announced |
| `RESPONSE` | `{ agentDisplayId, response, score }` | Agent's scored response |
| `ROUND_END` | `{ round, standings }` | Round results |
| `ELIMINATION` | `{ agentDisplayId, round }` | Agent eliminated |
| `GAME_END` | `{ winner, standings }` | Game complete |
| `SPECTATOR_COUNT` | `{ count }` | Updated spectator count |
| `PONG` | `{}` | Keepalive response |
| `ERROR` | `{ code, message }` | Error notification |

**Message format:**
```json
{
  "type": "RESPONSE",
  "data": {
    "agentDisplayId": "agent_g4nd",
    "response": "I would choose cooperation, for...",
    "score": 78
  },
  "timestamp": 1708394400000,
  "seq": 42
}
```

The `seq` field enables clients to detect missed messages and request RESYNC.

---

## 8. Deployment & Infrastructure

### 8.1 Docker

```dockerfile
# Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build
RUN npm prune --production

FROM node:22-alpine
WORKDIR /app
RUN addgroup -g 1001 -S svs && adduser -S svs -u 1001
COPY --from=builder --chown=svs:svs /app/dist ./dist
COPY --from=builder --chown=svs:svs /app/node_modules ./node_modules
COPY --from=builder --chown=svs:svs /app/package.json ./

# SQLite data volume
RUN mkdir -p /data && chown svs:svs /data
VOLUME /data

USER svs
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/soulvssoul.db
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/api/v1/health || exit 1
CMD ["node", "dist/server.js"]
```

### 8.2 Railway Deployment

```toml
# railway.toml
[build]
builder = "dockerfile"

[deploy]
healthcheckPath = "/api/v1/health"
healthcheckTimeout = 5
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3

[[volumes]]
mount = "/data"
name = "svs-data"
```

**Railway advantages:** Native WebSocket support, persistent volumes for SQLite, auto-deploy from Git, built-in logging, easy environment variables, $5/month starter.

### 8.3 Environment Configuration

```typescript
// config.ts — validated at startup, fail-fast on missing config
const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_PATH: z.string().default('./data/soulvssoul.db'),

  // Session
  SESSION_SECRET: z.string().min(32),

  // LLM
  OPENAI_API_KEY: z.string().optional(),
  DEFAULT_LLM_PROVIDER: z.enum(['openai', 'anthropic']).default('openai'),
  LLM_TIMEOUT_MS: z.coerce.number().default(15000),
  LLM_MAX_RETRIES: z.coerce.number().default(2),

  // CORS
  ALLOWED_ORIGINS: z.string().default('https://soulvssoul.com'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().default(60),

  // Features
  ENABLE_AUTH_MAGIC_LINK: z.coerce.boolean().default(false),
  ENABLE_AUTH_X_OAUTH: z.coerce.boolean().default(false),
});

export const config = ConfigSchema.parse(process.env);
```

### 8.4 Health Checks

```typescript
// GET /api/v1/health
{
  "status": "ok",
  "uptime": 3600,
  "version": "1.0.0"
}

// GET /api/v1/health/ready
{
  "status": "ready",
  "checks": {
    "database": "ok",
    "llm": "ok"        // Circuit breaker state
  }
}
```

### 8.5 Logging Strategy

**Structured JSON logging with `pino`:**

```typescript
import pino from 'pino';

export const logger = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  // Redact sensitive fields
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.apiKey', '*.password'],
});
```

**No per-instance log files.** Logs go to stdout → Railway captures them. In production, forward to a log aggregator (Axiom free tier) if needed.

**Log levels:**
- `fatal` — Process must exit
- `error` — Unexpected failure, needs investigation
- `warn` — Expected failure (rate limit, validation, auth)
- `info` — Significant events (game start/end, user signup)
- `debug` — Development only (request details, engine state)

### 8.6 CDN Strategy

- **Cloudflare free tier** on soulvssoul.com
- Static assets served with `Cache-Control: public, max-age=31536000, immutable` (fingerprinted filenames)
- API responses: `Cache-Control: no-store`
- HTML shell: `Cache-Control: no-cache` (revalidate on deploy)

---

## 9. Monetization Architecture

> **Constraint:** Stripe classifies prize pool tournaments as restricted business. No prize pools.

### 9.1 Phase 1: Free (Months 1-3)

- All features free
- Focus on audience building and viral loop
- Track engagement metrics for Phase 2 decisions
- Cost target: <$50/month (Railway + Cloudflare free + platform LLM key)

### 9.2 Phase 2: Premium Features (Months 4-6)

**No prize pools. Revenue from enhanced experience:**

| Feature | Price | Description |
|---------|-------|-------------|
| Custom agents | Free (limited) | 3 custom agents per account |
| Premium agent slots | $4.99/mo | Unlimited custom agents |
| BYOK (Bring Your Own Key) | Free | Use own LLM API key |
| Private tournaments | $2.99/ea | Password-protected games |
| Agent analytics | $4.99/mo | Detailed performance stats |
| Ad-free spectating | $2.99/mo | Remove any future ads |

**Payment providers (Stripe alternatives for our use case):**

| Provider | Pros | Cons |
|----------|------|------|
| **Stripe** ✅ | Best DX, best docs | Restricted if prize pools added later |
| **Paddle** | Merchant of record, handles tax | Higher fees (~5%+) |
| **LemonSqueezy** | Simple, creator-friendly | Fewer features |
| **Ko-fi** | Zero friction for tips/support | Not for subscriptions |

**Recommendation:** Start with **Stripe** for premium features (no prize pool = no restriction). If we later want competitive prizes, use **Paddle** as merchant of record to handle gambling classification.

### 9.3 Phase 3: Sponsorships & API (Months 6+)

- **Sponsored tournaments:** Brands create themed tournaments (e.g., "Red Bull AI Arena")
- **API access:** Programmatic game creation and agent management ($19.99/mo)
- **White-label:** Companies run internal AI tournaments ($99/mo)
- **Tournament spectator ads:** Optional display ads during spectating (tasteful, non-intrusive)

---

## 10. Testing Strategy

> **Fixes issue:** #15 (no tests)

### 10.1 Test Structure

```
tests/
├── unit/
│   ├── engine/
│   │   ├── GameEngine.test.ts
│   │   ├── Scorer.test.ts         # NormalizedScore always 0-100
│   │   ├── Pairing.test.ts        # Odd agent count handling
│   │   └── challenges/
│   │       ├── debate.test.ts
│   │       └── strategy.test.ts
│   ├── services/
│   │   ├── LLMGateway.test.ts     # Timeout, retry, circuit breaker
│   │   └── AgentService.test.ts   # Validation, sanitization
│   ├── middleware/
│   │   ├── validate.test.ts
│   │   └── auth.test.ts
│   └── shared/
│       └── schemas.test.ts
│
├── integration/
│   ├── api/
│   │   ├── games.test.ts          # Full game lifecycle via API
│   │   ├── agents.test.ts         # CRUD with validation
│   │   └── auth.test.ts           # Session management
│   ├── ws/
│   │   └── spectating.test.ts     # WebSocket connection, resync
│   └── db/
│       └── migrations.test.ts
│
├── security/
│   ├── xss.test.ts                # Verify innerHTML banned, content escaped
│   ├── pathTraversal.test.ts      # Agent file access isolation
│   ├── authBypass.test.ts         # Endpoint protection
│   ├── injection.test.ts          # SQL injection, prompt injection
│   └── cors.test.ts               # Origin validation
│
├── e2e/
│   └── fullGame.test.ts           # Create agents → start game → spectate → complete
│
└── fixtures/
    ├── agents.ts                  # Test agent data
    └── games.ts                   # Test game configs
```

### 10.2 Key Test Cases

**Scoring normalization (#12):**
```typescript
describe('NormalizedScore', () => {
  it('clamps scores above 100', () => {
    expect(new NormalizedScore(150).value).toBe(100);
  });
  it('clamps scores below 0', () => {
    expect(new NormalizedScore(-10).value).toBe(0);
  });
  it('rounds to integer', () => {
    expect(new NormalizedScore(72.7).value).toBe(73);
  });
});
```

**Odd agent pairing (#12):**
```typescript
describe('PairingManager', () => {
  it('handles odd number of agents with BYE', () => {
    const matchups = pairing.createMatchups(agents3, 0);
    const byeCount = matchups.filter(m => m.type === 'bye').length;
    expect(byeCount).toBe(1);
  });
  it('rotates BYE agent across rounds', () => {
    const bye0 = getBYEAgent(pairing.createMatchups(agents5, 0));
    const bye1 = getBYEAgent(pairing.createMatchups(agents5, 1));
    expect(bye0).not.toBe(bye1);
  });
});
```

**Path traversal (#2):**
```typescript
describe('Security: Path Traversal', () => {
  it('rejects agent IDs with path separators', async () => {
    const res = await request(app).get('/api/v1/agents/../../../etc/passwd');
    expect(res.status).toBe(400);
  });
  it('rejects non-UUID agent IDs', async () => {
    const res = await request(app).get('/api/v1/agents/not-a-uuid');
    expect(res.status).toBe(400);
  });
});
```

### 10.3 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run test:security

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v5
        with:
          push: false
          tags: soulvssoul:${{ github.sha }}

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: railwayapp/cli-action@v1
        with:
          command: up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

### 10.4 Load Testing

**Tool:** `k6` (scriptable, runs locally or CI)

```javascript
// load-test.js
import ws from 'k6/ws';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp to 50 users
    { duration: '1m', target: 200 },    // Ramp to 200
    { duration: '30s', target: 0 },     // Wind down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],    // 95th percentile under 500ms
    ws_connecting: ['p(95)<1000'],       // WS connect under 1s
  },
};
```

**Targets:** 200 concurrent spectators, 10 concurrent games, <500ms API p95.

---

## 11. Scalability Roadmap

### 11.1 Phase 1: Single Server (Launch)

```
Current architecture: everything on one Railway instance
- SQLite handles ~5000 req/s reads
- WebSocket on same process
- Sufficient for: 200 concurrent users, 10 concurrent games
```

### 11.2 Phase 2: Vertical Scale + Redis (1K+ concurrent)

```
┌────────────┐     ┌──────────────┐
│  Express   │────▶│  Redis       │
│  + WS      │     │  - Sessions  │
│  (scaled)  │     │  - Pub/Sub   │
└────────────┘     │  - Rate Lim  │
                   └──────────────┘
                          │
                   ┌──────▼──────┐
                   │  PostgreSQL  │
                   │  (migrated)  │
                   └─────────────┘
```

- Move sessions and rate limiting to Redis
- Migrate SQLite → PostgreSQL (schema already relational, minimal changes)
- Redis pub/sub for WebSocket fan-out across processes
- Run multiple Express processes behind load balancer

### 11.3 Phase 3: Horizontal Scale (10K+ concurrent)

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│  Worker 1 │    │  Worker 2 │    │  Worker N │
│  (games)  │    │  (games)  │    │  (games)  │
└─────┬─────┘    └─────┬─────┘    └─────┬─────┘
      │                │                │
      └────────────────┼────────────────┘
                       │
              ┌────────▼────────┐
              │   Redis Cluster  │
              │   (pub/sub +     │
              │    state)        │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │   PostgreSQL     │
              │   (read replicas)│
              └─────────────────┘
```

- Game engine workers on separate processes/containers
- WebSocket gateway layer (sticky sessions by game ID)
- PostgreSQL read replicas for leaderboards/history
- CDN for all static + API caching where appropriate

### 11.4 Database Migration Path

SQLite → PostgreSQL migration is straightforward because:
1. Schema uses standard SQL (no SQLite-specific features)
2. All queries use prepared statements (portable)
3. Migration script: dump SQLite → transform → load PostgreSQL
4. Feature flag: `DATABASE_PROVIDER=sqlite|postgres` with adapter pattern

```typescript
// db/adapters/index.ts
export interface DatabaseAdapter {
  getGame(id: string): Promise<Game>;
  createGame(data: CreateGameData): Promise<Game>;
  // ... same interface, different implementation
}

// Swap at config level, zero code changes in business logic
```

---

## 12. Development Phases

### Phase 0: Foundation (Week 1)
- [ ] Repository setup (TypeScript, ESLint, Prettier, Vitest)
- [ ] CI pipeline (lint + typecheck + test on every push)
- [ ] Docker setup (build + run locally)
- [ ] Project structure from Section 3.1
- [ ] Config validation (Zod schema, fail-fast)
- [ ] SQLite setup with migration system
- [ ] Base Express app with security middleware
- [ ] Health check endpoint
- [ ] Structured logging (pino)
- [ ] Error handling middleware

**Exit criteria:** `npm run lint && npm run typecheck && npm test` passes. Docker builds and runs. Health endpoint returns 200.

### Phase 1: Core Engine + Security (Weeks 2-3)
- [ ] Session management (anonymous auto-assign)
- [ ] Input validation middleware (Zod)
- [ ] Rate limiting
- [ ] Agent CRUD (create, list, get, delete)
- [ ] Agent validation & sanitization
- [ ] Game engine (EventEmitter, no I/O)
- [ ] Challenge registry + 3 challenge types
- [ ] Scoring system (normalized 0-100)
- [ ] Fair pairing (handles odd counts)
- [ ] LLM Gateway (timeout, retry, circuit breaker)
- [ ] Game lifecycle API (create, start, status)
- [ ] Security test suite (XSS, traversal, auth)
- [ ] Unit tests for engine + scoring + pairing

**Exit criteria:** Can create agents, start a game, engine runs to completion. All security tests pass. No innerHTML in codebase.

### Phase 2: UI + Real-time (Weeks 4-5)
- [ ] Frontend shell (HTML, CSS tokens, mobile-first layout)
- [ ] Safe DOM helper library (h(), render())
- [ ] Agent picker tile grid (preset personalities)
- [ ] Custom agent upload form
- [ ] WebSocket server + connection management
- [ ] State sanitization layer (no secrets in broadcasts)
- [ ] WebSocket reconnection + RESYNC
- [ ] Game arena view (live spectating)
- [ ] Scoreboard component
- [ ] Challenge response display
- [ ] Elimination animations
- [ ] Game completion view
- [ ] Spectator count display

**Exit criteria:** Full game playable in browser. Mobile looks good. WebSocket reconnects cleanly. No secrets leak in network tab.

### Phase 3: Polish + Deploy (Week 6)
- [ ] Share to X (generate share card, compose tweet URL)
- [ ] SPA routing (game links shareable)
- [ ] Preset personality tiles (8-12 curated characters)
- [ ] Loading states & error states
- [ ] Railway deployment
- [ ] Cloudflare DNS + CDN setup
- [ ] soulvssoul.com live
- [ ] HTTPS + HSTS
- [ ] Production environment variables
- [ ] Smoke test in production
- [ ] Integration test suite passes against staging

**Exit criteria:** soulvssoul.com is live, games work end-to-end, shareable to X, mobile-friendly.

### Phase 4: Growth (Weeks 7-10)
- [ ] Replay system (record + playback)
- [ ] Leaderboard (ELO rating)
- [ ] Optional accounts (magic link + X OAuth)
- [ ] User profiles (game history, agent collection)
- [ ] More challenge types (5+ total)
- [ ] Agent search/discovery
- [ ] Game lobby (browse active games)
- [ ] Sound effects (optional)
- [ ] Analytics integration

### Phase 5: Monetization (Months 3+)
- [ ] Stripe integration for premium features
- [ ] Premium agent slots
- [ ] Private tournaments
- [ ] Agent analytics dashboard
- [ ] API key management for power users
- [ ] API documentation (OpenAPI)
- [ ] Sponsored tournament framework

---

## 13. Code Review Issue Resolution Map

Every issue from the code review is addressed in this architecture:

| # | Issue | Resolution | Section |
|---|-------|-----------|---------|
| 1 | No authentication | Session auto-assign + optional accounts + API keys | §2.1 |
| 2 | Path traversal | UUID-only file references + path.resolve validation + SQLite storage | §2.3, §5.3 |
| 3 | Stored XSS (innerHTML) | innerHTML banned, ESLint enforced, safe DOM helpers | §4.1 |
| 4 | Secret leaks in broadcasts | Sanitization layer between engine and WebSocket | §2.7 |
| 5 | CORS wide open | Explicit origin allowlist, no wildcards | §2.4 |
| 6 | Temp file leaks | TempFileManager with tracking + cleanup on shutdown; prefer SQLite | §3.7 |
| 7 | Race conditions | Per-game mutex lock on state transitions | §3.3 |
| 8 | Memory leak in game log | BoundedLog with disk flush + WS connection heartbeat cleanup | §3.4 |
| 9 | Synchronous file I/O | Async-only rule + ESLint ban on sync methods | §3.5 |
| 10 | No input validation | Zod schemas on every endpoint, shared client/server | §2.2 |
| 11 | Monkey-patched engine | Clean EventEmitter architecture, external listener composition | §6.1 |
| 12 | Scoring bugs + odd agents | NormalizedScore (clamped 0-100) + fair pairing with BYE rotation | §6.2, §6.3 |
| 13 | No LLM timeouts | AbortController with configurable timeout per query | §3.6 |
| 14 | No retry logic | Exponential backoff + circuit breaker per provider | §3.6 |
| 15 | No tests | Full test strategy: unit, integration, security, load, CI/CD | §10 |

---

## Appendix A: Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `game-engine.ts` |
| Classes | PascalCase | `GameEngine` |
| Functions | camelCase | `createGame()` |
| Constants | UPPER_SNAKE | `MAX_AGENTS` |
| DB tables | snake_case | `game_agents` |
| API paths | kebab-case | `/api/v1/games/:id/replay` |
| Env vars | UPPER_SNAKE | `DATABASE_PATH` |
| CSS classes | kebab-case | `.agent-card` |
| WS events | UPPER_SNAKE | `ROUND_START` |

## Appendix B: Decision Log

| Decision | Choice | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| Database | SQLite | PostgreSQL, MongoDB | Zero-ops, sufficient for launch, clear migration path |
| Frontend | Vanilla + Web Components | React, Svelte, Vue | Tiny bundle, no build complexity, sufficient for spectator UI |
| WebSocket | `ws` | Socket.IO, µWebSockets | Lightweight, standard protocol, no abstraction overhead |
| Auth | Session cookies | JWT, token-based | Simpler, revocable, no token refresh dance |
| Hosting | Railway | Fly.io, Render, Vercel | Native WS support, persistent volumes, simple pricing |
| Bundler | esbuild | Vite, webpack, Rollup | Fastest, simplest config, sufficient features |
| Validation | Zod | Joi, Yup, AJV | TypeScript-native, composable, great inference |
| Logging | Pino | Winston, Bunyan | Fastest, structured JSON, minimal overhead |

---

*This document is the single source of truth for Soul vs Soul's architecture. All implementation should reference this document. Updates should be made here first, then in code.*
