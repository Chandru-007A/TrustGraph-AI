// src/engine/ai/openai.provider.ts
import OpenAI from 'openai';
import { IAIProvider, AIProviderConfig, AIRequest, AIResponse } from './interfaces';
import logger from '../../utils/logger';

export class OpenAIProvider implements IAIProvider {
  private client: OpenAI;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeoutMs,
    });
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt }
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        response_format: request.responseFormat === 'json_object' ? { type: 'json_object' } : { type: 'text' },
      });

      const latencyMs = Date.now() - startTime;
      const choice = response.choices[0];

      return {
        content: choice.message.content || '',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        latencyMs,
        finishReason: choice.finish_reason,
      };
    } catch (error: any) {
      logger.error(`[OpenAIProvider] Generation failed: ${error.message}`);
      throw error;
    }
  }
}
