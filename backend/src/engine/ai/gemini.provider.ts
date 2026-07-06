// src/engine/ai/gemini.provider.ts
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { IAIProvider, AIProviderConfig, AIRequest, AIResponse } from './interfaces';
import logger from '../../utils/logger';

export class GeminiProvider implements IAIProvider {
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(config: AIProviderConfig) {
    if (!config.apiKey) {
      throw new Error('Gemini API key is required');
    }
    this.client = new GoogleGenerativeAI(config.apiKey);
    
    // For json output in gemini we use responseMimeType
    this.model = this.client.getGenerativeModel({
      model: config.model,
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
      },
    });
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      const isJson = request.responseFormat === 'json_object';
      const prompt = `${request.systemPrompt}\n\n${request.userPrompt}`;
      
      const generationConfig: any = {};
      if (isJson) {
        generationConfig.responseMimeType = 'application/json';
      }

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: isJson ? generationConfig : undefined,
      });

      const response = result.response;
      const text = response.text();
      
      const latencyMs = Date.now() - startTime;

      // Gemini does not provide exact token usage in the same way via simple generateContent
      // sometimes it's in response.usageMetadata, but we can approximate if missing
      const promptTokens = response.usageMetadata?.promptTokenCount || 0;
      const completionTokens = response.usageMetadata?.candidatesTokenCount || 0;
      const totalTokens = response.usageMetadata?.totalTokenCount || (promptTokens + completionTokens);

      return {
        content: text,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
        },
        latencyMs,
        finishReason: response.candidates?.[0]?.finishReason || 'stop',
      };
    } catch (error: any) {
      logger.error(`[GeminiProvider] Generation failed: ${error.message}`);
      throw error;
    }
  }
}
