/**
 * Tests for src/utils/errors.js
 * Error classification and user-friendly messages
 */

import { describe, expect, it } from 'vitest';
import {
  ErrorType,
  classifyError,
  getUserFriendlyMessage,
  getSuggestedNextSteps,
  isRetryable,
} from '../src/utils/errors.js';

describe('errors utility', () => {
  describe('ErrorType enum', () => {
    it('should export all error types', () => {
      expect(ErrorType.NETWORK).toBe('network');
      expect(ErrorType.TIMEOUT).toBe('timeout');
      expect(ErrorType.API_ERROR).toBe('api_error');
      expect(ErrorType.API_RATE_LIMIT).toBe('api_rate_limit');
      expect(ErrorType.API_UNAUTHORIZED).toBe('api_unauthorized');
      expect(ErrorType.API_NOT_FOUND).toBe('api_not_found');
      expect(ErrorType.API_SERVER_ERROR).toBe('api_server_error');
      expect(ErrorType.DISCORD_PERMISSION).toBe('discord_permission');
      expect(ErrorType.DISCORD_CHANNEL_NOT_FOUND).toBe('discord_channel_not_found');
      expect(ErrorType.DISCORD_MISSING_ACCESS).toBe('discord_missing_access');
      expect(ErrorType.CONFIG_MISSING).toBe('config_missing');
      expect(ErrorType.CONFIG_INVALID).toBe('config_invalid');
      expect(ErrorType.UNKNOWN).toBe('unknown');
    });
  });

  describe('classifyError', () => {
    describe('network errors', () => {
      it('should classify ECONNREFUSED as network error', () => {
        const error = new Error('Connection refused');
        error.code = 'ECONNREFUSED';
        expect(classifyError(error)).toBe(ErrorType.NETWORK);
      });

      it('should classify ENOTFOUND as network error', () => {
        const error = new Error('Host not found');
        error.code = 'ENOTFOUND';
        expect(classifyError(error)).toBe(ErrorType.NETWORK);
      });

      it('should classify fetch failed as network error', () => {
        const error = new Error('fetch failed');
        expect(classifyError(error)).toBe(ErrorType.NETWORK);
      });

      it('should classify network message as network error', () => {
        const error = new Error('network error occurred');
        expect(classifyError(error)).toBe(ErrorType.NETWORK);
      });
    });

    describe('timeout errors', () => {
      it('should classify ETIMEDOUT code as network error (takes priority)', () => {
        const error = new Error('Request timeout');
        error.code = 'ETIMEDOUT';
        // ETIMEDOUT is checked in network errors first, so it returns network type
        expect(classifyError(error)).toBe(ErrorType.NETWORK);
      });

      it('should classify timeout message as timeout', () => {
        const error = new Error('Request timeout exceeded');
        expect(classifyError(error)).toBe(ErrorType.TIMEOUT);
      });
    });

    describe('HTTP status code errors', () => {
      it('should classify 401 as unauthorized', () => {
        const error = new Error('Unauthorized');
        expect(classifyError(error, { status: 401 })).toBe(ErrorType.API_UNAUTHORIZED);
      });

      it('should classify 403 as unauthorized', () => {
        const error = new Error('Forbidden');
        expect(classifyError(error, { status: 403 })).toBe(ErrorType.API_UNAUTHORIZED);
      });

      it('should classify 404 as not found', () => {
        const error = new Error('Not found');
        expect(classifyError(error, { status: 404 })).toBe(ErrorType.API_NOT_FOUND);
      });

      it('should classify 429 as rate limit', () => {
        const error = new Error('Too many requests');
        expect(classifyError(error, { status: 429 })).toBe(ErrorType.API_RATE_LIMIT);
      });

      it('should classify 500 as server error', () => {
        const error = new Error('Internal server error');
        expect(classifyError(error, { status: 500 })).toBe(ErrorType.API_SERVER_ERROR);
      });

      it('should classify 503 as server error', () => {
        const error = new Error('Service unavailable');
        expect(classifyError(error, { status: 503 })).toBe(ErrorType.API_SERVER_ERROR);
      });

      it('should classify 400 as API error', () => {
        const error = new Error('Bad request');
        expect(classifyError(error, { status: 400 })).toBe(ErrorType.API_ERROR);
      });

      it('should use statusCode from context', () => {
        const error = new Error('Error');
        expect(classifyError(error, { statusCode: 404 })).toBe(ErrorType.API_NOT_FOUND);
      });
    });

    describe('Discord errors', () => {
      it('should classify code 50001 as missing access', () => {
        const error = new Error('Missing access');
        error.code = 50001;
        expect(classifyError(error)).toBe(ErrorType.DISCORD_MISSING_ACCESS);
      });

      it('should classify missing access message', () => {
        const error = new Error('Missing access to channel');
        expect(classifyError(error)).toBe(ErrorType.DISCORD_MISSING_ACCESS);
      });

      it('should classify code 50013 as permission error', () => {
        const error = new Error('Missing permissions');
        error.code = 50013;
        expect(classifyError(error)).toBe(ErrorType.DISCORD_PERMISSION);
      });

      it('should classify missing permissions message', () => {
        const error = new Error('Bot missing permissions');
        expect(classifyError(error)).toBe(ErrorType.DISCORD_PERMISSION);
      });

      it('should classify code 10003 as channel not found', () => {
        const error = new Error('Unknown channel');
        error.code = 10003;
        expect(classifyError(error)).toBe(ErrorType.DISCORD_CHANNEL_NOT_FOUND);
      });

      it('should classify unknown channel message', () => {
        const error = new Error('Unknown channel provided');
        expect(classifyError(error)).toBe(ErrorType.DISCORD_CHANNEL_NOT_FOUND);
      });
    });

    describe('config errors', () => {
      it('should classify config.json not found', () => {
        const error = new Error('config.json not found');
        expect(classifyError(error)).toBe(ErrorType.CONFIG_MISSING);
      });

      it('should classify ENOENT as config missing', () => {
        const error = new Error('ENOENT: no such file');
        expect(classifyError(error)).toBe(ErrorType.CONFIG_MISSING);
      });

      it('should classify invalid config message', () => {
        const error = new Error('Invalid config structure');
        expect(classifyError(error)).toBe(ErrorType.CONFIG_INVALID);
      });
    });

    describe('API errors', () => {
      it('should classify API error message', () => {
        const error = new Error('API error occurred');
        expect(classifyError(error)).toBe(ErrorType.API_ERROR);
      });

      it('should classify with isApiError context flag', () => {
        const error = new Error('Something went wrong');
        expect(classifyError(error, { isApiError: true })).toBe(ErrorType.API_ERROR);
      });
    });

    describe('edge cases', () => {
      it('should handle null error', () => {
        expect(classifyError(null)).toBe(ErrorType.UNKNOWN);
      });

      it('should handle undefined error', () => {
        expect(classifyError(undefined)).toBe(ErrorType.UNKNOWN);
      });

      it('should handle error without message', () => {
        const error = new Error();
        expect(classifyError(error)).toBe(ErrorType.UNKNOWN);
      });

      it('should handle unknown error type', () => {
        const error = new Error('Something random happened');
        expect(classifyError(error)).toBe(ErrorType.UNKNOWN);
      });

      it('should handle error with status from error object', () => {
        const error = new Error('API error');
        error.status = 404;
        expect(classifyError(error)).toBe(ErrorType.API_NOT_FOUND);
      });
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return user-friendly message for network error', () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('trouble connecting');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should return user-friendly message for timeout', () => {
      const error = new Error('timeout exceeded');
      // Use message-based timeout detection (not ETIMEDOUT code)
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('took too long');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should return user-friendly message for rate limit', () => {
      const error = new Error('Too many requests');
      const message = getUserFriendlyMessage(error, { status: 429 });
      expect(message).toContain('too many requests');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should return user-friendly message for unauthorized', () => {
      const error = new Error('Unauthorized');
      const message = getUserFriendlyMessage(error, { status: 401 });
      expect(message).toContain('authentication');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should return user-friendly message for config missing', () => {
      const error = new Error('config.json not found');
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('Configuration file not found');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should return user-friendly message for unknown error', () => {
      const error = new Error('Unknown error');
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('unexpected');
      expect(message.length).toBeGreaterThan(0);
    });
  });

  describe('getSuggestedNextSteps', () => {
    it('should return suggestions for network error', () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      const suggestion = getSuggestedNextSteps(error);
      expect(suggestion).toBeTruthy();
      expect(suggestion).toContain('OpenClaw');
    });

    it('should return suggestions for timeout', () => {
      const error = new Error('Timeout');
      error.code = 'ETIMEDOUT';
      const suggestion = getSuggestedNextSteps(error);
      expect(suggestion).toBeTruthy();
      expect(suggestion.length).toBeGreaterThan(0);
    });

    it('should return suggestions for rate limit', () => {
      const error = new Error('Too many requests');
      const suggestion = getSuggestedNextSteps(error, { status: 429 });
      expect(suggestion).toBeTruthy();
      expect(suggestion).toContain('60 seconds');
    });

    it('should return suggestions for unauthorized', () => {
      const error = new Error('Unauthorized');
      const suggestion = getSuggestedNextSteps(error, { status: 401 });
      expect(suggestion).toBeTruthy();
      expect(suggestion).toContain('API');
    });

    it('should return suggestions for config missing', () => {
      const error = new Error('config.json not found');
      const suggestion = getSuggestedNextSteps(error);
      expect(suggestion).toBeTruthy();
      expect(suggestion).toContain('config.json');
    });

    it('should return null for unknown error type', () => {
      const error = new Error('Random error');
      const suggestion = getSuggestedNextSteps(error);
      expect(suggestion).toBeNull();
    });
  });

  describe('isRetryable', () => {
    it('should mark network errors as retryable', () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      expect(isRetryable(error)).toBe(true);
    });

    it('should mark timeout as retryable', () => {
      const error = new Error('timeout exceeded');
      // Use message-based detection for timeout
      expect(isRetryable(error)).toBe(true);
    });

    it('should mark server errors as retryable', () => {
      const error = new Error('Server error');
      expect(isRetryable(error, { status: 500 })).toBe(true);
    });

    it('should mark rate limit as retryable', () => {
      const error = new Error('Too many requests');
      expect(isRetryable(error, { status: 429 })).toBe(true);
    });

    it('should not mark unauthorized as retryable', () => {
      const error = new Error('Unauthorized');
      expect(isRetryable(error, { status: 401 })).toBe(false);
    });

    it('should not mark not found as retryable', () => {
      const error = new Error('Not found');
      expect(isRetryable(error, { status: 404 })).toBe(false);
    });

    it('should not mark config errors as retryable', () => {
      const error = new Error('config.json not found');
      expect(isRetryable(error)).toBe(false);
    });

    it('should not mark Discord permission errors as retryable', () => {
      const error = new Error('Missing permissions');
      error.code = 50013;
      expect(isRetryable(error)).toBe(false);
    });

    it('should not mark unknown errors as retryable', () => {
      const error = new Error('Unknown error');
      expect(isRetryable(error)).toBe(false);
    });
  });
});