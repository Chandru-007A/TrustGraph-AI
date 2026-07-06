// src/engine/ai/interfaces.ts
import { WorkflowContext } from '../interfaces';

export interface AIProviderConfig {
  apiKey?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

export interface AIRequest {
  systemPrompt: string;
  userPrompt: string;
  context?: Readonly<WorkflowContext>;
  responseFormat?: 'text' | 'json_object';
}

export interface AIResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  finishReason: string;
}

export interface IAIProvider {
  /**
   * Generates a structured response from the LLM.
   */
  generate(request: AIRequest): Promise<AIResponse>;
}
