// src/engine/ai/retry.ts
import logger from '../../utils/logger';

/**
 * Executes a promise-returning function with exponential backoff.
 * Backoff: 1s, 2s, 4s, 8s, 16s...
 *
 * @param operation The async function to execute.
 * @param maxRetries Maximum number of retries (default 5).
 * @param contextLabel A label for logging purposes.
 */
export async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 5,
  contextLabel = 'Operation'
): Promise<T> {
  let attempt = 0;
  let delay = 1000; // Start with 1 second

  while (attempt <= maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;
      if (attempt > maxRetries) {
        logger.error(`[RETRY EXHAUSTED] ${contextLabel} failed after ${maxRetries} retries:`, error.message);
        throw error;
      }
      logger.warn(`[RETRY] ${contextLabel} failed (Attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms... Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  throw new Error('Unreachable');
}
