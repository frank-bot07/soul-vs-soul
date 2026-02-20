import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config.js';

describe('Config', () => {
  it('loads defaults for minimal env', () => {
    const cfg = loadConfig({});
    expect(cfg.PORT).toBe(3000);
    expect(cfg.NODE_ENV).toBe('development');
    expect(cfg.DATABASE_PATH).toBe('./data/soulvssoul.db');
  });

  it('coerces PORT to number', () => {
    const cfg = loadConfig({ PORT: '8080' });
    expect(cfg.PORT).toBe(8080);
  });

  it('parses ALLOWED_ORIGINS', () => {
    const cfg = loadConfig({ ALLOWED_ORIGINS: 'https://example.com' });
    expect(cfg.ALLOWED_ORIGINS).toBe('https://example.com');
  });
});
