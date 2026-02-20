import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import { securityHeaders } from './middleware/security.js';
import healthRouter from './routes/health.js';
import { createAuthRoutes } from './routes/auth.js';
import { createAgentRoutes } from './routes/agents.js';
import { createGameRoutes } from './routes/games.js';
import { createReplayRoutes } from './routes/replays.js';
import { createLeaderboardRoutes } from './routes/leaderboard.js';
import { createUserRoutes } from './routes/users.js';
import { AgentService } from './services/AgentService.js';
import { GameService } from './services/GameService.js';
import { ReplayService } from './services/ReplayService.js';
import { LeaderboardService } from './services/LeaderboardService.js';
import { AuthService } from './services/AuthService.js';
import { AgentQueries } from './db/queries/agents.js';
import { GameQueries } from './db/queries/games.js';
import { ReplayQueries } from './db/queries/replays.js';
import { LeaderboardQueries } from './db/queries/leaderboard.js';
import { UserQueries } from './db/queries/users.js';
import { GameEngine } from './engine/GameEngine.js';
import { ChallengeRegistry } from './engine/ChallengeRegistry.js';
import { DebateChallenge } from './engine/challenges/debate.js';
import { StrategyChallenge } from './engine/challenges/strategy.js';
import { CreativeChallenge } from './engine/challenges/creative.js';
import { TriviaChallenge } from './engine/challenges/trivia.js';
import { AllianceChallenge } from './engine/challenges/alliance.js';
import { getDb } from './db/index.js';

export function createApp(): express.Express {
  const app = express();

  // Security
  app.use(helmet());
  app.use(securityHeaders);
  app.use(
    cors({
      origin: config.CORS_ORIGINS.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      maxAge: 86400,
    }),
  );

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Parsing
  app.use(express.json({ limit: '100kb' }));

  // Routes
  app.use(healthRouter);

  // Services (lazy init — DB must be ready)
  let initialized = false;
  let agentRoutes: express.Router;
  let gameRoutes: express.Router;
  let replayRoutes: express.Router;
  let leaderboardRoutes: express.Router;
  let userRoutes: express.Router;
  let authRoutes: express.Router;

  function ensureInit() {
    if (initialized) return;
    initialized = true;

    const db = getDb();
    const agentQueries = new AgentQueries(db);
    const gameQueries = new GameQueries(db);
    const replayQueries = new ReplayQueries(db);
    const leaderboardQueries = new LeaderboardQueries(db);
    const userQueries = new UserQueries(db);

    const challengeRegistry = new ChallengeRegistry();
    challengeRegistry.register(new DebateChallenge());
    challengeRegistry.register(new StrategyChallenge());
    challengeRegistry.register(new CreativeChallenge());
    challengeRegistry.register(new TriviaChallenge());
    challengeRegistry.register(new AllianceChallenge());

    const engine = new GameEngine(challengeRegistry);
    const agentService = new AgentService(agentQueries);
    const gameService = new GameService(gameQueries, agentQueries, engine);
    const replayService = new ReplayService(replayQueries);
    const leaderboardService = new LeaderboardService(leaderboardQueries);
    const authService = new AuthService(userQueries);

    // Wire engine events to replay + leaderboard
    engine.on('game:start', (data) => replayService.record(data.gameId, 'game:start', data));
    engine.on('round:start', (data) => replayService.record(data.gameId, 'round:start', data));
    engine.on('challenge:start', (data) => replayService.record(data.gameId, 'challenge:start', data));
    engine.on('agent:response', (data) => replayService.record(data.gameId, 'agent:response', data));
    engine.on('round:end', (data) => replayService.record(data.gameId, 'round:end', data));
    engine.on('elimination', (data) => replayService.record(data.gameId, 'elimination', data));
    engine.on('game:end', (data) => {
      replayService.record(data.gameId, 'game:end', data);
      replayService.cleanup(data.gameId);
      leaderboardService.updateFromGame(data);
    });

    agentRoutes = createAgentRoutes(agentService);
    gameRoutes = createGameRoutes(gameService);
    replayRoutes = createReplayRoutes(replayService, gameQueries);
    leaderboardRoutes = createLeaderboardRoutes(leaderboardService);
    userRoutes = createUserRoutes(authService);
    authRoutes = createAuthRoutes(authService);
  }

  // Auth routes
  app.use((req, res, next) => {
    ensureInit();
    authRoutes(req, res, next);
  });

  // Agent routes
  app.use('/api/v1/agents', (req, res, next) => {
    ensureInit();
    req.url = `/api/v1/agents${req.url === '/' ? '' : req.url}`;
    agentRoutes(req, res, next);
  });

  // Replay routes (before game routes so /games/:id/replay matches first)
  app.use((req, res, next) => {
    ensureInit();
    replayRoutes(req, res, next);
  });

  // Game routes
  app.use('/api/v1/games', (req, res, next) => {
    ensureInit();
    req.url = `/api/v1/games${req.url === '/' ? '' : req.url}`;
    gameRoutes(req, res, next);
  });

  // Leaderboard routes
  app.use('/api/v1/leaderboard', (req, res, next) => {
    ensureInit();
    req.url = `/api/v1/leaderboard${req.url === '/' ? '' : req.url}`;
    leaderboardRoutes(req, res, next);
  });

  // User routes
  app.use('/api/v1/users', (req, res, next) => {
    ensureInit();
    req.url = `/api/v1/users${req.url === '/' ? '' : req.url}`;
    userRoutes(req, res, next);
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
