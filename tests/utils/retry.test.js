import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRetryWrapper, withRetry } from '../../src/utils/retry.js';

describe('retry', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useRealTimers();
	});

	describe('withRetry', () => {
		it('should return result on successful first attempt', async () => {
			const fn = vi.fn(async () => 'success');
			const result = await withRetry(fn);
			expect(result).toBe('success');
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should retry on retryable error', async () => {
			vi.useFakeTimers();
			let attempts = 0;
			const fn = vi.fn(async () => {
				attempts++;
				if (attempts < 2) {
					const err = new Error('timeout');
					throw err;
				}
				return 'success';
			});

			const promise = withRetry(fn, { baseDelay: 100, maxRetries: 2 });

			// Fast-forward through delays
			await vi.runAllTimersAsync();

			const result = await promise;
			expect(result).toBe('success');
			expect(fn).toHaveBeenCalledTimes(2);
			vi.useRealTimers();
		});

		it('should respect maxRetries limit', async () => {
			vi.useFakeTimers();
			const fn = vi.fn(async () => {
				const err = new Error('network error');
				err.code = 'ECONNREFUSED';
				throw err;
			});

			vi.spyOn(global, 'setTimeout').mockImplementation((fn) => {
				Promise.resolve().then(fn);
				return 1;
			});

			try {
				await withRetry(fn, { maxRetries: 2, baseDelay: 10 });
			} catch (err) {
				// Expected to fail
			}
			expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
			vi.useRealTimers();
		});

		it('should not retry non-retryable errors', async () => {
			const fn = vi.fn(async () => {
				const err = new Error('Invalid config');
				throw err;
			});

			await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow('Invalid config');
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should use exponential backoff', async () => {
			vi.useFakeTimers();
			const delays = [];

			// Mock sleep to capture delays without actually waiting
			vi.spyOn(global, 'setTimeout').mockImplementation((fn, delay) => {
				if (delay > 0) delays.push(delay);
				// Execute immediately
				Promise.resolve().then(fn);
				return 1;
			});

			const fn = vi.fn(async () => {
				const err = new Error('timeout');
				throw err;
			});

			try {
				await withRetry(fn, { maxRetries: 3, baseDelay: 100 });
			} catch (err) {
				// Expected to fail
			}

			// Exponential backoff: 100, 200, 400
			expect(delays.length).toBeGreaterThan(0);
			expect(delays[0]).toBe(100);
			expect(delays[1]).toBe(200);
			expect(delays[2]).toBe(400);

			vi.useRealTimers();
		});

		it('should cap delay at maxDelay', async () => {
			vi.useFakeTimers();
			const delays = [];

			vi.spyOn(global, 'setTimeout').mockImplementation((fn, delay) => {
				if (delay > 0) delays.push(delay);
				Promise.resolve().then(fn);
				return 1;
			});

			const fn = vi.fn(async () => {
				const err = new Error('timeout');
				throw err;
			});

			try {
				await withRetry(fn, {
					maxRetries: 3,
					baseDelay: 100,
					maxDelay: 250,
				});
			} catch (err) {
				// Expected to fail
			}

			// Should cap at maxDelay
			for (const delay of delays) {
				expect(delay).toBeLessThanOrEqual(250);
			}

			vi.useRealTimers();
		});

		it('should use custom shouldRetry function', async () => {
			vi.useFakeTimers();
			const customRetry = vi.fn(() => true);
			let attempts = 0;
			const fn = vi.fn(async () => {
				attempts++;
				if (attempts < 2) {
					throw new Error('custom error');
				}
				return 'success';
			});

			const promise = withRetry(fn, {
				maxRetries: 2,
				baseDelay: 10,
				shouldRetry: customRetry,
			});

			await vi.runAllTimersAsync();

			const result = await promise;
			expect(result).toBe('success');
			expect(customRetry).toHaveBeenCalled();
			vi.useRealTimers();
		});

		it('should pass context to logging', async () => {
			vi.useFakeTimers();
			const fn = vi.fn(async () => {
				const err = new Error('timeout');
				throw err;
			});

			vi.spyOn(global, 'setTimeout').mockImplementation((fn) => {
				Promise.resolve().then(fn);
				return 1;
			});

			try {
				await withRetry(fn, {
					maxRetries: 1,
					baseDelay: 10,
					context: { operation: 'test' },
				});
			} catch (err) {
				// Expected to fail
			}
			vi.useRealTimers();
		});

		it('should handle synchronous errors', async () => {
			const fn = vi.fn(() => {
				throw new Error('sync error');
			});

			await expect(withRetry(fn)).rejects.toThrow('sync error');
		});

		it('should use default options', async () => {
			vi.useFakeTimers();
			const fn = vi.fn(async () => {
				const err = new Error('timeout');
				throw err;
			});

			vi.spyOn(global, 'setTimeout').mockImplementation((fn) => {
				Promise.resolve().then(fn);
				return 1;
			});

			try {
				await withRetry(fn);
			} catch (err) {
				// Expected to fail
			}
			expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries (default)
			vi.useRealTimers();
		});

		it('should handle errors without message', async () => {
			const fn = vi.fn(async () => {
				throw {};
			});

			await expect(withRetry(fn)).rejects.toBeTruthy();
		});
	});

	describe('createRetryWrapper', () => {
		it('should create retry function with default options', async () => {
			const retry = createRetryWrapper({ maxRetries: 1, baseDelay: 10 });
			const fn = vi.fn(async () => 'success');
			const result = await retry(fn);
			expect(result).toBe('success');
		});

		it('should allow overriding default options', async () => {
			vi.useFakeTimers();
			const retry = createRetryWrapper({ maxRetries: 1 });
			const fn = vi.fn(async () => {
				const err = new Error('timeout');
				throw err;
			});

			vi.spyOn(global, 'setTimeout').mockImplementation((fn) => {
				Promise.resolve().then(fn);
				return 1;
			});

			try {
				await retry(fn, { maxRetries: 2, baseDelay: 10 });
			} catch (err) {
				// Expected to fail
			}
			expect(fn).toHaveBeenCalledTimes(3); // Override maxRetries: 2
			vi.useRealTimers();
		});

		it('should merge options correctly', async () => {
			vi.useFakeTimers();
			const retry = createRetryWrapper({ baseDelay: 100, maxDelay: 200 });
			let attempts = 0;
			const fn = vi.fn(async () => {
				attempts++;
				if (attempts < 2) {
					const err = new Error('timeout');
					throw err;
				}
				return 'success';
			});

			const promise = retry(fn, { maxRetries: 2 });

			await vi.runAllTimersAsync();

			const result = await promise;
			expect(result).toBe('success');
			vi.useRealTimers();
		});

		it('should create independent retry wrappers', async () => {
			const retry1 = createRetryWrapper({ maxRetries: 1 });
			const retry2 = createRetryWrapper({ maxRetries: 2 });

			expect(retry1).not.toBe(retry2);
		});
	});

	describe('edge cases', () => {
		it('should handle zero maxRetries', async () => {
			const fn = vi.fn(async () => {
				throw new Error('fail');
			});

			await expect(withRetry(fn, { maxRetries: 0 })).rejects.toThrow();
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should handle very large maxRetries', async () => {
			vi.useFakeTimers();
			let attempts = 0;
			const fn = vi.fn(async () => {
				attempts++;
				if (attempts < 3) {
					const err = new Error('timeout');
					throw err;
				}
				return 'success';
			});

			const promise = withRetry(fn, { maxRetries: 100, baseDelay: 1 });

			await vi.runAllTimersAsync();

			const result = await promise;
			expect(result).toBe('success');
			expect(fn).toHaveBeenCalledTimes(3);
			vi.useRealTimers();
		});

		it('should handle baseDelay of 0', async () => {
			vi.useFakeTimers();
			let attempts = 0;
			const fn = vi.fn(async () => {
				attempts++;
				if (attempts < 2) {
					const err = new Error('timeout');
					throw err;
				}
				return 'success';
			});

			const promise = withRetry(fn, { maxRetries: 1, baseDelay: 0 });

			await vi.runAllTimersAsync();

			const result = await promise;
			expect(result).toBe('success');
			vi.useRealTimers();
		});
	});
});