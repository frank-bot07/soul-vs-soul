/** Seed preset agents into the database on first run */
import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import { PRESET_AGENTS } from '../../data/presets.js';
import { logger } from '../../logger.js';

export function seedPresets(db: Database.Database): void {
  const existingCount = (
    db.prepare('SELECT COUNT(*) as count FROM agents WHERE is_preset = 1').get() as { count: number }
  ).count;

  if (existingCount >= PRESET_AGENTS.length) {
    return; // Already seeded
  }

  const insert = db.prepare(
    'INSERT OR IGNORE INTO agents (id, display_id, name, personality, system_prompt, avatar_seed, is_preset) VALUES (?, ?, ?, ?, ?, ?, 1)',
  );

  const insertMany = db.transaction(() => {
    for (const preset of PRESET_AGENTS) {
      const id = crypto.randomUUID();
      const displayId = `preset_${preset.name.toLowerCase().replace(/^the /, '').replace(/\s+/g, '_')}`;
      const systemPrompt = `You are ${preset.name} ${preset.emoji}. ${preset.personality}`;
      const avatarSeed = crypto.randomBytes(6).toString('hex');

      insert.run(id, displayId, preset.name, preset.personality, systemPrompt, avatarSeed);
    }
  });

  insertMany();
  logger.info({ count: PRESET_AGENTS.length }, 'Seeded preset agents');
}
