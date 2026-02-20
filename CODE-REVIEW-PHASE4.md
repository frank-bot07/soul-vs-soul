# Code Review — Soul vs Soul (Post Phase 4)

**Reviewer:** Senior Security-Focused Code Reviewer  
**Date:** 2026-02-19  
**Scope:** Full codebase review — all source files, tests, config, CI  

---

## 🚨 Critical Issues (Must Fix)

### 1. Game Route Parameters Not UUID-Validated
**Files:** `src/routes/games.ts:24,32,48,58`, `src/routes/replays.ts:13`, `src/routes/leaderboard.ts:25`  
**Description:** While agent routes benefit from `AgentService.validateUUID()`, game route `:id` params are passed directly to `gameService.startGame(req.params['id'])`, `getGame()`, `getResults()` and the replay/leaderboard routes without UUID validation. The SQL queries use parameterized statements (safe from injection), but the architecture doc mandates UUID-only lookups everywhere.  
**Fix:** Add Zod UUID validation to all `:id` and `:agentId` route params via a shared param validation middleware, or validate in each service method like `AgentService` does.

### 2. `startGame` Has No Authorization Check — Any Session Can Start Any Game
**File:** `src/routes/games.ts:23-28`, `src/services/GameService.ts:56-80`  
**Description:** The architecture doc says "Start game (creator only)" but `startGame()` never checks if `req.sessionId` matches the game's `creator_session`. Any authenticated user (which means anyone, since sessions are auto-created) can start any pending game.  
**Fix:** Add `if (game.creator_session !== sessionId) throw new AuthError('Only the game creator can start the game')` in `GameService.startGame()`.

### 3. `agent:response` Event Leaks Internal Agent ID + Raw LLM Response to Replay
**Files:** `src/engine/GameEngine.ts:107-112`, `src/app.ts:88-91`  
**Description:** The engine emits `agent:response` with `agentId: agent.id` (the internal UUID, not `displayId`) and the raw `response` string. This event is recorded directly into the replay table via `replayService.record()` and served verbatim through the replay API. The architecture doc mandates using `displayId` only in public-facing data, and raw LLM responses should be sanitized before broadcast. While the `sanitize.ts` module exists, it's never actually wired into the broadcast pipeline — it's dead code.  
**Fix:** (a) Emit `displayId` instead of `id` in `agent:response`. (b) Actually use `sanitizeGameState()` in the WebSocket broadcast path. (c) Sanitize replay data before serving.

### 4. WebSocket Server Doesn't Validate Game ID Format
**File:** `src/ws/WebSocketServer.ts:52-62`  
**Description:** The `SUBSCRIBE` handler checks `typeof gameId !== 'string'` but doesn't validate it's a UUID. Any string is accepted. While this doesn't enable SQL injection (WS doesn't directly query DB), it allows arbitrary strings as map keys and could be used for resource exhaustion by creating millions of unique spectator sets.  
**Fix:** Validate `gameId` is a UUID before creating spectator sets.

### 5. CORS `connect-src` CSP Allows Any `wss:` Origin
**File:** `src/middleware/security.ts:5`  
**Description:** CSP `connect-src 'self' wss:` allows WebSocket connections to ANY `wss://` host, not just the app's own domain. Should be `connect-src 'self' wss://soulvssoul.com` (or dynamically from config).  
**Fix:** Tighten to `connect-src 'self' wss://${config.CORS_ORIGINS.split(',')[0]?.replace('https://', '')}` or similar.

