import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import { securityHeaders } from './middleware/security.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import { createAgentRoutes } from './routes/agents.js';
import { createGameRoutes } from './routes/games.js';
import { AgentService } from './services/AgentService.js';
import { GameService } from './services/GameService.js';
import { AgentQueries } from './db/queries/agents.js';
import { GameQueries } from './db/queries/games.js';
import { GameEngine } from './engine/GameEngine.js';
import { ChallengeRegistry } from './engine/ChallengeRegistry.js';
import { DebateChallenge } from './engine/challenges/debate.js';
import { StrategyChallenge } from './engine/challenges/strategy.js';
import { CreativeChallenge } from './engine/challenges/creative.js';
import { getDb } from './db/index.js';

export function createApp(): express.Express {
  const app = express();

  // Security
  app.use(helmet());
  app.use(securityHeaders);
  app.use(
    cors({
      origin: config.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
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
  app.use(authRouter);

  // Services (lazy init — DB must be ready)
  let agentService: AgentService | null = null;
  let gameService: GameService | null = null;

  function getServices() {
    if (!agentService) {
      const db = getDb();
      const agentQueries = new AgentQueries(db);
      const gameQueries = new GameQueries(db);

      const challengeRegistry = new ChallengeRegistry();
      challengeRegistry.register(new DebateChallenge());
      challengeRegistry.register(new StrategyChallenge());
      challengeRegistry.register(new CreativeChallenge());

      const engine = new GameEngine(challengeRegistry);
      agentService = new AgentService(agentQueries);
      gameService = new GameService(gameQueries, agentQueries, engine);
    }
    return { agentService: agentService!, gameService: gameService! };
  }

  // Mount routes with lazy service init
  app.use((req, _res, next) => {
    const services = getServices();
    (req as typeof req & { services: typeof services }).services = services;
    next();
  });

  // We need to create routes with services, but services need DB...
  // Use a middleware approach that creates routes on first request
  let agentRoutes: express.Router | null = null;
  let gameRoutes: express.Router | null = null;

  app.use('/api/v1/agents', (req, res, next) => {
    if (!agentRoutes) {
      const { agentService: as_ } = getServices();
      agentRoutes = createAgentRoutes(as_);
    }
    // Re-prefix for the sub-router
    req.url = `/api/v1/agents${req.url === '/' ? '' : req.url}`;
    agentRoutes(req, res, next);
  });

  app.use('/api/v1/games', (req, res, next) => {
    if (!gameRoutes) {
      const { gameService: gs } = getServices();
      gameRoutes = createGameRoutes(gs);
    }
    req.url = `/api/v1/games${req.url === '/' ? '' : req.url}`;
    gameRoutes(req, res, next);
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
