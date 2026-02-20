import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_PATH: z.string().default('./data/soulvssoul.db'),
  SESSION_SECRET: z.string().min(32).default('dev-secret-change-me-in-production-please-32chars'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  LLM_PROVIDER: z.enum(['openai', 'anthropic']).default('openai'),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  LLM_TIMEOUT_MS: z.coerce.number().default(15000),
  LLM_MAX_RETRIES: z.coerce.number().default(2),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().default(60),
  ENABLE_AUTH_MAGIC_LINK: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENABLE_AUTH_X_OAUTH: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  // Legacy compat
  OPENAI_API_KEY: z.string().optional(),
  DEFAULT_LLM_PROVIDER: z.enum(['openai', 'anthropic']).optional(),
  ALLOWED_ORIGINS: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    console.error('❌ Invalid configuration:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  const cfg = result.data;
  // Apply legacy fallbacks
  if (!cfg.LLM_API_KEY && cfg.OPENAI_API_KEY) {
    (cfg as Record<string, unknown>).LLM_API_KEY = cfg.OPENAI_API_KEY;
  }
  if (cfg.ALLOWED_ORIGINS && cfg.CORS_ORIGINS === 'http://localhost:3000') {
    (cfg as Record<string, unknown>).CORS_ORIGINS = cfg.ALLOWED_ORIGINS;
  }
  return cfg;
}

export const config = loadConfig();