### 6. `agent:query` Event Exposes Full LLM Prompt (Including System Prompt Context)
**File:** `src/engine/GameEngine.ts:99`  
**Description:** The `agent:query` event includes the full `prompt` string. If this gets wired to WebSocket broadcasts (it's not currently, but the architecture is set up for it), it could leak challenge internals. More immediately, it's recorded in replay data through the engine event listeners in `app.ts` — wait, actually checking the wiring in `app.ts`, `agent:query` is NOT wired to replay. But it IS available to any listener. Low risk currently but architecturally concerning.  
**Risk:** Low (not currently broadcast or recorded). Monitor.

### 7. Session Secret Has Insecure Default
**File:** `src/config.ts:5`  
**Description:** `SESSION_SECRET` defaults to `'dev-secret-change-me-in-production-please-32chars'`. While `.default()` is fine for dev, there's no production-mode check that rejects the default. Someone deploying without setting this env var gets an insecure session secret.  
**Fix:** In production mode, require `SESSION_SECRET` (no default), or at minimum reject the known dev default.

---

## ⚠️ Important Issues (Should Fix)

### 8. Sync File I/O in DB Initialization (Startup Only)
**Files:** `src/db/index.ts:23-24` (`existsSync`, `mkdirSync`), `src/db/migrator.ts:27,32,39` (`existsSync`, `readdirSync`, `readFileSync`)  
**Description:** These use synchronous FS operations. Per architecture doc §3.5, sync I/O is banned on the request path. These run at startup only, which is acceptable, but the ESLint rule doesn't distinguish — it should allow startup-path usage or these should be refactored.  
**Severity:** Low (startup only, not request path). Technically violates the stated rule.

### 9. `sanitize.ts` (WS) Is Dead Code — Never Imported or Used
**File:** `src/ws/sanitize.ts`  
**Description:** The `sanitizeGameState()` function exists but is never imported anywhere. The WebSocket broadcast path in `app.ts` doesn't sanitize — engine events go directly to replay recording without sanitization. The WS server's `broadcast()` method just serializes whatever it receives.  
**Fix:** Wire `sanitizeGameState` into the broadcast pipeline or replay recording path.

### 10. `agent:response` in Replay Stores Raw Response Including Potential PII/Prompt Leaks
**File:** `src/app.ts:91`, `src/routes/replays.ts:17-21`  
**Description:** Replay events store raw engine data as JSON. The replay API serves `JSON.parse(e.data)` directly. If an LLM response contains prompt injection content, leaked system prompts, or other sensitive data, it's stored permanently and served to anyone who requests the replay.  
**Fix:** Sanitize/filter replay event data before storage and/or serving.

### 11. No Rate Limiting on `POST /api/v1/games/:id/start` or Game/Replay GET Endpoints
**Files:** `src/routes/games.ts`, `src/routes/replays.ts`  
**Description:** While `createGameRateLimit` and `createAgentRateLimit` exist in `src/middleware/rateLimit.ts`, they're never applied — the routes don't use them. Only the global rate limiter in `app.ts` applies.  
**Fix:** Apply specific rate limiters to mutating endpoints as defined in the architecture doc.

### 12. Agent Delete Has No Preset Protection
**File:** `src/services/AgentService.ts:55-60`  
**Description:** The delete method checks `creator_session` authorization, but preset agents have `null` creator_session. If any user creates a session and somehow gets a preset agent's ID, the check `creator !== sessionId` would fail (null !== sessionId), preventing deletion — but only incidentally. Should explicitly reject deletion of preset agents.  
**Fix:** Add `if (agent.is_preset) throw new AuthError('Cannot delete preset agents')`.

### 13. `listAgents` Response Shape Inconsistency
**File:** `src/routes/agents.ts:23` vs `public/js/components/AgentPicker.ts:72`  
**Description:** GET `/agents` returns `{ agents: [...] }` but `api.listAgents()` expects a flat array. The `AgentPicker` has a workaround: `agents = Array.isArray(resp) ? resp : (resp as unknown as { agents: AgentResponse[] }).agents`. This indicates a type mismatch between API client and server.  
**Fix:** Align the API client types with actual server response.

### 14. Magic Link Token Storage Is In-Memory (Not Persisted)
**File:** `src/services/AuthService.ts:8-10`  
**Description:** `magicLinkTokens` is a `Map` in memory. Server restart loses all pending magic links. Also no cleanup of expired tokens — they accumulate forever.  
**Fix:** Store tokens in SQLite with TTL, or at minimum add periodic cleanup.

### 15. ELO Calculation Doesn't Use Transactions
**File:** `src/services/LeaderboardService.ts:38-73`  
**Description:** Multiple `upsert` calls for standings aren't wrapped in a database transaction. If the process crashes mid-update, some agents get updated ratings and others don't.  
**Fix:** Wrap the entire `updateFromGame` in a `db.transaction()`.

### 16. `app.ts` URL Rewriting Is Fragile
**File:** `src/app.ts:105-136`  
**Description:** The `ensureInit()` pattern with manual URL rewriting (`req.url = ...`) is unusual and fragile. If a route doesn't match because of the rewrite, debugging will be painful.  
**Fix:** Consider standard Express sub-router mounting instead of manual URL manipulation.

---

## 💡 Minor Improvements

### 17. Frontend Components Don't Clean Up Event Listeners
**Files:** All `public/js/components/*.ts`  
**Description:** Components add `addEventListener` calls on dynamically created elements. These are cleaned up when `render()` replaces content (elements are GC'd), but the `store.subscribe()` in `Scoreboard.ts` and `GameArena.ts` could leak if components are mounted multiple times without cleanup. `GameArena` has cleanup logic for navigation, which is good, but `Scoreboard` doesn't.

### 18. No HSTS Header
**File:** `src/middleware/security.ts`  
**Description:** Architecture doc §2.6 specifies `Strict-Transport-Security` header, but it's not in the security middleware. Helmet may set it, but it should be explicitly configured.

### 19. No `health/ready` Endpoint
**File:** `src/routes/health.ts`  
**Description:** Architecture doc §8.4 specifies both `/health` and `/health/ready` (checking DB + LLM status). Only `/healthz` exists.

### 20. Seeded Shuffle LCG Could Have Collisions
**File:** `src/engine/Pairing.ts:20-26`  
**Description:** The LCG parameters used are the classic Numerical Recipes constants, which is fine, but `& 0xffffffff` can produce negative values due to JavaScript's signed 32-bit behavior in bitwise ops. `Math.abs(s)` handles this, but `Math.abs(-2147483648)` returns `2147483648` which modulo a small number is fine. Minor edge case.

### 21. No `Dockerfile` in Repository
**Description:** Architecture doc §8.1 specifies a Dockerfile, but none exists in the repo.

### 22. `pino` Logger Config Could Use `pino-pretty` for Dev
**File:** `src/logger.ts`  
**Description:** Dev transport targets `pino/file` to stdout. Using `pino-pretty` would improve DX.

### 23. Frontend TypeScript Files Not in `tsconfig.json`
**File:** `tsconfig.json:18`  
**Description:** `include` only covers `src/**/*.ts` and `tests/**/*.ts`. Frontend files in `public/js/` are not type-checked by `tsc --noEmit`. They're bundled by esbuild which doesn't type-check.

### 24. No `aria-live` Region for Dynamic Challenge/Response Updates
**Files:** `public/js/components/ChallengeView.ts`, `GameArena.ts`  
**Description:** While the main `#app` div has `aria-live="polite"`, fine-grained live regions for score changes or challenge announcements would improve screen reader UX.

### 25. No Session Expiry Cleanup
**Description:** Expired sessions accumulate in the database forever. Should periodically purge `WHERE expires_at < unixepoch()`.

---

## ✅ What's Good

1. **Zero `innerHTML` usage** — enforced by ESLint, verified by grep. The `h()` DOM helper pattern is solid and XSS-safe by construction.

2. **UUID-only agent lookups** with belt-and-suspenders path traversal checks in `AgentService.validateUUID()`.

3. **Proper error hierarchy** — `AppError` with operational vs programmer errors, consistent JSON error responses.

4. **EventEmitter-based game engine** — clean separation from I/O. No monkey-patching. Pure logic that's easy to test.

5. **NormalizedScore (0-100 clamped)** — handles NaN, Infinity, negatives. Well-tested.

6. **Fair pairing with BYE rotation** — odd agent counts handled correctly with deterministic seeded shuffle.

7. **LLM Gateway with timeout, retry, and circuit breaker** — all three patterns implemented correctly with exponential backoff.

8. **Input validation with Zod** on agent creation and game creation endpoints.

9. **WebSocket heartbeat + dead connection cleanup** — 30s ping/pong cycle, proper connection lifecycle management.

10. **Session-based auth with HttpOnly, SameSite=Strict cookies** — no JWT footgun.

11. **Rate limiting infrastructure** — global rate limiter applied, endpoint-specific limiters defined (though not wired — see issue #11).

12. **Content Security Policy** — restrictive, no `unsafe-eval`, no `unsafe-inline` for scripts.

13. **Prepared statements everywhere** — zero string concatenation in SQL queries. SQLite injection not possible.

14. **Comprehensive test suite** — 17,265 lines of tests covering engine, pairing, scoring, security (XSS, path traversal), integration API tests, WebSocket tests.

15. **Mobile-first CSS** with design tokens, proper touch targets, and `prefers-reduced-motion` support.

16. **Semantic HTML** — skip link, ARIA labels, role attributes, proper heading hierarchy.

17. **WebSocket reconnection** with exponential backoff and RESYNC on reconnect.

18. **CI pipeline** — lint, typecheck, and test on every push.

19. **Graceful shutdown** — SIGTERM/SIGINT handlers close WS connections and DB.

20. **Client-side sanitization** — belt-and-suspenders `stripTags` + `sanitizeDisplay` even though DOM helpers already escape.

---

## 📊 Overall Assessment

| Category | Grade | Notes |
|----------|-------|-------|
| **Security** | **B+** | Major improvements from MVP. Zero innerHTML, UUID validation, parameterized SQL, proper CORS (mostly). Issues: missing auth on startGame, un-wired sanitization layer, overly permissive CSP connect-src, insecure session secret default. |
| **Reliability** | **B** | Good: circuit breaker, timeouts, retries, mutex locks. Issues: no transactions on leaderboard updates, in-memory magic link tokens, no session cleanup. |
| **Code Quality** | **A-** | TypeScript strict mode, clean architecture, EventEmitter pattern, comprehensive tests. Minor: dead code (sanitize.ts), fragile URL rewriting, frontend not type-checked. |
| **Production Readiness** | **B-** | Needs: auth check on startGame (#2), wire sanitization layer (#9), apply rate limiters (#11), session secret enforcement (#7), add Dockerfile (#21). Close but not quite there. |

### Verdict

**Not yet production-ready, but close.** The rebuild addressed the vast majority of the original 27 issues correctly. The architecture is sound, the code quality is high, and the security posture is dramatically better than the original MVP. Fix the 7 critical issues (primarily #2 auth bypass on startGame, #3 agent ID leak, #5 CSP, #7 session secret, and #9 dead sanitization code) and this is ready to ship.

---

## Issue Resolution Check

| # | Original Issue | Status | Notes |
|---|---------------|--------|-------|
| 1 | No authentication | ✅ Fixed | Session auto-assign + cookie auth + API key support |
| 2 | Path traversal | ✅ Fixed | UUID-only with Zod validation + path separator rejection |
| 3 | Stored XSS (innerHTML) | ✅ Fixed | Zero innerHTML in codebase, ESLint-enforced, safe `h()` helpers |
| 4 | Secret leaks in broadcasts | ⚠️ Partial | `sanitizeGameState()` exists but is **dead code** — never wired in. Engine emits internal IDs in `agent:response`. |
| 5 | CORS wide open | ✅ Fixed | Explicit origin allowlist from config, no wildcards |
| 6 | Temp file leaks | ✅ Fixed | `multer.memoryStorage()` — no temp files at all |
| 7 | Race conditions | ✅ Fixed | Per-game mutex lock in `GameService.withLock()` |
| 8 | Memory leak in game log | ✅ Fixed | No unbounded log — replay goes to SQLite. Games cleaned from map on completion. |
| 9 | Synchronous file I/O | ⚠️ Partial | Sync I/O exists in startup path only (db init, migrations). Acceptable but technically violates stated rule. |
| 10 | No input validation | ✅ Fixed | Zod schemas on create endpoints. Missing on route params (see #1 above). |
| 11 | Monkey-patched engine | ✅ Fixed | Clean EventEmitter architecture, external listener composition |
| 12 | Scoring bugs + odd agents | ✅ Fixed | NormalizedScore clamps 0-100, PairingManager handles BYE rotation |
| 13 | No LLM timeouts | ✅ Fixed | AbortController with configurable timeout |
| 14 | No retry logic | ✅ Fixed | Exponential backoff + circuit breaker |
| 15 | No tests | ✅ Fixed | 17K+ lines of tests — unit, integration, security, e2e |
| 16 | Hardcoded model names | ✅ Fixed | Configurable via `LLM_MODEL` env var |
| 17 | dotenv never loaded | ✅ Fixed | Config loaded via Zod schema from `process.env` |
| 18 | Game log saved to CWD | ✅ Fixed | Replay events stored in SQLite |
| 19 | moment.js deprecated | ✅ Fixed | No moment.js — uses native Date/timestamps |
| 20 | Logger creates file per instance | ✅ Fixed | Pino to stdout |
| 21 | Dead code | ⚠️ New dead code | `sanitize.ts` WS module is unused |
| 22 | innerHTML for non-user data | ✅ Fixed | All innerHTML banned |
| 23 | No helmet | ✅ Fixed | Helmet + custom CSP + security headers |
| 24 | No graceful shutdown | ✅ Fixed | SIGTERM/SIGINT handlers |
| 25 | requestAnimationFrame waste | ✅ Fixed | No RAF-based timestamp loop |
| 26 | No CSP | ✅ Fixed | Full CSP with restrictive directives |
| 27 | No WS reconnection/resync | ✅ Fixed | Exponential backoff + RESYNC on reconnect |

**Resolution rate: 23/27 fully fixed, 4/27 partially fixed.**
