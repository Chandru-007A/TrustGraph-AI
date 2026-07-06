// src/engine/ai/cache.ts
import crypto from 'crypto';
import { AIRequest, AIResponse } from './interfaces';

/**
 * In-memory prompt cache to prevent identical LLM calls during a single workflow run.
 * In a real distributed system, this would be Redis.
 */
class PromptCache {
  private cache: Map<string, AIResponse> = new Map();

  /**
   * Generates a deterministic hash for a given request.
   */
  private hashRequest(request: AIRequest): string {
    const data = JSON.stringify({
      s: request.systemPrompt,
      u: request.userPrompt,
      f: request.responseFormat,
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  get(request: AIRequest): AIResponse | null {
    const key = this.hashRequest(request);
    return this.cache.get(key) || null;
  }

  set(request: AIRequest, response: AIResponse): void {
    const key = this.hashRequest(request);
    this.cache.set(key, response);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const aiCache = new PromptCache();
