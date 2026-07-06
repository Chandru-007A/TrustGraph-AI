// src/engine/ai/execute.ts
import { IAIProvider, AIRequest, AIResponse } from './interfaces';
import { aiCache } from './cache';
import { withExponentialBackoff } from './retry';
import { MockAIProvider } from './mock.provider';
import { WorkflowContext } from '../interfaces';
import logger from '../../utils/logger';

export async function executeWithFallback(
  provider: IAIProvider,
  request: AIRequest,
  context: Readonly<WorkflowContext>,
  agentName: string
): Promise<AIResponse> {
  const query = context.originalQuery;

  // 1. Check Cache
  const cached = aiCache.get(request);
  if (cached) {
    logger.info(`[${agentName}] Cache hit for query: "${query}"`);
    return cached;
  }

  let response: AIResponse;
  let providerUsed = provider.constructor.name;

  // 2. Execute with Retry
  try {
    response = await withExponentialBackoff(
      () => provider.generate(request),
      5,
      agentName
    );
  } catch (error: any) {
    logger.warn(`[${agentName}] All retries failed with ${providerUsed}. Falling back to MockAIProvider.`);
    const mockProvider = new MockAIProvider();
    providerUsed = 'MockAIProvider';
    // No backoff needed for mock
    response = await mockProvider.generate(request);
  }

  // 3. Cache the response
  aiCache.set(request, response);
  
  // 4. Log and store observability metrics
  logger.debug(`[${agentName}] Token usage: ${response.usage.totalTokens} tokens, Latency: ${response.latencyMs}ms`);

  if (!context.metadata.aiMetrics) {
    context.metadata.aiMetrics = [];
  }
  
  context.metadata.aiMetrics.push({
    stage: agentName,
    provider: providerUsed,
    latencyMs: response.latencyMs,
    promptTokens: response.usage.promptTokens,
    completionTokens: response.usage.completionTokens,
    totalTokens: response.usage.totalTokens,
    finishReason: response.finishReason,
  });

  return response;
}
