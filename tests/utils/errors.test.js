import { describe, expect, it } from 'vitest';
import {
	ErrorType,
	classifyError,
	getSuggestedNextSteps,
	getUserFriendlyMessage,
	isRetryable,
} from '../../src/utils/errors.js';

describe('errors', () => {
	describe('ErrorType enum', () => {
		it('should have all expected error types', () => {
			expect(ErrorType.NETWORK).toBe('network');
			expect(ErrorType.TIMEOUT).toBe('timeout');
			expect(ErrorType.API_ERROR).toBe('api_error');
			expect(ErrorType.API_RATE_LIMIT).toBe('api_rate_limit');
			expect(ErrorType.UNKNOWN).toBe('unknown');
		});
	});

	describe('classifyError', () => {
		it('should classify network errors by code', () => {
			const err = new Error('Connection failed');
			err.code = 'ECONNREFUSED';
			expect(classifyError(err)).toBe(ErrorType.NETWORK);
		});

		it('should classify timeout errors', () => {
			const err = new Error('Request timeout');
			err.code = 'ETIMEDOUT';
			// Note: ETIMEDOUT is checked first as network error in the code
			expect(classifyError(err)).toBe(ErrorType.NETWORK);
		});

		it('should classify timeout by message', () => {
			const err = new Error('Operation timeout occurred');
			expect(classifyError(err)).toBe(ErrorType.TIMEOUT);
		});

		it('should classify 401 as unauthorized', () => {
			const err = new Error('Unauthorized');
			expect(classifyError(err, { status: 401 })).toBe(ErrorType.API_UNAUTHORIZED);
		});

		it('should classify 403 as unauthorized', () => {
			const err = new Error('Forbidden');
			expect(classifyError(err, { status: 403 })).toBe(ErrorType.API_UNAUTHORIZED);
		});

		it('should classify 404 as not found', () => {
			const err = new Error('Not found');
			expect(classifyError(err, { status: 404 })).toBe(ErrorType.API_NOT_FOUND);
		});

		it('should classify 429 as rate limit', () => {
			const err = new Error('Too many requests');
			expect(classifyError(err, { status: 429 })).toBe(ErrorType.API_RATE_LIMIT);
		});

		it('should classify 500+ as server error', () => {
			const err = new Error('Internal server error');
			expect(classifyError(err, { status: 500 })).toBe(ErrorType.API_SERVER_ERROR);
			expect(classifyError(err, { status: 502 })).toBe(ErrorType.API_SERVER_ERROR);
			expect(classifyError(err, { status: 503 })).toBe(ErrorType.API_SERVER_ERROR);
		});

		it('should classify 400-499 as API error', () => {
			const err = new Error('Bad request');
			expect(classifyError(err, { status: 400 })).toBe(ErrorType.API_ERROR);
		});

		it('should classify Discord permission errors', () => {
			const err = new Error('Missing permissions');
			err.code = 50013;
			expect(classifyError(err)).toBe(ErrorType.DISCORD_PERMISSION);
		});

		it('should classify Discord channel not found', () => {
			const err = new Error('Unknown channel');
			err.code = 10003;
			expect(classifyError(err)).toBe(ErrorType.DISCORD_CHANNEL_NOT_FOUND);
		});

		it('should classify Discord missing access', () => {
			const err = new Error('Missing access');
			err.code = 50001;
			expect(classifyError(err)).toBe(ErrorType.DISCORD_MISSING_ACCESS);
		});

		it('should classify config missing errors', () => {
			const err = new Error('config.json not found');
			expect(classifyError(err)).toBe(ErrorType.CONFIG_MISSING);
		});

		it('should classify config invalid errors', () => {
			const err = new Error('Invalid config syntax');
			expect(classifyError(err)).toBe(ErrorType.CONFIG_INVALID);
		});

		it('should classify network errors by message', () => {
			const err = new Error('fetch failed');
			expect(classifyError(err)).toBe(ErrorType.NETWORK);
		});

		it('should classify API errors by message', () => {
			const err = new Error('API error occurred');
			expect(classifyError(err)).toBe(ErrorType.API_ERROR);
		});

		it('should return UNKNOWN for unclassifiable errors', () => {
			const err = new Error('Something weird happened');
			expect(classifyError(err)).toBe(ErrorType.UNKNOWN);
		});

		it('should handle null error', () => {
			expect(classifyError(null)).toBe(ErrorType.UNKNOWN);
		});

		it('should handle error without message', () => {
			const err = {};
			expect(classifyError(err)).toBe(ErrorType.UNKNOWN);
		});

		it('should check statusCode in context', () => {
			const err = new Error('Server error');
			expect(classifyError(err, { statusCode: 500 })).toBe(ErrorType.API_SERVER_ERROR);
		});

		it('should prioritize error.status over context.status', () => {
			const err = new Error('Conflict');
			err.status = 500;
			expect(classifyError(err, { status: 200 })).toBe(ErrorType.API_SERVER_ERROR);
		});
	});

	describe('getUserFriendlyMessage', () => {
		it('should return message for network errors', () => {
			const err = new Error('ECONNREFUSED');
			err.code = 'ECONNREFUSED';
			const message = getUserFriendlyMessage(err);
			expect(message).toContain('trouble connecting');
		});

		it('should return message for timeout errors', () => {
			const err = new Error('timeout');
			const message = getUserFriendlyMessage(err);
			expect(message).toContain('took too long');
		});

		it('should return message for rate limit errors', () => {
			const err = new Error('Rate limited');
			const message = getUserFriendlyMessage(err, { status: 429 });
			expect(message).toContain('too many requests');
		});

		it('should return message for unauthorized errors', () => {
			const err = new Error('Unauthorized');
			const message = getUserFriendlyMessage(err, { status: 401 });
			expect(message).toContain('authentication');
		});

		it('should return message for unknown errors', () => {
			const err = new Error('Mystery error');
			const message = getUserFriendlyMessage(err);
			expect(message).toContain('unexpected');
		});

		it('should return message for all error types', () => {
			for (const errorType of Object.values(ErrorType)) {
				const err = new Error(errorType);
				const message = getUserFriendlyMessage(err);
				expect(message).toBeTruthy();
				expect(typeof message).toBe('string');
			}
		});
	});

	describe('getSuggestedNextSteps', () => {
		it('should return suggestions for network errors', () => {
			const err = new Error('ECONNREFUSED');
			err.code = 'ECONNREFUSED';
			const suggestion = getSuggestedNextSteps(err);
			expect(suggestion).toContain('AI service');
		});

		it('should return suggestions for unauthorized errors', () => {
			const err = new Error('Unauthorized');
			const suggestion = getSuggestedNextSteps(err, { status: 401 });
			expect(suggestion).toContain('API');
		});

		it('should return null for unknown errors', () => {
			const err = new Error('Mystery');
			const suggestion = getSuggestedNextSteps(err);
			expect(suggestion).toBeNull();
		});

		it('should return suggestions for config errors', () => {
			const err = new Error('config.json not found');
			const suggestion = getSuggestedNextSteps(err);
			expect(suggestion).toContain('config.json');
		});

		it('should return suggestions for Discord permission errors', () => {
			const err = new Error('Missing permissions');
			err.code = 50013;
			const suggestion = getSuggestedNextSteps(err);
			expect(suggestion).toContain('permission');
		});
	});

	describe('isRetryable', () => {
		it('should mark network errors as retryable', () => {
			const err = new Error('ECONNREFUSED');
			err.code = 'ECONNREFUSED';
			expect(isRetryable(err)).toBe(true);
		});

		it('should mark timeout errors as retryable', () => {
			const err = new Error('timeout');
			expect(isRetryable(err)).toBe(true);
		});

		it('should mark server errors as retryable', () => {
			const err = new Error('Server error');
			expect(isRetryable(err, { status: 500 })).toBe(true);
		});

		it('should mark rate limits as retryable', () => {
			const err = new Error('Rate limit');
			expect(isRetryable(err, { status: 429 })).toBe(true);
		});

		it('should not mark unauthorized as retryable', () => {
			const err = new Error('Unauthorized');
			expect(isRetryable(err, { status: 401 })).toBe(false);
		});

		it('should not mark not found as retryable', () => {
			const err = new Error('Not found');
			expect(isRetryable(err, { status: 404 })).toBe(false);
		});

		it('should not mark config errors as retryable', () => {
			const err = new Error('config.json not found');
			expect(isRetryable(err)).toBe(false);
		});

		it('should not mark Discord permission errors as retryable', () => {
			const err = new Error('Missing permissions');
			err.code = 50013;
			expect(isRetryable(err)).toBe(false);
		});

		it('should not mark unknown errors as retryable', () => {
			const err = new Error('Mystery error');
			expect(isRetryable(err)).toBe(false);
		});
	});
});