import crypto from 'node:crypto';
import { z } from 'zod';
import { AgentQueries } from '../db/queries/agents.js';
import { ValidationError, NotFoundError, AuthError } from '../shared/errors.js';

export class AgentService {
  constructor(private queries: AgentQueries) {}

  create(input: { name: string; personality: string }, sessionId: string | null) {
    // Sanitize HTML from personality
    const personality = this.stripHtml(input.personality);
    const name = this.stripHtml(input.name);

    const id = crypto.randomUUID();
    const displayId = `agent_${id.slice(0, 4)}`;
    const avatarSeed = crypto.randomBytes(6).toString('hex');
    const systemPrompt = `You are ${name}. ${personality}`;

    this.queries.create({
      id,
      displayId,
      name,
      personality,
      systemPrompt,
      avatarSeed,
      creatorSession: sessionId,
    });

    return {
      id,
      displayId,
      name,
      avatarSeed,
      createdAt: new Date().toISOString(),
    };
  }

  list(limit = 50, offset = 0) {
    return this.queries.listPublic(limit, offset);
  }

  listFiltered(opts: { limit?: number; offset?: number; search?: string; sort?: string; preset?: boolean }) {
    return this.queries.listFiltered(opts);
  }

  get(id: string) {
    this.validateUUID(id);
    const agent = this.queries.getPublic(id);
    if (!agent) throw new NotFoundError('Agent');
    return agent;
  }

  getInternal(id: string) {
    this.validateUUID(id);
    const agent = this.queries.getInternal(id);
    if (!agent) throw new NotFoundError('Agent');
    return agent;
  }

  delete(id: string, sessionId: string) {
    this.validateUUID(id);
    const agent = this.queries.getPublic(id);
    if (!agent) throw new NotFoundError('Agent');
    if (agent.is_preset) throw new AuthError('Cannot delete preset agents');
    const creator = this.queries.getCreatorSession(id);
    if (creator !== sessionId) throw new AuthError('Not authorized to delete this agent');
    return this.queries.delete(id);
  }

  parseUploadedFile(buffer: Buffer, mimetype: string): { personality: string } {
    if (mimetype !== 'text/markdown' && mimetype !== 'text/plain') {
      throw new ValidationError('File must be text/markdown or text/plain');
    }
    if (buffer.length > 10240) {
      throw new ValidationError('File must be 10KB or less');
    }

    let content = buffer.toString('utf-8');
    // Strip HTML/script tags
    content = this.stripHtml(content);

    if (content.length < 10) {
      throw new ValidationError('File content too short (min 10 characters)');
    }

    return { personality: content };
  }

  private stripHtml(input: string): string {
    return input.replace(/<[^>]*>/g, '').trim();
  }

  private validateUUID(id: string): void {
    const result = z.string().uuid().safeParse(id);
    if (!result.success) {
      throw new ValidationError('Invalid agent ID format');
    }
    // Belt-and-suspenders: reject path separators
    if (id.includes('/') || id.includes('\\') || id.includes('..')) {
      throw new ValidationError('Invalid agent ID format');
    }
  }
}
