import { describe, expect, it } from 'vitest';
import { needsSplitting, splitMessage } from '../src/utils/splitMessage.js';

describe('splitMessage', () => {
  describe('splitMessage()', () => {
    it('should return empty array for empty or null input', () => {
      expect(splitMessage('')).toEqual([]);
      expect(splitMessage(null)).toEqual([]);
      expect(splitMessage(undefined)).toEqual([]);
    });

    it('should return single-item array for short messages', () => {
      const text = 'Hello, world!';
      expect(splitMessage(text)).toEqual([text]);
    });

    it('should return single-item array for message exactly at limit', () => {
      const text = 'a'.repeat(1990);
      expect(splitMessage(text)).toEqual([text]);
    });

    it('should split long messages into multiple chunks', () => {
      const text = 'a'.repeat(4000);
      const chunks = splitMessage(text);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.every((c) => c.length <= 1990)).toBe(true);
    });

    it('should split on word boundaries when possible', () => {
      const words = 'word '.repeat(500);
      const chunks = splitMessage(words);
      expect(chunks.length).toBeGreaterThan(1);
      // Chunks should not end mid-word (except the last one)
      for (let i = 0; i < chunks.length - 1; i++) {
        expect(chunks[i].endsWith(' ') || chunks[i].endsWith('word')).toBe(true);
      }
    });

    it('should force split when no space found', () => {
      const text = 'a'.repeat(3000); // No spaces
      const chunks = splitMessage(text);
      expect(chunks.length).toBe(2);
      expect(chunks[0].length).toBe(1990);
    });

    it('should respect custom maxLength parameter', () => {
      const text = 'a'.repeat(100);
      const chunks = splitMessage(text, 50);
      expect(chunks.length).toBe(2);
      expect(chunks.every((c) => c.length <= 50)).toBe(true);
    });

    it('should trim leading spaces from subsequent chunks', () => {
      const text = 'hello world '.repeat(300);
      const chunks = splitMessage(text);
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].startsWith(' ')).toBe(false);
      }
    });

    it('should handle message with only spaces', () => {
      const text = ' '.repeat(100);
      const chunks = splitMessage(text, 50);
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('needsSplitting()', () => {
    it('should return falsy for empty or null input', () => {
      expect(needsSplitting('')).toBeFalsy();
      expect(needsSplitting(null)).toBeFalsy();
      expect(needsSplitting(undefined)).toBeFalsy();
    });

    it('should return false for short messages', () => {
      expect(needsSplitting('Hello!')).toBe(false);
      expect(needsSplitting('a'.repeat(2000))).toBe(false);
    });

    it('should return true for messages exceeding 2000 chars', () => {
      expect(needsSplitting('a'.repeat(2001))).toBe(true);
      expect(needsSplitting('a'.repeat(5000))).toBe(true);
    });
  });
});
