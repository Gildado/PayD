/**
 * Executes an asynchronous function with a retry mechanism and exponential backoff.
 * 
 * @param fn - The asynchronous function to execute.
 * @param retries - The maximum number of attempts (default: 3).
 * @param delayMs - The base delay in milliseconds (default: 100).
 * @returns The result of the function execution.
 * @throws The error from the last attempt if all retries fail.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 100
): Promise<T> {
  let attempt = 0;

  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt === retries) {
        throw err;
      }
      
      // Exponential backoff: 2^attempt * delayMs
      const backoffDelay = Math.pow(2, attempt) * delayMs;
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  
  // This line should theoretically never be reached because of the throw above
  throw new Error('Retry mechanism failed');
}
