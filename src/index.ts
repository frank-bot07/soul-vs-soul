import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { initDb, closeDb } from './db/index.js';

const app = createApp();

// Initialize database
initDb();

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server started');
});

// Graceful shutdown
function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown initiated');
  server.close(() => {
    closeDb();
    logger.info('Shutdown complete');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
