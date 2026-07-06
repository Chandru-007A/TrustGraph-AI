import { AIProviderFactory } from '../../engine/ai/provider.factory';
import { MockAIProvider } from '../../engine/ai/mock.provider';
import { aiCache } from '../../engine/ai/cache';
import { withExponentialBackoff } from '../../engine/ai/retry';
import { AIRequest } from '../../engine/ai/interfaces';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('AI Layer - Provider Switching & Fallback', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should fallback to MockProvider if no API keys are present (AI_PROVIDER=openai)', () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = ''; // Missing
    
    const provider = AIProviderFactory.createProvider();
    expect(provider).toBeInstanceOf(MockAIProvider);
  });

  it('should fallback to MockProvider if no API keys are present (AI_PROVIDER=gemini)', () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = ''; // Missing
    
    const provider = AIProviderFactory.createProvider();
    expect(provider).toBeInstanceOf(MockAIProvider);
  });

  it('should initialize OpenAIProvider if OPENAI_API_KEY is present', () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-mock-key';
    
    const provider = AIProviderFactory.createProvider();
    expect(provider.constructor.name).toBe('OpenAIProvider');
  });

  it('should initialize GeminiProvider if GEMINI_API_KEY is present', () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'mock-gemini-key';
    
    const provider = AIProviderFactory.createProvider();
    expect(provider.constructor.name).toBe('GeminiProvider');
  });
});

describe('AI Layer - Caching', () => {
  beforeEach(() => {
    aiCache.clear();
  });

  it('should cache deterministic requests', () => {
    const request: AIRequest = {
      systemPrompt: 'System',
      userPrompt: 'User',
      responseFormat: 'json_object'
    };

    const mockResponse = {
      content: '{"hello": "world"}',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      latencyMs: 10,
      finishReason: 'stop'
    };

    expect(aiCache.get(request)).toBeNull();
    aiCache.set(request, mockResponse);
    expect(aiCache.get(request)).toEqual(mockResponse);
  });

  it('should differentiate different requests', () => {
    const r1: AIRequest = { systemPrompt: 'System', userPrompt: 'User', responseFormat: 'text' };
    const r2: AIRequest = { systemPrompt: 'System2', userPrompt: 'User', responseFormat: 'text' };

    aiCache.set(r1, { content: 'test', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, latencyMs: 10, finishReason: 'stop' });
    expect(aiCache.get(r2)).toBeNull();
  });
});

describe('AI Layer - Retry Logic', () => {
  it('should return successfully on first try', async () => {
    const op = vi.fn().mockResolvedValue('success');
    const result = await withExponentialBackoff(op, 3, 'Test');
    expect(result).toBe('success');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    let calls = 0;
    const op = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new Error('Fail');
      return 'success';
    });

    const result = await withExponentialBackoff(op, 3, 'Test');
    expect(result).toBe('success');
    expect(op).toHaveBeenCalledTimes(3);
  });
});
