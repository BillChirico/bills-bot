import { describe, expect, it } from 'vitest';
import {
  classifyError,
  ErrorType,
  getSuggestedNextSteps,
  getUserFriendlyMessage,
  isRetryable,
} from '../src/utils/errors.js';

describe('errors', () => {
  describe('ErrorType', () => {
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

  describe('classifyError()', () => {
    it('should return UNKNOWN for null/undefined error', () => {
      expect(classifyError(null)).toBe(ErrorType.UNKNOWN);
      expect(classifyError(undefined)).toBe(ErrorType.UNKNOWN);
    });

    it('should classify ECONNREFUSED as NETWORK', () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      expect(classifyError(error)).toBe(ErrorType.NETWORK);
    });

    it('should classify ENOTFOUND as NETWORK', () => {
      const error = new Error('Not found');
      error.code = 'ENOTFOUND';
      expect(classifyError(error)).toBe(ErrorType.NETWORK);
    });

    it('should classify ETIMEDOUT as NETWORK (checked first)', () => {
      const error = new Error('Connection timed out');
      error.code = 'ETIMEDOUT';
      // ETIMEDOUT is classified as NETWORK since it's checked in the network section first
      expect(classifyError(error)).toBe(ErrorType.NETWORK);
    });

    it('should classify timeout message as TIMEOUT', () => {
      const error = new Error('Request timeout exceeded');
      expect(classifyError(error)).toBe(ErrorType.TIMEOUT);
    });

    it('should classify fetch failed as NETWORK', () => {
      const error = new Error('fetch failed');
      expect(classifyError(error)).toBe(ErrorType.NETWORK);
    });

    it('should classify network error message as NETWORK', () => {
      const error = new Error('Network error occurred');
      expect(classifyError(error)).toBe(ErrorType.NETWORK);
    });

    it('should classify 401 status as API_UNAUTHORIZED', () => {
      const error = new Error('Unauthorized');
      error.status = 401;
      expect(classifyError(error)).toBe(ErrorType.API_UNAUTHORIZED);
    });

    it('should classify 403 status as API_UNAUTHORIZED', () => {
      const error = new Error('Forbidden');
      expect(classifyError(error, { status: 403 })).toBe(ErrorType.API_UNAUTHORIZED);
    });

    it('should classify 404 status as API_NOT_FOUND', () => {
      const error = new Error('Not found');
      expect(classifyError(error, { statusCode: 404 })).toBe(ErrorType.API_NOT_FOUND);
    });

    it('should classify 429 status as API_RATE_LIMIT', () => {
      const error = new Error('Too many requests');
      error.status = 429;
      expect(classifyError(error)).toBe(ErrorType.API_RATE_LIMIT);
    });

    it('should classify 500+ status as API_SERVER_ERROR', () => {
      const error = new Error('Server error');
      error.status = 500;
      expect(classifyError(error)).toBe(ErrorType.API_SERVER_ERROR);

      error.status = 503;
      expect(classifyError(error)).toBe(ErrorType.API_SERVER_ERROR);
    });

    it('should classify 400-499 status as API_ERROR', () => {
      const error = new Error('Bad request');
      error.status = 400;
      expect(classifyError(error)).toBe(ErrorType.API_ERROR);
    });

    it('should classify Discord missing access error', () => {
      const error = new Error('Missing Access');
      error.code = 50001;
      expect(classifyError(error)).toBe(ErrorType.DISCORD_MISSING_ACCESS);
    });

    it('should classify Discord missing permissions error', () => {
      const error = new Error('Missing Permissions');
      error.code = 50013;
      expect(classifyError(error)).toBe(ErrorType.DISCORD_PERMISSION);
    });

    it('should classify Discord unknown channel error', () => {
      const error = new Error('Unknown Channel');
      error.code = 10003;
      expect(classifyError(error)).toBe(ErrorType.DISCORD_CHANNEL_NOT_FOUND);
    });

    it('should classify config.json not found as CONFIG_MISSING', () => {
      const error = new Error('config.json not found');
      expect(classifyError(error)).toBe(ErrorType.CONFIG_MISSING);
    });

    it('should classify ENOENT as CONFIG_MISSING', () => {
      const error = new Error('ENOENT: no such file');
      expect(classifyError(error)).toBe(ErrorType.CONFIG_MISSING);
    });

    it('should classify invalid config as CONFIG_INVALID', () => {
      const error = new Error('Invalid config file');
      expect(classifyError(error)).toBe(ErrorType.CONFIG_INVALID);
    });

    it('should classify API error from context', () => {
      const error = new Error('Something went wrong');
      expect(classifyError(error, { isApiError: true })).toBe(ErrorType.API_ERROR);
    });

    it('should classify generic API error message', () => {
      const error = new Error('API error occurred');
      expect(classifyError(error)).toBe(ErrorType.API_ERROR);
    });

    it('should return UNKNOWN for unrecognized errors', () => {
      const error = new Error('Something completely different');
      expect(classifyError(error)).toBe(ErrorType.UNKNOWN);
    });
  });

  describe('getUserFriendlyMessage()', () => {
    it('should return message for NETWORK error', () => {
      const error = new Error('fetch failed');
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('trouble connecting');
    });

    it('should return message for TIMEOUT error', () => {
      const error = new Error('timeout');
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('too long');
    });

    it('should return message for API_RATE_LIMIT', () => {
      const error = new Error('Too many requests');
      error.status = 429;
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('too many requests');
    });

    it('should return message for API_UNAUTHORIZED', () => {
      const error = new Error('Unauthorized');
      error.status = 401;
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('authentication');
    });

    it('should return message for API_NOT_FOUND', () => {
      const error = new Error('Not found');
      error.status = 404;
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('endpoint');
    });

    it('should return message for API_SERVER_ERROR', () => {
      const error = new Error('Server error');
      error.status = 500;
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('technical difficulties');
    });

    it('should return message for API_ERROR', () => {
      const error = new Error('Bad request');
      error.status = 400;
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('went wrong');
    });

    it('should return message for DISCORD_PERMISSION', () => {
      const error = new Error('Missing Permissions');
      error.code = 50013;
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('permission');
    });

    it('should return message for DISCORD_CHANNEL_NOT_FOUND', () => {
      const error = new Error('Unknown Channel');
      error.code = 10003;
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('channel');
    });

    it('should return message for DISCORD_MISSING_ACCESS', () => {
      const error = new Error('Missing Access');
      error.code = 50001;
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('access');
    });

    it('should return message for CONFIG_MISSING', () => {
      const error = new Error('config.json not found');
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('Configuration');
    });

    it('should return message for CONFIG_INVALID', () => {
      const error = new Error('Invalid config');
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('errors');
    });

    it('should return message for UNKNOWN error', () => {
      const error = new Error('Unknown');
      const message = getUserFriendlyMessage(error);
      expect(message).toContain('unexpected');
    });
  });

  describe('getSuggestedNextSteps()', () => {
    it('should return suggestion for NETWORK error', () => {
      const error = new Error('fetch failed');
      const suggestion = getSuggestedNextSteps(error);
      expect(suggestion).toContain('OpenClaw');
    });

    it('should return suggestion for TIMEOUT error', () => {
      const error = new Error('timeout');
      const suggestion = getSuggestedNextSteps(error);
      expect(suggestion).toContain('shorter');
    });

    it('should return suggestion for API_RATE_LIMIT', () => {
      const error = new Error('Too many requests');
      error.status = 429;
      const suggestion = getSuggestedNextSteps(error);
      expect(suggestion).toContain('60 seconds');
    });

    it('should return suggestion for API_UNAUTHORIZED', () => {
      const error = new Error('Unauthorized');
      error.status = 401;
      const suggestion = getSuggestedNextSteps(error);
      expect(suggestion).toContain('OPENCLAW_API_KEY');
    });

    it('should return suggestion for API_NOT_FOUND', () => {
      const error = new Error('Not found');
      error.status = 404;
      const suggestion = getSuggestedNextSteps(error);
      expect(suggestion).toContain('OPENCLAW_API_URL');
    });

    it('should return suggestion for API_SERVER_ERROR', () => {
      const error = new Error('Server error');
      error.status = 500;
      const suggestion = getSuggestedNextSteps(error);
      expect(suggestion).toContain('restart');
    });

    it('should return suggestion for DISCORD_PERMISSION', () => {
      const error = new Error('Missing Permissions');
      error.code = 50013;
      const suggestion = getSuggestedNextSteps(error);
      expect(suggestion).toContain('permissions');
    });

    it('should return suggestion for DISCORD_CHANNEL_NOT_FOUND', () => {
      const error = new Error('Unknown Channel');
      error.code = 10003;
      const suggestion = getSuggestedNextSteps(error);
      expect(suggestion).toContain('channel ID');
    });

    it('should return suggestion for DISCORD_MISSING_ACCESS', () => {
      const error = new Error('Missing Access');
      error.code = 50001;
      const suggestion = getSuggestedNextSteps(error);
      expect(suggestion).toContain('channels');
    });

    it('should return suggestion for CONFIG_MISSING', () => {
      const error = new Error('config.json not found');
      const suggestion = getSuggestedNextSteps(error);
      expect(suggestion).toContain('config.json');
    });

    it('should return suggestion for CONFIG_INVALID', () => {
      const error = new Error('Invalid config');
      const suggestion = getSuggestedNextSteps(error);
      expect(suggestion).toContain('JSON');
    });

    it('should return null for UNKNOWN error', () => {
      const error = new Error('Unknown');
      const suggestion = getSuggestedNextSteps(error);
      expect(suggestion).toBeNull();
    });
  });

  describe('isRetryable()', () => {
    it('should return true for NETWORK errors', () => {
      const error = new Error('fetch failed');
      expect(isRetryable(error)).toBe(true);
    });

    it('should return true for TIMEOUT errors', () => {
      const error = new Error('timeout');
      expect(isRetryable(error)).toBe(true);
    });

    it('should return true for API_SERVER_ERROR', () => {
      const error = new Error('Server error');
      error.status = 500;
      expect(isRetryable(error)).toBe(true);
    });

    it('should return true for API_RATE_LIMIT', () => {
      const error = new Error('Too many requests');
      error.status = 429;
      expect(isRetryable(error)).toBe(true);
    });

    it('should return false for API_UNAUTHORIZED', () => {
      const error = new Error('Unauthorized');
      error.status = 401;
      expect(isRetryable(error)).toBe(false);
    });

    it('should return false for DISCORD_PERMISSION', () => {
      const error = new Error('Missing Permissions');
      error.code = 50013;
      expect(isRetryable(error)).toBe(false);
    });

    it('should return false for CONFIG_MISSING', () => {
      const error = new Error('config.json not found');
      expect(isRetryable(error)).toBe(false);
    });

    it('should return false for UNKNOWN', () => {
      const error = new Error('Unknown error');
      expect(isRetryable(error)).toBe(false);
    });
  });
});
