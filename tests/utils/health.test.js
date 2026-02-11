import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthMonitor } from '../../src/utils/health.js';

describe('HealthMonitor', () => {
	let monitor;

	beforeEach(() => {
		// Reset singleton for each test
		HealthMonitor.instance = null;
		monitor = HealthMonitor.getInstance();
	});

	describe('singleton pattern', () => {
		it('should return the same instance', () => {
			const instance1 = HealthMonitor.getInstance();
			const instance2 = HealthMonitor.getInstance();
			expect(instance1).toBe(instance2);
		});

		it('should throw error if constructed directly', () => {
			expect(() => new HealthMonitor()).toThrow('Use HealthMonitor.getInstance()');
		});
	});

	describe('recordStart', () => {
		it('should record start time', () => {
			const before = Date.now();
			monitor.recordStart();
			const after = Date.now();
			expect(monitor.startTime).toBeGreaterThanOrEqual(before);
			expect(monitor.startTime).toBeLessThanOrEqual(after);
		});

		it('should update start time when called again', () => {
			monitor.recordStart();
			const firstStart = monitor.startTime;
			vi.useFakeTimers();
			vi.advanceTimersByTime(1000);
			monitor.recordStart();
			expect(monitor.startTime).toBeGreaterThan(firstStart);
			vi.useRealTimers();
		});
	});

	describe('recordAIRequest', () => {
		it('should record AI request timestamp', () => {
			const before = Date.now();
			monitor.recordAIRequest();
			const after = Date.now();
			expect(monitor.lastAIRequest).toBeGreaterThanOrEqual(before);
			expect(monitor.lastAIRequest).toBeLessThanOrEqual(after);
		});

		it('should update timestamp on subsequent calls', () => {
			monitor.recordAIRequest();
			const first = monitor.lastAIRequest;
			vi.useFakeTimers();
			vi.advanceTimersByTime(1000);
			monitor.recordAIRequest();
			expect(monitor.lastAIRequest).toBeGreaterThan(first);
			vi.useRealTimers();
		});
	});

	describe('setAPIStatus', () => {
		it('should set API status to ok', () => {
			monitor.setAPIStatus('ok');
			expect(monitor.apiStatus).toBe('ok');
		});

		it('should set API status to error', () => {
			monitor.setAPIStatus('error');
			expect(monitor.apiStatus).toBe('error');
		});

		it('should set API status to unknown', () => {
			monitor.setAPIStatus('unknown');
			expect(monitor.apiStatus).toBe('unknown');
		});

		it('should record lastAPICheck timestamp', () => {
			const before = Date.now();
			monitor.setAPIStatus('ok');
			const after = Date.now();
			expect(monitor.lastAPICheck).toBeGreaterThanOrEqual(before);
			expect(monitor.lastAPICheck).toBeLessThanOrEqual(after);
		});
	});

	describe('getUptime', () => {
		it('should return uptime in milliseconds', () => {
			monitor.recordStart();
			vi.useFakeTimers();
			vi.advanceTimersByTime(5000);
			const uptime = monitor.getUptime();
			expect(uptime).toBe(5000);
			vi.useRealTimers();
		});

		it('should increase over time', () => {
			monitor.recordStart();
			vi.useFakeTimers();
			vi.advanceTimersByTime(1000);
			const uptime1 = monitor.getUptime();
			vi.advanceTimersByTime(1000);
			const uptime2 = monitor.getUptime();
			expect(uptime2).toBeGreaterThan(uptime1);
			vi.useRealTimers();
		});
	});

	describe('getFormattedUptime', () => {
		it('should format seconds only', () => {
			monitor.recordStart();
			vi.useFakeTimers();
			vi.advanceTimersByTime(45000); // 45 seconds
			expect(monitor.getFormattedUptime()).toBe('45s');
			vi.useRealTimers();
		});

		it('should format minutes and seconds', () => {
			monitor.recordStart();
			vi.useFakeTimers();
			vi.advanceTimersByTime(90000); // 1m 30s
			expect(monitor.getFormattedUptime()).toBe('1m 30s');
			vi.useRealTimers();
		});

		it('should format hours, minutes and seconds', () => {
			monitor.recordStart();
			vi.useFakeTimers();
			vi.advanceTimersByTime(3661000); // 1h 1m 1s
			expect(monitor.getFormattedUptime()).toBe('1h 1m 1s');
			vi.useRealTimers();
		});

		it('should format days, hours and minutes', () => {
			monitor.recordStart();
			vi.useFakeTimers();
			vi.advanceTimersByTime(90061000); // 1d 1h 1m
			expect(monitor.getFormattedUptime()).toBe('1d 1h 1m');
			vi.useRealTimers();
		});
	});

	describe('getMemoryUsage', () => {
		it('should return memory usage stats in MB', () => {
			const usage = monitor.getMemoryUsage();
			expect(usage).toHaveProperty('heapUsed');
			expect(usage).toHaveProperty('heapTotal');
			expect(usage).toHaveProperty('rss');
			expect(usage).toHaveProperty('external');
			expect(typeof usage.heapUsed).toBe('number');
			expect(typeof usage.heapTotal).toBe('number');
			expect(typeof usage.rss).toBe('number');
			expect(typeof usage.external).toBe('number');
		});

		it('should return positive values', () => {
			const usage = monitor.getMemoryUsage();
			expect(usage.heapUsed).toBeGreaterThan(0);
			expect(usage.heapTotal).toBeGreaterThan(0);
			expect(usage.rss).toBeGreaterThan(0);
		});
	});

	describe('getFormattedMemory', () => {
		it('should return formatted memory string', () => {
			const formatted = monitor.getFormattedMemory();
			expect(formatted).toMatch(/\d+MB \/ \d+MB \(RSS: \d+MB\)/);
		});
	});

	describe('getStatus', () => {
		it('should return complete status object', () => {
			monitor.recordStart();
			monitor.recordAIRequest();
			monitor.setAPIStatus('ok');

			const status = monitor.getStatus();

			expect(status).toHaveProperty('uptime');
			expect(status).toHaveProperty('uptimeFormatted');
			expect(status).toHaveProperty('memory');
			expect(status).toHaveProperty('api');
			expect(status).toHaveProperty('lastAIRequest');
			expect(status).toHaveProperty('timestamp');

			expect(status.memory).toHaveProperty('heapUsed');
			expect(status.memory).toHaveProperty('formatted');
			expect(status.api).toHaveProperty('status');
			expect(status.api).toHaveProperty('lastCheck');
		});

		it('should include current timestamp', () => {
			const before = Date.now();
			const status = monitor.getStatus();
			const after = Date.now();
			expect(status.timestamp).toBeGreaterThanOrEqual(before);
			expect(status.timestamp).toBeLessThanOrEqual(after);
		});

		it('should reflect current API status', () => {
			monitor.setAPIStatus('error');
			const status = monitor.getStatus();
			expect(status.api.status).toBe('error');
		});

		it('should include lastAIRequest if recorded', () => {
			monitor.recordAIRequest();
			const status = monitor.getStatus();
			expect(status.lastAIRequest).toBeTruthy();
		});
	});

	describe('getDetailedStatus', () => {
		it('should return detailed status with process info', () => {
			const status = monitor.getDetailedStatus();

			expect(status).toHaveProperty('process');
			expect(status.process).toHaveProperty('pid');
			expect(status.process).toHaveProperty('platform');
			expect(status.process).toHaveProperty('nodeVersion');
			expect(status.process).toHaveProperty('uptime');
		});

		it('should include array buffers in memory', () => {
			const status = monitor.getDetailedStatus();
			expect(status.memory).toHaveProperty('arrayBuffers');
			expect(typeof status.memory.arrayBuffers).toBe('number');
		});

		it('should include CPU usage', () => {
			const status = monitor.getDetailedStatus();
			expect(status).toHaveProperty('cpu');
			expect(status.cpu).toHaveProperty('user');
			expect(status.cpu).toHaveProperty('system');
		});

		it('should include all basic status fields', () => {
			const status = monitor.getDetailedStatus();
			expect(status).toHaveProperty('uptime');
			expect(status).toHaveProperty('uptimeFormatted');
			expect(status).toHaveProperty('api');
			expect(status).toHaveProperty('lastAIRequest');
		});
	});

	describe('initialization', () => {
		it('should initialize with unknown API status', () => {
			expect(monitor.apiStatus).toBe('unknown');
		});

		it('should initialize with null lastAIRequest', () => {
			expect(monitor.lastAIRequest).toBeNull();
		});

		it('should initialize with null lastAPICheck', () => {
			expect(monitor.lastAPICheck).toBeNull();
		});

		it('should initialize with current timestamp as startTime', () => {
			const before = Date.now();
			const newMonitor = HealthMonitor.getInstance();
			const after = Date.now();
			expect(newMonitor.startTime).toBeGreaterThanOrEqual(before);
			expect(newMonitor.startTime).toBeLessThanOrEqual(after);
		});
	});
});