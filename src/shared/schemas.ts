import { z } from 'zod';

export const AgentCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name must be 50 characters or less')
    .regex(/^[\w\s\-'.]+$/, 'Name contains invalid characters'),
  personality: z
    .string()
    .min(10, 'Personality must be at least 10 characters')
    .max(5000, 'Personality must be 5000 characters or less'),
});

export type AgentCreateInput = z.infer<typeof AgentCreateSchema>;

export const GameCreateSchema = z.object({
  agents: z.array(z.string().uuid('Each agent must be a valid UUID')).min(2, 'At least 2 agents required').max(16, 'Maximum 16 agents'),
  mode: z.enum(['elimination', 'round_robin']),
  visibility: z.enum(['public', 'private']).default('public'),
});

export type GameCreateInput = z.infer<typeof GameCreateSchema>;

export const AgentIdSchema = z.string().uuid('Invalid agent ID format');

export const GameIdSchema = z.string().uuid('Invalid game ID format');

export const UUIDParamSchema = z.string().uuid('Invalid ID format');

export const FileUploadSchema = z.object({
  originalname: z.string(),
  mimetype: z.enum(['text/markdown', 'text/plain'], {
    errorMap: () => ({ message: 'File must be text/markdown or text/plain' }),
  }),
  size: z.number().max(10240, 'File must be 10KB or less'),
  buffer: z.instanceof(Buffer),
});
