import { logger } from '../logger.js';

interface LLMConfig {
  timeoutMs: number;
  maxRetries: number;
  provider: 'openai' | 'anthropic';
  apiKey?: string;
  model?: string;
}

type CircuitState = 'closed' | 'open' | 'half-open';

export class LLMGateway {
  private circuitState: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 5;
  private readonly resetTimeoutMs = 30000;

  constructor(private config: LLMConfig) {}

  async query(prompt: string, systemPrompt: string): Promise<string> {
    this.checkCircuit();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const result = await this.callWithRetry(prompt, systemPrompt, controller.signal);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  private checkCircuit(): void {
    if (this.circuitState === 'open') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.circuitState = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.circuitState = 'closed';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.circuitState = 'open';
      logger.warn('LLM circuit breaker opened');
    }
  }

  private async callWithRetry(prompt: string, systemPrompt: string, signal: AbortSignal, attempt = 0): Promise<string> {
    try {
      return await this.callLLM(prompt, systemPrompt, signal);
    } catch (err) {
      if (attempt < this.config.maxRetries && this.isRetryable(err)) {
        const delay = Math.min(1000 * 2 ** attempt, 8000);
        await new Promise((r) => setTimeout(r, delay));
        return this.callWithRetry(prompt, systemPrompt, signal, attempt + 1);
      }
      throw err;
    }
  }

  private async callLLM(prompt: string, systemPrompt: string, signal: AbortSignal): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('No LLM API key configured');
    }

    const endpoint =
      this.config.provider === 'anthropic'
        ? 'https://api.anthropic.com/v1/messages'
        : 'https://api.openai.com/v1/chat/completions';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let body: string;

    if (this.config.provider === 'anthropic') {
      headers['x-api-key'] = this.config.apiKey;
      headers['anthropic-version'] = '2023-06-01';
      body = JSON.stringify({
        model: this.config.model ?? 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });
    } else {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      body = JSON.stringify({
        model: this.config.model ?? 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.8,
      });
    }

    const response = await fetch(endpoint, { method: 'POST', headers, body, signal });

    if (!response.ok) {
      const status = response.status;
      throw new LLMError(`HTTP ${status}`, status);
    }

    const data = (await response.json()) as Record<string, unknown>;

    if (this.config.provider === 'anthropic') {
      const content = data['content'] as Array<{ text: string }> | undefined;
      return content?.[0]?.text ?? '';
    }
    const choices = data['choices'] as Array<{ message: { content: string } }> | undefined;
    return choices?.[0]?.message?.content ?? '';
  }

  private isRetryable(err: unknown): boolean {
    if (err instanceof LLMError) {
      return [429, 500, 502, 503].includes(err.statusCode);
    }
    return err instanceof TypeError;
  }
}

export class LLMError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}
