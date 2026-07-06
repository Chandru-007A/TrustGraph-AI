// src/engine/ai/mock.provider.ts
import { IAIProvider, AIRequest, AIResponse } from './interfaces';
import logger from '../../utils/logger';

export class MockAIProvider implements IAIProvider {
  async generate(request: AIRequest): Promise<AIResponse> {
    logger.debug('[MockAIProvider] Generating mock response...');
    
    // Simulate network delay
    await new Promise(r => setTimeout(r, 150));

    // For mock, we simply try to construct a dummy JSON object if JSON format is requested
    // The actual agents in Mock mode previously returned typed objects directly,
    // so this mock provider is a generalized fallback if used in the new agents.
    
    // But since the real agents expect JSON strings to parse, we must return a string.
    let content = '';
    
    if (request.responseFormat === 'json_object') {
      content = JSON.stringify({ mock: true, message: "Mock response fallback" });
    } else {
      content = "Mock text response fallback";
    }

    return {
      content,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      latencyMs: 150,
      finishReason: 'stop',
    };
  }
}
