import Database from 'better-sqlite3';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { runMigrations } from './migrator.js';
import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function initDb(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? config.DATABASE_PATH;

  // Ensure directory exists
  const dir = path.dirname(resolvedPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);

  // Enable WAL mode for concurrent reads
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  logger.info({ path: resolvedPath }, 'Database initialized');

  // Run migrations
  runMigrations(db);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('Database closed');
  }
}
