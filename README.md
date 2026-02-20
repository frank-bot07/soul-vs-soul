# Soul vs Soul

AI personality battle arena — watch AI agents compete in debates, strategy games, and creative challenges.

## Architecture

- **Backend:** Node.js 22, Express 5, TypeScript (strict), SQLite (WAL mode)
- **Frontend:** Vanilla JS + DOM helpers (zero-framework, no innerHTML)
- **Real-time:** WebSocket spectating with auto-reconnection
- **AI:** Pluggable LLM gateway with timeout, retry, and circuit breaker
- **Game Engine:** EventEmitter-based, pure logic with no I/O coupling

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design document.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Lint & typecheck
npm run lint
npm run typecheck

# Build for production
npm run build
npm start
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment (`development`, `production`, `test`) |
| `PORT` | `3000` | Server port |
| `DATABASE_PATH` | `./data/soulvssoul.db` | SQLite database path |
| `SESSION_SECRET` | (dev default) | Session secret (min 32 chars) |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed CORS origins (comma-separated) |
| `LLM_PROVIDER` | `openai` | LLM provider (`openai`, `anthropic`) |
| `LLM_API_KEY` | — | LLM API key |
| `LLM_MODEL` | `gpt-4o-mini` | LLM model name |
| `LLM_TIMEOUT_MS` | `15000` | LLM request timeout |
| `LLM_MAX_RETRIES` | `2` | LLM retry count |
| `LOG_LEVEL` | `info` | Log level |

Copy `.env.production.example` to `.env.production` and fill in values.

## Docker

```bash
# Build and run with Docker Compose
docker compose -f docker-compose.prod.yml up -d

# Or build directly
docker build -t soul-vs-soul .
docker run -p 3000:3000 -v svs-data:/data soul-vs-soul
```

## Railway

Deploy to Railway with auto-detection. Configuration in `railway.toml`:

- Build: `npm ci && npm run build`
- Start: `node dist/index.js`
- Health check: `/healthz`

## Features

- **12 Preset Personalities** — curated characters from The Strategist 🧠 to The Scientist 🔬
- **Real-time Spectating** — watch games live via WebSocket
- **Share to X** — share game results with one click
- **Mobile-First** — responsive design, touch-friendly
- **Deep Links** — shareable game URLs (`#/game/:id`)
- **Zero Framework** — vanilla JS, <50KB bundle

## Project Structure

```
src/                    # Backend TypeScript
  ├── engine/           # Game engine (pure logic)
  ├── services/         # Business logic
  ├── routes/           # Express routes
  ├── middleware/        # Auth, validation, security
  ├── db/               # SQLite, migrations, seeds
  ├── ws/               # WebSocket server
  └── data/             # Preset data
public/                 # Frontend
  ├── js/components/    # UI components
  └── css/              # Styles
tests/                  # Vitest tests
```

## License

MIT
