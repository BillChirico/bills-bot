import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthMonitor } from '../src/utils/health.js';

describe('HealthMonitor', () => {
  let monitor;

  beforeEach(() => {
    // Reset singleton for each test
    HealthMonitor.instance = null;
    monitor = HealthMonitor.getInstance();
  });

  afterEach(() => {
    // Clean up singleton
    HealthMonitor.instance = null;
  });

  describe('getInstance()', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = HealthMonitor.getInstance();
      const instance2 = HealthMonitor.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should throw when constructed directly after instance exists', () => {
      HealthMonitor.getInstance();
      expect(() => new HealthMonitor()).toThrow('Use HealthMonitor.getInstance()');
    });
  });

  describe('recordStart()', () => {
    it('should update start time', () => {
      const before = Date.now();
      monitor.recordStart();
      const after = Date.now();

      expect(monitor.startTime).toBeGreaterThanOrEqual(before);
      expect(monitor.startTime).toBeLessThanOrEqual(after);
    });
  });

  describe('recordAIRequest()', () => {
    it('should update lastAIRequest timestamp', () => {
      expect(monitor.lastAIRequest).toBeNull();
      const before = Date.now();
      monitor.recordAIRequest();
      const after = Date.now();

      expect(monitor.lastAIRequest).toBeGreaterThanOrEqual(before);
      expect(monitor.lastAIRequest).toBeLessThanOrEqual(after);
    });
  });

  describe('setAPIStatus()', () => {
    it('should update API status and lastAPICheck', () => {
      expect(monitor.apiStatus).toBe('unknown');
      expect(monitor.lastAPICheck).toBeNull();

      const before = Date.now();
      monitor.setAPIStatus('ok');
      const after = Date.now();

      expect(monitor.apiStatus).toBe('ok');
      expect(monitor.lastAPICheck).toBeGreaterThanOrEqual(before);
      expect(monitor.lastAPICheck).toBeLessThanOrEqual(after);
    });

    it('should accept different status values', () => {
      monitor.setAPIStatus('error');
      expect(monitor.apiStatus).toBe('error');

      monitor.setAPIStatus('unknown');
      expect(monitor.apiStatus).toBe('unknown');
    });
  });

  describe('getUptime()', () => {
    it('should return positive uptime', () => {
      monitor.recordStart();
      const uptime = monitor.getUptime();
      // Uptime should be non-negative (could be 0 or very small)
      expect(uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getFormattedUptime()', () => {
    it('should format seconds correctly', () => {
      vi.useFakeTimers();
      monitor.startTime = Date.now() - 45 * 1000; // 45 seconds ago
      expect(monitor.getFormattedUptime()).toBe('45s');
      vi.useRealTimers();
    });

    it('should format minutes and seconds correctly', () => {
      vi.useFakeTimers();
      monitor.startTime = Date.now() - (5 * 60 + 30) * 1000; // 5m 30s ago
      expect(monitor.getFormattedUptime()).toBe('5m 30s');
      vi.useRealTimers();
    });

    it('should format hours correctly', () => {
      vi.useFakeTimers();
      monitor.startTime = Date.now() - (2 * 60 * 60 + 15 * 60 + 45) * 1000; // 2h 15m 45s
      expect(monitor.getFormattedUptime()).toBe('2h 15m 45s');
      vi.useRealTimers();
    });

    it('should format days correctly', () => {
      vi.useFakeTimers();
      monitor.startTime = Date.now() - (3 * 24 * 60 * 60 + 5 * 60 * 60 + 30 * 60) * 1000; // 3d 5h 30m
      expect(monitor.getFormattedUptime()).toBe('3d 5h 30m');
      vi.useRealTimers();
    });
  });

  describe('getMemoryUsage()', () => {
    it('should return memory stats in MB', () => {
      const mem = monitor.getMemoryUsage();
      expect(mem).toHaveProperty('heapUsed');
      expect(mem).toHaveProperty('heapTotal');
      expect(mem).toHaveProperty('rss');
      expect(mem).toHaveProperty('external');

      expect(typeof mem.heapUsed).toBe('number');
      expect(typeof mem.heapTotal).toBe('number');
      expect(typeof mem.rss).toBe('number');
      expect(typeof mem.external).toBe('number');
    });
  });

  describe('getFormattedMemory()', () => {
    it('should return formatted memory string', () => {
      const formatted = monitor.getFormattedMemory();
      expect(formatted).toMatch(/\d+MB \/ \d+MB \(RSS: \d+MB\)/);
    });
  });

  describe('getStatus()', () => {
    it('should return complete status object', () => {
      monitor.setAPIStatus('ok');
      monitor.recordAIRequest();

      const status = monitor.getStatus();

      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('uptimeFormatted');
      expect(status).toHaveProperty('memory');
      expect(status).toHaveProperty('api');
      expect(status).toHaveProperty('lastAIRequest');
      expect(status).toHaveProperty('timestamp');

      expect(status.api.status).toBe('ok');
      expect(status.memory).toHaveProperty('formatted');
    });
  });

  describe('getDetailedStatus()', () => {
    it('should return detailed status with process info', () => {
      const detailed = monitor.getDetailedStatus();

      expect(detailed).toHaveProperty('uptime');
      expect(detailed).toHaveProperty('process');
      expect(detailed).toHaveProperty('cpu');

      expect(detailed.process).toHaveProperty('pid');
      expect(detailed.process).toHaveProperty('platform');
      expect(detailed.process).toHaveProperty('nodeVersion');
      expect(detailed.process).toHaveProperty('uptime');

      expect(detailed.memory).toHaveProperty('arrayBuffers');
    });
  });
});
