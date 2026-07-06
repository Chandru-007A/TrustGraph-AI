// src/engine/ai/provider.factory.ts
import { IAIProvider, AIProviderConfig } from './interfaces';
import { OpenAIProvider } from './openai.provider';
import { GeminiProvider } from './gemini.provider';
import { MockAIProvider } from './mock.provider';
import logger from '../../utils/logger';

export class AIProviderFactory {
  static createProvider(): IAIProvider {
    const providerType = process.env.AI_PROVIDER || 'mock';
    const temperature = parseFloat(process.env.AI_TEMPERATURE || '0.3');
    const maxTokens = parseInt(process.env.AI_MAX_TOKENS || '2048', 10);
    const timeoutMs = parseInt(process.env.AI_TIMEOUT_MS || '30000', 10);

    if (providerType === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey) {
        logger.info('[AIProviderFactory] Initializing OpenAI Provider');
        return new OpenAIProvider({
          apiKey,
          model: process.env.OPENAI_MODEL || 'gpt-4o',
          temperature,
          maxTokens,
          timeoutMs,
        });
      }
      logger.warn('[AIProviderFactory] OpenAI requested but missing OPENAI_API_KEY. Falling back to Mock.');
    }

    if (providerType === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        logger.info('[AIProviderFactory] Initializing Gemini Provider');
        return new GeminiProvider({
          apiKey,
          model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
          temperature,
          maxTokens,
          timeoutMs,
        });
      }
      logger.warn('[AIProviderFactory] Gemini requested but missing GEMINI_API_KEY. Falling back to Mock.');
    }

    // Default fallback
    logger.info('[AIProviderFactory] Initializing Mock Provider (Fallback)');
    return new MockAIProvider();
  }
}
