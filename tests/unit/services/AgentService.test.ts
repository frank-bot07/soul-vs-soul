import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { AgentQueries } from '../../../src/db/queries/agents.js';
import { AgentService } from '../../../src/services/AgentService.js';
import { runMigrations } from '../../../src/db/migrator.js';

describe('AgentService', () => {
  let db: Database.Database;
  let service: AgentService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    const queries = new AgentQueries(db);
    service = new AgentService(queries);
  });

  afterEach(() => {
    db.close();
  });

  it('creates an agent and returns public fields', () => {
    const result = service.create({ name: 'TestBot', personality: 'A helpful test bot personality' }, 'session1');
    expect(result.name).toBe('TestBot');
    expect(result.id).toBeDefined();
    expect(result.displayId).toMatch(/^agent_/);
    expect(result.avatarSeed).toBeDefined();
  });

  it('strips HTML from personality', () => {
    const result = service.create(
      { name: 'Safe Bot', personality: 'Hello <script>alert("xss")</script> world personality text' },
      'session1',
    );
    const agent = service.get(result.id);
    expect(agent.personality).not.toContain('<script>');
    expect(agent.personality).toContain('Hello');
  });

  it('lists agents without system_prompt', () => {
    service.create({ name: 'Bot One', personality: 'First bot personality text' }, 'session1');
    service.create({ name: 'Bot Two', personality: 'Second bot personality text' }, 'session1');
    const agents = service.list();
    expect(agents.length).toBe(2);
    for (const a of agents) {
      expect(a).not.toHaveProperty('system_prompt');
    }
  });

  it('deletes agent by creator session', () => {
    const result = service.create({ name: 'Deletable', personality: 'Will be deleted soon enough' }, 'session1');
    expect(service.delete(result.id, 'session1')).toBe(true);
    expect(() => service.get(result.id)).toThrow('not found');
  });

  it('rejects delete from non-creator session', () => {
    const result = service.create({ name: 'Protected', personality: 'Cannot be deleted by others' }, 'session1');
    expect(() => service.delete(result.id, 'session2')).toThrow('Not authorized');
  });

  it('rejects invalid UUID', () => {
    expect(() => service.get('not-a-uuid')).toThrow('Invalid agent ID');
  });

  it('rejects path traversal in ID', () => {
    expect(() => service.get('../../etc/passwd')).toThrow('Invalid agent ID');
  });

  it('parses uploaded file', () => {
    const buffer = Buffer.from('This is a valid personality file with enough content');
    const result = service.parseUploadedFile(buffer, 'text/markdown');
    expect(result.personality).toBe('This is a valid personality file with enough content');
  });

  it('strips HTML from uploaded file', () => {
    const buffer = Buffer.from('Hello <b>bold</b> <script>bad</script> world text personality');
    const result = service.parseUploadedFile(buffer, 'text/plain');
    expect(result.personality).not.toContain('<script>');
    expect(result.personality).not.toContain('<b>');
  });

  it('rejects file over 10KB', () => {
    const buffer = Buffer.alloc(10241, 'a');
    expect(() => service.parseUploadedFile(buffer, 'text/markdown')).toThrow('10KB');
  });
});
