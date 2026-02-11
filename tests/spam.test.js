import { describe, expect, it } from 'vitest';
import { isSpam } from '../src/modules/spam.js';

describe('spam detection', () => {
  describe('isSpam()', () => {
    it('should detect free crypto spam', () => {
      expect(isSpam('Free crypto giveaway!')).toBe(true);
      expect(isSpam('free bitcoin click here')).toBe(true);
      expect(isSpam('FREE BTC for everyone!')).toBe(true);
      expect(isSpam('Get free ETH now')).toBe(true);
      expect(isSpam('free nft drop')).toBe(true);
    });

    it('should detect airdrop scams', () => {
      expect(isSpam('Airdrop - claim your tokens now')).toBe(true);
      expect(isSpam('AIRDROP CLAIM NOW')).toBe(true);
    });

    it('should detect discord nitro scams', () => {
      expect(isSpam('Discord nitro free for everyone!')).toBe(true);
      expect(isSpam('DISCORD NITRO FREE')).toBe(true);
    });

    it('should detect nitro gift scams', () => {
      expect(isSpam('Nitro gift - claim it now!')).toBe(true);
      expect(isSpam('You got a NITRO GIFT, claim it')).toBe(true);
    });

    it('should detect verification scams', () => {
      expect(isSpam('Click here to verify your account')).toBe(true);
      expect(isSpam('Please click to verify account immediately')).toBe(true);
    });

    it('should detect investment scams', () => {
      expect(isSpam('Guaranteed profit every day!')).toBe(true);
      expect(isSpam('Invest and double your money!')).toBe(true);
    });

    it('should detect DM solicitation spam', () => {
      expect(isSpam('DM me for free stuff')).toBe(true);
      expect(isSpam('dm me for free skins')).toBe(true);
    });

    it('should detect money-making scams', () => {
      expect(isSpam('Make $500 daily!')).toBe(true);
      expect(isSpam('MAKE 1000 WEEKLY')).toBe(true);
      expect(isSpam('make $5k+ monthly')).toBe(true);
      expect(isSpam('Make 100 daily guaranteed')).toBe(true);
    });

    it('should not flag normal messages', () => {
      expect(isSpam('Hello, how are you?')).toBe(false);
      expect(isSpam('I love this Discord server!')).toBe(false);
      expect(isSpam('Can someone help me with JavaScript?')).toBe(false);
      expect(isSpam('The weather is nice today')).toBe(false);
    });

    it('should not flag legitimate cryptocurrency discussions', () => {
      expect(isSpam('I bought some Bitcoin yesterday')).toBe(false);
      expect(isSpam('ETH price is going up')).toBe(false);
      expect(isSpam('What do you think about NFTs?')).toBe(false);
    });

    it('should not flag legitimate money discussions', () => {
      expect(isSpam('I make around 500 a week at my job')).toBe(false);
      expect(isSpam('How much does this cost?')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(isSpam('')).toBe(false);
    });
  });
});
