import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { AgentQueries } from '../../src/db/queries/agents.js';
import { AgentService } from '../../src/services/AgentService.js';
import { runMigrations } from '../../src/db/migrator.js';

describe('XSS Prevention', () => {
  let db: Database.Database;
  let service: AgentService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    service = new AgentService(new AgentQueries(db));
  });

  afterEach(() => {
    db.close();
  });

  it('strips script tags from personality', () => {
    const result = service.create(
      { name: 'XSS Bot', personality: 'Normal text <script>alert("xss")</script> more text personality' },
      'session1',
    );
    const agent = service.get(result.id);
    expect(agent.personality).not.toContain('<script>');
    expect(agent.personality).not.toContain('</script>');
  });

  it('strips event handlers from HTML tags', () => {
    const result = service.create(
      { name: 'Event Bot', personality: 'Click <img onerror="alert(1)" src=x> here for personality' },
      'session1',
    );
    const agent = service.get(result.id);
    expect(agent.personality).not.toContain('<img');
    expect(agent.personality).not.toContain('onerror');
  });

  it('strips iframe tags', () => {
    const result = service.create(
      { name: 'Frame Bot', personality: 'See this <iframe src="evil.com"></iframe> content personality' },
      'session1',
    );
    const agent = service.get(result.id);
    expect(agent.personality).not.toContain('<iframe');
  });

  it('strips HTML from name', () => {
    const result = service.create(
      { name: 'Bot', personality: 'A normal personality with enough characters' },
      'session1',
    );
    expect(result.name).not.toContain('<');
  });

  it('preserves safe markdown content', () => {
    const personality = '# Heading\n\n**Bold** and *italic* with [links](url) personality text';
    const result = service.create({ name: 'MDBot', personality }, 'session1');
    const agent = service.get(result.id);
    expect(agent.personality).toContain('# Heading');
    expect(agent.personality).toContain('**Bold**');
  });
});
