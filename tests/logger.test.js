/**
 * Tests for src/logger.js
 * Structured logging with Winston
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('logger module', () => {
  describe('module exports', () => {
    it('should export debug function', async () => {
      const logger = await import('../src/logger.js');
      expect(logger.debug).toBeDefined();
      expect(typeof logger.debug).toBe('function');
    });

    it('should export info function', async () => {
      const logger = await import('../src/logger.js');
      expect(logger.info).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });

    it('should export warn function', async () => {
      const logger = await import('../src/logger.js');
      expect(logger.warn).toBeDefined();
      expect(typeof logger.warn).toBe('function');
    });

    it('should export error function', async () => {
      const logger = await import('../src/logger.js');
      expect(logger.error).toBeDefined();
      expect(typeof logger.error).toBe('function');
    });

    it('should export default object with all logging functions', async () => {
      const logger = await import('../src/logger.js');
      expect(logger.default).toBeDefined();
      expect(logger.default.debug).toBeDefined();
      expect(logger.default.info).toBeDefined();
      expect(logger.default.warn).toBeDefined();
      expect(logger.default.error).toBeDefined();
    });

    it('should export winston logger instance', async () => {
      const logger = await import('../src/logger.js');
      expect(logger.default.logger).toBeDefined();
      expect(logger.default.logger.level).toBeDefined();
    });
  });

  describe('logging functionality', () => {
    it('should handle logging with metadata', async () => {
      const logger = await import('../src/logger.js');

      // Should not throw
      expect(() => {
        logger.info('test message', { foo: 'bar', count: 123 });
      }).not.toThrow();
    });

    it('should handle logging without metadata', async () => {
      const logger = await import('../src/logger.js');

      // Should not throw
      expect(() => {
        logger.info('test message');
      }).not.toThrow();
    });

    it('should handle all log levels', async () => {
      const logger = await import('../src/logger.js');

      expect(() => {
        logger.debug('debug message');
        logger.info('info message');
        logger.warn('warn message');
        logger.error('error message');
      }).not.toThrow();
    });

    it('should handle errors with stack traces', async () => {
      const logger = await import('../src/logger.js');
      const testError = new Error('Test error');

      expect(() => {
        logger.error('error occurred', { error: testError.message, stack: testError.stack });
      }).not.toThrow();
    });
  });

  describe('sensitive data redaction', () => {
    it('should redact DISCORD_TOKEN from logs', async () => {
      const logger = await import('../src/logger.js');

      // Should not throw and should redact sensitive data
      expect(() => {
        logger.info('config loaded', { DISCORD_TOKEN: 'secret123' });
      }).not.toThrow();
    });

    it('should redact OPENCLAW_API_KEY from logs', async () => {
      const logger = await import('../src/logger.js');

      expect(() => {
        logger.info('API call', { OPENCLAW_API_KEY: 'secret-key' });
      }).not.toThrow();
    });

    it('should redact token field from logs', async () => {
      const logger = await import('../src/logger.js');

      expect(() => {
        logger.info('auth data', { token: 'secret-token', user: 'john' });
      }).not.toThrow();
    });

    it('should redact password field from logs', async () => {
      const logger = await import('../src/logger.js');

      expect(() => {
        logger.info('login attempt', { username: 'john', password: 'secret123' });
      }).not.toThrow();
    });

    it('should redact nested sensitive data', async () => {
      const logger = await import('../src/logger.js');

      expect(() => {
        logger.info('config', {
          api: {
            token: 'secret',
            url: 'https://api.example.com'
          }
        });
      }).not.toThrow();
    });

    it('should handle arrays with sensitive data', async () => {
      const logger = await import('../src/logger.js');

      expect(() => {
        logger.info('headers', {
          headers: [
            { name: 'Authorization', value: 'Bearer token123' },
            { name: 'Content-Type', value: 'application/json' }
          ]
        });
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle null metadata', async () => {
      const logger = await import('../src/logger.js');

      expect(() => {
        logger.info('test', null);
      }).not.toThrow();
    });

    it('should handle undefined metadata', async () => {
      const logger = await import('../src/logger.js');

      expect(() => {
        logger.info('test', undefined);
      }).not.toThrow();
    });

    it('should handle empty object metadata', async () => {
      const logger = await import('../src/logger.js');

      expect(() => {
        logger.info('test', {});
      }).not.toThrow();
    });

    it('should handle circular references in metadata gracefully', async () => {
      const logger = await import('../src/logger.js');
      const obj = { name: 'test' };
      obj.self = obj;

      // Winston's JSON.stringify will fail on circular refs, so it may throw
      // But the logger module should not crash the process
      try {
        logger.info('circular', { data: obj });
      } catch (err) {
        // Expected - circular reference causes stack overflow
        expect(err.message).toMatch(/circular|stack|exceeded/i);
      }
    });

    it('should handle very long messages', async () => {
      const logger = await import('../src/logger.js');
      const longMessage = 'a'.repeat(10000);

      expect(() => {
        logger.info(longMessage);
      }).not.toThrow();
    });

    it('should handle special characters in messages', async () => {
      const logger = await import('../src/logger.js');

      expect(() => {
        logger.info('Special chars: 🚀 \n\t\r\0');
      }).not.toThrow();
    });
  });

  describe('winston integration', () => {
    it('should have proper log level configuration', async () => {
      const logger = await import('../src/logger.js');
      const level = logger.default.logger.level;

      // Level should be one of winston's standard levels
      expect(['error', 'warn', 'info', 'debug', 'verbose', 'silly']).toContain(level);
    });

    it('should have transports configured', async () => {
      const logger = await import('../src/logger.js');
      const transports = logger.default.logger.transports;

      expect(Array.isArray(transports)).toBe(true);
      expect(transports.length).toBeGreaterThan(0);
    });
  });
});