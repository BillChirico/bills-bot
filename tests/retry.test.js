import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the logger before importing retry module
vi.mock('../src/logger.js', () => ({
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

// Import after mocking
const { createRetryWrapper, withRetry } = await import('../src/utils/retry.js');

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('withRetry()', () => {
    it('should return result on successful first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await withRetry(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const promise = withRetry(fn, { baseDelay: 100, maxRetries: 3 });

      // Fast-forward timers for retry delay
      await vi.runAllTimersAsync();

      const result = await promise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after all retries exhausted', async () => {
      const error = new Error('Network error');
      const fn = vi.fn().mockRejectedValue(error);

      // Create promise and immediately attach catch handler to avoid unhandled rejection
      const promise = withRetry(fn, { maxRetries: 2, baseDelay: 100 }).catch((e) => e);

      await vi.runAllTimersAsync();

      const result = await promise;
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('Network error');
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should not retry non-retryable errors', async () => {
      const error = new Error('Unauthorized');
      error.status = 401;
      const fn = vi.fn().mockRejectedValue(error);

      await expect(withRetry(fn)).rejects.toThrow('Unauthorized');
      expect(fn).toHaveBeenCalledTimes(1); // No retries for auth errors
    });

    it('should respect custom shouldRetry function', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Custom error'));
      const shouldRetry = vi.fn().mockReturnValue(false);

      await expect(withRetry(fn, { shouldRetry })).rejects.toThrow('Custom error');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalled();
    });

    it('should use exponential backoff', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const promise = withRetry(fn, { baseDelay: 1000, maxRetries: 3 });

      // Run all async timers to completion
      await vi.runAllTimersAsync();

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should respect maxDelay cap', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const promise = withRetry(fn, { baseDelay: 50000, maxDelay: 1000, maxRetries: 1 });

      await vi.runAllTimersAsync();

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should pass context to shouldRetry', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Error'));
      const shouldRetry = vi.fn().mockReturnValue(false);
      const context = { operation: 'test' };

      await expect(withRetry(fn, { shouldRetry, context })).rejects.toThrow();
      expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error), context);
    });
  });

  describe('createRetryWrapper()', () => {
    it('should create wrapper with default options', async () => {
      const wrapper = createRetryWrapper({ maxRetries: 1 });
      const fn = vi.fn().mockResolvedValue('success');

      const result = await wrapper(fn);
      expect(result).toBe('success');
    });

    it('should allow overriding default options', async () => {
      const wrapper = createRetryWrapper({ maxRetries: 5 });
      const fn = vi.fn().mockResolvedValue('success');

      const result = await wrapper(fn, { maxRetries: 1 });
      expect(result).toBe('success');
    });
  });
});
