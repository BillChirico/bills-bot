import { describe, expect, it } from 'vitest';
import { needsSplitting, splitMessage } from '../../src/utils/splitMessage.js';

describe('splitMessage', () => {
	describe('needsSplitting', () => {
		it('should return false for short messages', () => {
			expect(needsSplitting('Hello world')).toBe(false);
		});

		it('should return false for messages at exactly 2000 chars', () => {
			const message = 'a'.repeat(2000);
			expect(needsSplitting(message)).toBe(false);
		});

		it('should return true for messages over 2000 chars', () => {
			const message = 'a'.repeat(2001);
			expect(needsSplitting(message)).toBe(true);
		});

		it('should return falsy for empty string', () => {
			expect(needsSplitting('')).toBeFalsy();
		});

		it('should return falsy for null/undefined', () => {
			expect(needsSplitting(null)).toBeFalsy();
			expect(needsSplitting(undefined)).toBeFalsy();
		});
	});

	describe('splitMessage', () => {
		it('should return single chunk for short messages', () => {
			const result = splitMessage('Hello world');
			expect(result).toEqual(['Hello world']);
		});

		it('should return empty array for empty string', () => {
			const result = splitMessage('');
			expect(result).toEqual([]);
		});

		it('should return empty array for null/undefined', () => {
			expect(splitMessage(null)).toEqual([]);
			expect(splitMessage(undefined)).toEqual([]);
		});

		it('should split long messages into multiple chunks', () => {
			const message = 'a'.repeat(3000);
			const result = splitMessage(message);
			expect(result.length).toBe(2);
			expect(result[0].length).toBeLessThanOrEqual(1990);
			expect(result[1].length).toBeLessThanOrEqual(1990);
		});

		it('should split on word boundaries when possible', () => {
			const words = Array(500).fill('hello').join(' ');
			const result = splitMessage(words);
			expect(result.length).toBeGreaterThan(1);
			for (const chunk of result) {
				expect(chunk.length).toBeLessThanOrEqual(1990);
				// Should not end with partial word (space or end of string)
				if (chunk !== result[result.length - 1]) {
					expect(chunk.endsWith(' ') || chunk.endsWith('hello')).toBe(true);
				}
			}
		});

		it('should force split if no spaces found', () => {
			const message = 'a'.repeat(3000);
			const result = splitMessage(message);
			expect(result.length).toBeGreaterThan(1);
			for (const chunk of result) {
				expect(chunk.length).toBeLessThanOrEqual(1990);
			}
		});

		it('should respect custom maxLength parameter', () => {
			const message = 'a'.repeat(200);
			const result = splitMessage(message, 100);
			expect(result.length).toBe(2);
			expect(result[0].length).toBe(100);
			expect(result[1].length).toBe(100);
		});

		it('should trim whitespace from start of subsequent chunks', () => {
			const message = 'hello world '.repeat(200);
			const result = splitMessage(message);
			for (const chunk of result) {
				if (chunk !== result[0]) {
					expect(chunk.startsWith(' ')).toBe(false);
				}
			}
		});

		it('should handle messages with no spaces at all', () => {
			const message = 'x'.repeat(2500);
			const result = splitMessage(message);
			expect(result.length).toBeGreaterThan(1);
			const totalLength = result.reduce((sum, chunk) => sum + chunk.length, 0);
			expect(totalLength).toBe(2500);
		});

		it('should preserve content integrity', () => {
			const message = 'a'.repeat(3000);
			const result = splitMessage(message);
			const reassembled = result.join('');
			expect(reassembled).toBe(message);
		});

		it('should handle edge case of message exactly at chunk boundary', () => {
			const message = 'a'.repeat(1990);
			const result = splitMessage(message);
			expect(result).toEqual([message]);
		});
	});
});