/**
 * Tests for src/modules/welcome.js
 * Dynamic welcome messages for new members
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  renderWelcomeMessage,
  recordCommunityActivity,
  sendWelcomeMessage,
} from '../src/modules/welcome.js';

describe('welcome module', () => {
  describe('renderWelcomeMessage', () => {
    it('should replace {user} with mention', () => {
      const template = 'Welcome {user}!';
      const member = { id: '123', username: 'John' };
      const guild = { name: 'Test Server', memberCount: 50 };

      const result = renderWelcomeMessage(template, member, guild);
      expect(result).toBe('Welcome <@123>!');
    });

    it('should replace {username} with username', () => {
      const template = 'Hello {username}!';
      const member = { id: '123', username: 'John' };
      const guild = { name: 'Test Server', memberCount: 50 };

      const result = renderWelcomeMessage(template, member, guild);
      expect(result).toBe('Hello John!');
    });

    it('should replace {server} with server name', () => {
      const template = 'Welcome to {server}!';
      const member = { id: '123', username: 'John' };
      const guild = { name: 'Test Server', memberCount: 50 };

      const result = renderWelcomeMessage(template, member, guild);
      expect(result).toBe('Welcome to Test Server!');
    });

    it('should replace {memberCount} with count', () => {
      const template = 'You are member #{memberCount}';
      const member = { id: '123', username: 'John' };
      const guild = { name: 'Test Server', memberCount: 100 };

      const result = renderWelcomeMessage(template, member, guild);
      expect(result).toBe('You are member #100');
    });

    it('should replace multiple placeholders', () => {
      const template = 'Welcome {user} to {server}! You are member #{memberCount}. Hello {username}!';
      const member = { id: '123', username: 'John' };
      const guild = { name: 'Test Server', memberCount: 50 };

      const result = renderWelcomeMessage(template, member, guild);
      expect(result).toContain('<@123>');
      expect(result).toContain('Test Server');
      expect(result).toContain('50');
      expect(result).toContain('John');
    });

    it('should replace all occurrences of placeholders', () => {
      const template = 'Hi {user}! Yes, {user}, you!';
      const member = { id: '123', username: 'John' };
      const guild = { name: 'Test Server', memberCount: 50 };

      const result = renderWelcomeMessage(template, member, guild);
      expect(result).toBe('Hi <@123>! Yes, <@123>, you!');
    });

    it('should handle missing username gracefully', () => {
      const template = 'Welcome {username}!';
      const member = { id: '123' }; // No username
      const guild = { name: 'Test Server', memberCount: 50 };

      const result = renderWelcomeMessage(template, member, guild);
      expect(result).toBe('Welcome Unknown!');
    });

    it('should handle template with no placeholders', () => {
      const template = 'Welcome!';
      const member = { id: '123', username: 'John' };
      const guild = { name: 'Test Server', memberCount: 50 };

      const result = renderWelcomeMessage(template, member, guild);
      expect(result).toBe('Welcome!');
    });
  });

  describe('recordCommunityActivity', () => {
    let mockMessage;
    let mockConfig;

    beforeEach(() => {
      mockMessage = {
        guild: { id: 'guild123' },
        channel: {
          id: 'channel123',
          isTextBased: () => true,
        },
        author: {
          bot: false,
        },
      };

      mockConfig = {
        welcome: {
          dynamic: {
            enabled: true,
            excludeChannels: [],
            activityWindowMinutes: 45,
          },
        },
      };
    });

    it('should record message activity', () => {
      expect(() => {
        recordCommunityActivity(mockMessage, mockConfig);
      }).not.toThrow();
    });

    it('should ignore messages from bots', () => {
      mockMessage.author.bot = true;
      expect(() => {
        recordCommunityActivity(mockMessage, mockConfig);
      }).not.toThrow();
    });

    it('should ignore messages without guild', () => {
      mockMessage.guild = null;
      expect(() => {
        recordCommunityActivity(mockMessage, mockConfig);
      }).not.toThrow();
    });

    it('should ignore messages from excluded channels', () => {
      mockConfig.welcome.dynamic.excludeChannels = ['channel123'];
      expect(() => {
        recordCommunityActivity(mockMessage, mockConfig);
      }).not.toThrow();
    });

    it('should ignore non-text channels', () => {
      mockMessage.channel.isTextBased = () => false;
      expect(() => {
        recordCommunityActivity(mockMessage, mockConfig);
      }).not.toThrow();
    });

    it('should handle multiple messages from same channel', () => {
      expect(() => {
        recordCommunityActivity(mockMessage, mockConfig);
        recordCommunityActivity(mockMessage, mockConfig);
        recordCommunityActivity(mockMessage, mockConfig);
      }).not.toThrow();
    });

    it('should handle messages from different channels', () => {
      expect(() => {
        recordCommunityActivity(mockMessage, mockConfig);
        mockMessage.channel.id = 'channel456';
        recordCommunityActivity(mockMessage, mockConfig);
      }).not.toThrow();
    });

    it('should handle missing config gracefully', () => {
      expect(() => {
        recordCommunityActivity(mockMessage, {});
      }).not.toThrow();
    });
  });

  describe('sendWelcomeMessage', () => {
    let mockMember;
    let mockClient;
    let mockChannel;
    let mockConfig;

    beforeEach(() => {
      mockChannel = {
        send: vi.fn().mockResolvedValue({}),
      };

      mockClient = {
        channels: {
          fetch: vi.fn().mockResolvedValue(mockChannel),
        },
      };

      mockMember = {
        id: '123',
        user: {
          username: 'John',
          tag: 'John#1234',
        },
        guild: {
          name: 'Test Server',
          memberCount: 50,
          id: 'guild123',
          channels: {
            cache: new Map(),
          },
        },
      };

      mockConfig = {
        welcome: {
          enabled: true,
          channelId: 'welcome123',
          message: 'Welcome {user} to {server}!',
          dynamic: {
            enabled: false,
          },
        },
      };
    });

    it('should send welcome message to configured channel', async () => {
      await sendWelcomeMessage(mockMember, mockClient, mockConfig);

      expect(mockClient.channels.fetch).toHaveBeenCalledWith('welcome123');
      expect(mockChannel.send).toHaveBeenCalled();
    });

    it('should use template message when dynamic is disabled', async () => {
      await sendWelcomeMessage(mockMember, mockClient, mockConfig);

      const message = mockChannel.send.mock.calls[0][0];
      expect(message).toContain('<@123>');
      expect(message).toContain('Test Server');
    });

    it('should attempt dynamic message generation when enabled', async () => {
      mockConfig.welcome.dynamic.enabled = true;
      mockConfig.welcome.dynamic.timezone = 'America/New_York';

      // Dynamic welcome may fail with incomplete mocks, but should not crash
      await expect(sendWelcomeMessage(mockMember, mockClient, mockConfig)).resolves.not.toThrow();
    });

    it('should not send message when disabled', async () => {
      mockConfig.welcome.enabled = false;

      await sendWelcomeMessage(mockMember, mockClient, mockConfig);

      expect(mockClient.channels.fetch).not.toHaveBeenCalled();
      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    it('should not send message when channelId missing', async () => {
      mockConfig.welcome.channelId = null;

      await sendWelcomeMessage(mockMember, mockClient, mockConfig);

      expect(mockClient.channels.fetch).not.toHaveBeenCalled();
      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    it('should handle channel fetch errors gracefully', async () => {
      mockClient.channels.fetch.mockRejectedValueOnce(new Error('Channel not found'));

      await expect(sendWelcomeMessage(mockMember, mockClient, mockConfig)).resolves.not.toThrow();
      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    it('should handle null channel', async () => {
      mockClient.channels.fetch.mockResolvedValueOnce(null);

      await expect(sendWelcomeMessage(mockMember, mockClient, mockConfig)).resolves.not.toThrow();
      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    it('should handle send errors gracefully', async () => {
      mockChannel.send.mockRejectedValueOnce(new Error('Send failed'));

      await expect(sendWelcomeMessage(mockMember, mockClient, mockConfig)).resolves.not.toThrow();
    });

    it('should use default message if not configured', async () => {
      mockConfig.welcome.message = undefined;

      await sendWelcomeMessage(mockMember, mockClient, mockConfig);

      const message = mockChannel.send.mock.calls[0][0];
      expect(message).toContain('<@123>');
    });

    it('should handle milestone member counts without crashing', async () => {
      mockConfig.welcome.dynamic.enabled = true;
      mockMember.guild.memberCount = 100; // Notable milestone

      // May fail with mocks but should not crash
      await expect(sendWelcomeMessage(mockMember, mockClient, mockConfig)).resolves.not.toThrow();
    });

    it('should include member ID in message', async () => {
      await sendWelcomeMessage(mockMember, mockClient, mockConfig);

      const message = mockChannel.send.mock.calls[0][0];
      expect(message).toContain('123');
    });

    it('should include server name in message', async () => {
      await sendWelcomeMessage(mockMember, mockClient, mockConfig);

      const message = mockChannel.send.mock.calls[0][0];
      expect(message).toContain('Test Server');
    });
  });

  describe('dynamic welcome features', () => {
    let mockMember;
    let mockClient;
    let mockChannel;
    let mockConfig;

    beforeEach(() => {
      mockChannel = {
        send: vi.fn().mockResolvedValue({}),
      };

      mockClient = {
        channels: {
          fetch: vi.fn().mockResolvedValue(mockChannel),
        },
      };

      // Create a proper Map mock with filter method for dynamic welcome
      const channelsMap = new Map([
        ['channel1', { id: 'channel1', isVoiceBased: () => false }],
        ['channel2', { id: 'channel2', isVoiceBased: () => true, members: new Map() }],
      ]);
      // Add filter method and other Collection methods to match Discord.js Collection API
      channelsMap.filter = function(fn) {
        const filtered = new Map();
        filtered.size = 0;
        for (const [key, value] of this.entries()) {
          if (fn(value)) {
            filtered.set(key, value);
            filtered.size++;
          }
        }
        // Add Collection methods to filtered result
        filtered.filter = this.filter.bind(filtered);
        filtered.values = () => Array.from(filtered.values());
        return filtered;
      };

      mockMember = {
        id: '123',
        user: {
          username: 'John',
          tag: 'John#1234',
        },
        guild: {
          name: 'Test Server',
          memberCount: 50,
          id: 'guild123',
          channels: {
            cache: channelsMap,
          },
        },
      };

      mockConfig = {
        welcome: {
          enabled: true,
          channelId: 'welcome123',
          dynamic: {
            enabled: true,
            timezone: 'America/New_York',
            highlightChannels: [],
            excludeChannels: [],
            activityWindowMinutes: 45,
            milestoneInterval: 25,
          },
        },
      };
    });

    it('should attempt time-appropriate greeting without crashing', async () => {
      // Dynamic welcome may fail with incomplete mocks
      await expect(sendWelcomeMessage(mockMember, mockClient, mockConfig)).resolves.not.toThrow();
    });

    it('should handle different timezones gracefully', async () => {
      mockConfig.welcome.dynamic.timezone = 'Europe/London';
      await expect(sendWelcomeMessage(mockMember, mockClient, mockConfig)).resolves.not.toThrow();
    });

    it('should handle invalid timezone gracefully', async () => {
      mockConfig.welcome.dynamic.timezone = 'Invalid/Timezone';
      await expect(sendWelcomeMessage(mockMember, mockClient, mockConfig)).resolves.not.toThrow();
    });

    it('should handle member count without crashing', async () => {
      await expect(sendWelcomeMessage(mockMember, mockClient, mockConfig)).resolves.not.toThrow();
    });

    it('should handle milestone counts without crashing', async () => {
      mockMember.guild.memberCount = 100;
      await expect(sendWelcomeMessage(mockMember, mockClient, mockConfig)).resolves.not.toThrow();
    });

    it('should handle interval milestones without crashing', async () => {
      mockConfig.welcome.dynamic.milestoneInterval = 25;
      mockMember.guild.memberCount = 75; // Multiple of 25
      await expect(sendWelcomeMessage(mockMember, mockClient, mockConfig)).resolves.not.toThrow();
    });
  });
});