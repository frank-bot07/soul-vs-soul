import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { initDb, closeDb } from './db/index.js';
import { GameWebSocketServer } from './ws/WebSocketServer.js';
import { createServer } from 'node:http';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = createApp();

// Serve static files
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicPath = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicPath));

// SPA fallback for non-API routes
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Initialize database
initDb();

const server = createServer(app);

// WebSocket server
const wsServer = new GameWebSocketServer(server);

server.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server started');
});

// Graceful shutdown
function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown initiated');
  wsServer.close();
  server.close(() => {
    closeDb();
    logger.info('Shutdown complete');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
