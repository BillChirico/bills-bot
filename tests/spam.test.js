/**
 * Tests for src/modules/spam.js
 * Spam detection and moderation
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { isSpam, sendSpamAlert } from '../src/modules/spam.js';

describe('spam module', () => {
  describe('isSpam', () => {
    it('should detect free crypto spam', () => {
      expect(isSpam('Get free crypto now!')).toBe(true);
      expect(isSpam('FREE BITCOIN HERE')).toBe(true);
      expect(isSpam('free btc claim now')).toBe(true);
      expect(isSpam('Free ETH giveaway')).toBe(true);
      expect(isSpam('Claim your free NFT')).toBe(true);
    });

    it('should detect airdrop scams', () => {
      expect(isSpam('Airdrop! Claim your tokens')).toBe(true);
      expect(isSpam('AIRDROP claim here')).toBe(true);
    });

    it('should detect Discord Nitro scams', () => {
      expect(isSpam('Discord Nitro free')).toBe(true);
      expect(isSpam('discord nitro free here')).toBe(true);
      expect(isSpam('Nitro gift claim')).toBe(true);
    });

    it('should detect verification phishing', () => {
      expect(isSpam('Click here to verify your account')).toBe(true);
      expect(isSpam('CLICK TO VERIFY ACCOUNT NOW')).toBe(true);
    });

    it('should detect investment scams', () => {
      expect(isSpam('Guaranteed profit investment')).toBe(true);
      expect(isSpam('Invest now and double your money')).toBe(true);
    });

    it('should detect DM spam', () => {
      expect(isSpam('DM me for free stuff')).toBe(true);
      expect(isSpam('dm me for free rewards')).toBe(true);
    });

    it('should detect money-making scams', () => {
      expect(isSpam('Make $5000 daily')).toBe(true);
      expect(isSpam('make 10k+ weekly')).toBe(true);
      expect(isSpam('MAKE $500 MONTHLY')).toBe(true);
    });

    it('should not flag legitimate messages', () => {
      expect(isSpam('Hello everyone!')).toBe(false);
      expect(isSpam('How do I set up my wallet?')).toBe(false);
      expect(isSpam('I bought some Bitcoin today')).toBe(false);
      expect(isSpam('What is an airdrop?')).toBe(false);
      expect(isSpam('I have Discord Nitro')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isSpam('FREE CRYPTO')).toBe(true);
      expect(isSpam('free crypto')).toBe(true);
      expect(isSpam('FrEe CrYpTo')).toBe(true);
    });

    it('should handle empty strings', () => {
      expect(isSpam('')).toBe(false);
    });

    it('should handle whitespace variations', () => {
      expect(isSpam('free    crypto')).toBe(true);
      expect(isSpam('free\ncrypto')).toBe(true);
      expect(isSpam('free\tcrypto')).toBe(true);
    });

    it('should detect patterns with extra characters', () => {
      expect(isSpam('f.r.e.e crypto!!!')).toBe(false); // Pattern broken by dots
      expect(isSpam('FREE CRYPTO 🎉🎉🎉')).toBe(true);
    });
  });

  describe('sendSpamAlert', () => {
    let mockMessage;
    let mockClient;
    let mockAlertChannel;
    let mockConfig;

    beforeEach(() => {
      mockAlertChannel = {
        send: vi.fn().mockResolvedValue({}),
      };

      mockClient = {
        channels: {
          fetch: vi.fn().mockResolvedValue(mockAlertChannel),
        },
      };

      mockMessage = {
        author: {
          id: 'user123',
        },
        channel: {
          id: 'channel456',
        },
        content: 'Spam message content',
        url: 'https://discord.com/channels/123/456/789',
        delete: vi.fn().mockResolvedValue(undefined),
      };

      mockConfig = {
        moderation: {
          alertChannelId: 'alert123',
          autoDelete: false,
        },
      };
    });

    it('should send alert to configured channel', async () => {
      await sendSpamAlert(mockMessage, mockClient, mockConfig);

      expect(mockClient.channels.fetch).toHaveBeenCalledWith('alert123');
      expect(mockAlertChannel.send).toHaveBeenCalled();
    });

    it('should include author in alert', async () => {
      await sendSpamAlert(mockMessage, mockClient, mockConfig);

      const callArgs = mockAlertChannel.send.mock.calls[0][0];
      const embed = callArgs.embeds[0];
      const authorField = embed.data.fields.find((f) => f.name === 'Author');

      expect(authorField.value).toContain('user123');
    });

    it('should include channel in alert', async () => {
      await sendSpamAlert(mockMessage, mockClient, mockConfig);

      const callArgs = mockAlertChannel.send.mock.calls[0][0];
      const embed = callArgs.embeds[0];
      const channelField = embed.data.fields.find((f) => f.name === 'Channel');

      expect(channelField.value).toContain('channel456');
    });

    it('should include message content in alert', async () => {
      await sendSpamAlert(mockMessage, mockClient, mockConfig);

      const callArgs = mockAlertChannel.send.mock.calls[0][0];
      const embed = callArgs.embeds[0];
      const contentField = embed.data.fields.find((f) => f.name === 'Content');

      expect(contentField.value).toContain('Spam message content');
    });

    it('should include message link in alert', async () => {
      await sendSpamAlert(mockMessage, mockClient, mockConfig);

      const callArgs = mockAlertChannel.send.mock.calls[0][0];
      const embed = callArgs.embeds[0];
      const linkField = embed.data.fields.find((f) => f.name === 'Link');

      expect(linkField.value).toContain(mockMessage.url);
    });

    it('should truncate long content to 1000 chars', async () => {
      const longContent = 'a'.repeat(2000);
      mockMessage.content = longContent;

      await sendSpamAlert(mockMessage, mockClient, mockConfig);

      const callArgs = mockAlertChannel.send.mock.calls[0][0];
      const embed = callArgs.embeds[0];
      const contentField = embed.data.fields.find((f) => f.name === 'Content');

      expect(contentField.value.length).toBeLessThanOrEqual(1000);
    });

    it('should handle empty content', async () => {
      mockMessage.content = '';

      await sendSpamAlert(mockMessage, mockClient, mockConfig);

      const callArgs = mockAlertChannel.send.mock.calls[0][0];
      const embed = callArgs.embeds[0];
      const contentField = embed.data.fields.find((f) => f.name === 'Content');

      expect(contentField.value).toBe('*empty*');
    });

    it('should auto-delete message when enabled', async () => {
      mockConfig.moderation.autoDelete = true;

      await sendSpamAlert(mockMessage, mockClient, mockConfig);

      expect(mockMessage.delete).toHaveBeenCalled();
    });

    it('should not delete message when autoDelete is false', async () => {
      mockConfig.moderation.autoDelete = false;

      await sendSpamAlert(mockMessage, mockClient, mockConfig);

      expect(mockMessage.delete).not.toHaveBeenCalled();
    });

    it('should handle channel fetch errors gracefully', async () => {
      mockClient.channels.fetch.mockRejectedValueOnce(new Error('Channel not found'));

      await expect(sendSpamAlert(mockMessage, mockClient, mockConfig)).resolves.not.toThrow();
      expect(mockAlertChannel.send).not.toHaveBeenCalled();
    });

    it('should handle channel returning null', async () => {
      mockClient.channels.fetch.mockResolvedValueOnce(null);

      await expect(sendSpamAlert(mockMessage, mockClient, mockConfig)).resolves.not.toThrow();
      expect(mockAlertChannel.send).not.toHaveBeenCalled();
    });

    it('should handle message delete errors gracefully', async () => {
      mockConfig.moderation.autoDelete = true;
      mockMessage.delete.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(sendSpamAlert(mockMessage, mockClient, mockConfig)).resolves.not.toThrow();
    });

    it('should do nothing when alertChannelId is not configured', async () => {
      mockConfig.moderation.alertChannelId = null;

      await sendSpamAlert(mockMessage, mockClient, mockConfig);

      expect(mockClient.channels.fetch).not.toHaveBeenCalled();
    });

    it('should create embed with correct color', async () => {
      await sendSpamAlert(mockMessage, mockClient, mockConfig);

      const callArgs = mockAlertChannel.send.mock.calls[0][0];
      const embed = callArgs.embeds[0];

      expect(embed.data.color).toBe(0xff6b6b); // Red color for spam
    });

    it('should include timestamp in embed', async () => {
      await sendSpamAlert(mockMessage, mockClient, mockConfig);

      const callArgs = mockAlertChannel.send.mock.calls[0][0];
      const embed = callArgs.embeds[0];

      expect(embed.data.timestamp).toBeDefined();
    });

    it('should have correct title', async () => {
      await sendSpamAlert(mockMessage, mockClient, mockConfig);

      const callArgs = mockAlertChannel.send.mock.calls[0][0];
      const embed = callArgs.embeds[0];

      expect(embed.data.title).toContain('Spam');
    });
  });
});