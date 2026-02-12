import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('../../src/db.js', () => ({
  getPool: vi.fn(),
}));

vi.mock('../../src/logger.js', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../../src/modules/config.js', () => ({
  getConfig: vi.fn().mockReturnValue({
    moderation: {
      dmNotifications: { warn: true, kick: true, timeout: true, ban: true },
      escalation: { enabled: false, thresholds: [] },
      logging: { channels: { default: '123', warns: null, bans: '456' } },
    },
  }),
}));

vi.mock('../../src/utils/duration.js', () => ({
  parseDuration: vi.fn().mockReturnValue(3600000),
  formatDuration: vi.fn().mockReturnValue('1 hour'),
}));

import { getPool } from '../../src/db.js';
import {
  checkEscalation,
  checkHierarchy,
  createCase,
  getNextCaseNumber,
  sendDmNotification,
  sendModLogEmbed,
  shouldSendDm,
  startTempbanScheduler,
  stopTempbanScheduler,
} from '../../src/modules/moderation.js';

describe('moderation module', () => {
  let mockPool;

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
    };
    getPool.mockReturnValue(mockPool);
    vi.clearAllMocks();
  });

  afterEach(() => {
    stopTempbanScheduler();
    vi.restoreAllMocks();
  });

  describe('getNextCaseNumber', () => {
    it('should return 1 when no cases exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ max_num: null }] });
      const result = await getNextCaseNumber('guild1');
      expect(result).toBe(1);
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('MAX(case_number)'), [
        'guild1',
      ]);
    });

    it('should return max + 1 when cases exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ max_num: 5 }] });
      const result = await getNextCaseNumber('guild1');
      expect(result).toBe(6);
    });
  });

  describe('createCase', () => {
    it('should insert a case and return it', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ max_num: 3 }] }) // getNextCaseNumber
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              guild_id: 'guild1',
              case_number: 4,
              action: 'warn',
              target_id: 'user1',
              target_tag: 'User#0001',
              moderator_id: 'mod1',
              moderator_tag: 'Mod#0001',
              reason: 'test reason',
              duration: null,
              expires_at: null,
              created_at: new Date().toISOString(),
            },
          ],
        });

      const result = await createCase('guild1', {
        action: 'warn',
        targetId: 'user1',
        targetTag: 'User#0001',
        moderatorId: 'mod1',
        moderatorTag: 'Mod#0001',
        reason: 'test reason',
      });

      expect(result.case_number).toBe(4);
      expect(result.action).toBe('warn');
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('should handle null optional fields', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ max_num: null }] }).mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            case_number: 1,
            action: 'warn',
            reason: null,
            duration: null,
            expires_at: null,
          },
        ],
      });

      const result = await createCase('guild1', {
        action: 'warn',
        targetId: 'user1',
        targetTag: 'User#0001',
        moderatorId: 'mod1',
        moderatorTag: 'Mod#0001',
      });

      expect(result.case_number).toBe(1);
    });
  });

  describe('sendDmNotification', () => {
    it('should send DM embed to member', async () => {
      const mockSend = vi.fn().mockResolvedValue(undefined);
      const member = { send: mockSend };

      await sendDmNotification(member, 'warn', 'test reason', 'Test Server');

      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }));
    });

    it('should use fallback reason when none provided', async () => {
      const mockSend = vi.fn().mockResolvedValue(undefined);
      const member = { send: mockSend };

      await sendDmNotification(member, 'kick', null, 'Test Server');

      const embed = mockSend.mock.calls[0][0].embeds[0];
      const fields = embed.toJSON().fields;
      expect(fields[0].value).toBe('No reason provided');
    });

    it('should silently catch DM failures', async () => {
      const member = { send: vi.fn().mockRejectedValue(new Error('DMs disabled')) };

      // Should not throw
      await sendDmNotification(member, 'ban', 'reason', 'Server');
    });
  });

  describe('sendModLogEmbed', () => {
    it('should send embed to action-specific channel', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue({ id: 'msg1' });
      const mockChannel = { send: mockSendMessage };
      const client = {
        channels: { fetch: vi.fn().mockResolvedValue(mockChannel) },
      };
      const config = {
        moderation: {
          logging: { channels: { default: '123', bans: '456' } },
        },
      };

      const caseData = {
        id: 1,
        case_number: 1,
        action: 'ban',
        target_id: 'user1',
        target_tag: 'User#0001',
        moderator_id: 'mod1',
        moderator_tag: 'Mod#0001',
        reason: 'test',
        created_at: new Date().toISOString(),
      };

      const result = await sendModLogEmbed(client, config, caseData);

      expect(client.channels.fetch).toHaveBeenCalledWith('456');
      expect(result).toEqual({ id: 'msg1' });
    });

    it('should fall back to default channel', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue({ id: 'msg2' });
      const mockChannel = { send: mockSendMessage };
      const client = {
        channels: { fetch: vi.fn().mockResolvedValue(mockChannel) },
      };
      const config = {
        moderation: {
          logging: { channels: { default: '123', warns: null } },
        },
      };

      const caseData = {
        id: 2,
        case_number: 2,
        action: 'warn',
        target_id: 'user1',
        target_tag: 'User#0001',
        moderator_id: 'mod1',
        moderator_tag: 'Mod#0001',
        reason: null,
        created_at: new Date().toISOString(),
      };

      await sendModLogEmbed(client, config, caseData);

      expect(client.channels.fetch).toHaveBeenCalledWith('123');
    });

    it('should return null when no channels configured', async () => {
      const client = { channels: { fetch: vi.fn() } };
      const config = { moderation: { logging: { channels: {} } } };

      const caseData = { action: 'warn', case_number: 1 };
      const result = await sendModLogEmbed(client, config, caseData);

      expect(result).toBeNull();
    });

    it('should return null when config has no logging', async () => {
      const client = { channels: { fetch: vi.fn() } };
      const config = { moderation: {} };

      const result = await sendModLogEmbed(client, config, { action: 'warn' });
      expect(result).toBeNull();
    });

    it('should handle channel fetch failure', async () => {
      const client = {
        channels: { fetch: vi.fn().mockRejectedValue(new Error('not found')) },
      };
      const config = {
        moderation: { logging: { channels: { default: '999' } } },
      };

      const result = await sendModLogEmbed(client, config, {
        action: 'warn',
        case_number: 1,
      });
      expect(result).toBeNull();
    });

    it('should include duration field when present', async () => {
      const mockSend = vi.fn().mockResolvedValue({ id: 'msg3' });
      const mockChannel = { send: mockSend };
      const client = {
        channels: { fetch: vi.fn().mockResolvedValue(mockChannel) },
      };
      const config = {
        moderation: { logging: { channels: { default: '123' } } },
      };

      const caseData = {
        id: 3,
        case_number: 3,
        action: 'timeout',
        target_id: 'user1',
        target_tag: 'User#0001',
        moderator_id: 'mod1',
        moderator_tag: 'Mod#0001',
        reason: 'test',
        duration: '1h',
        created_at: new Date().toISOString(),
      };

      await sendModLogEmbed(client, config, caseData);

      const embed = mockSend.mock.calls[0][0].embeds[0];
      const fields = embed.toJSON().fields;
      expect(fields.some((f) => f.name === 'Duration')).toBe(true);
    });
  });

  describe('checkEscalation', () => {
    it('should return null when escalation is disabled', async () => {
      const config = { moderation: { escalation: { enabled: false } } };
      const result = await checkEscalation(null, 'guild1', 'user1', 'mod1', 'Mod#0001', config);
      expect(result).toBeNull();
    });

    it('should return null when no thresholds', async () => {
      const config = { moderation: { escalation: { enabled: true, thresholds: [] } } };
      const result = await checkEscalation(null, 'guild1', 'user1', 'mod1', 'Mod#0001', config);
      expect(result).toBeNull();
    });

    it('should return null when warn count below threshold', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ count: 1 }] });

      const config = {
        moderation: {
          escalation: {
            enabled: true,
            thresholds: [{ warns: 3, withinDays: 7, action: 'timeout', duration: '1h' }],
          },
          logging: { channels: {} },
        },
      };

      const result = await checkEscalation(
        { guilds: { fetch: vi.fn() } },
        'guild1',
        'user1',
        'mod1',
        'Mod#0001',
        config,
      );
      expect(result).toBeNull();
    });

    it('should trigger escalation when threshold met', async () => {
      const mockMember = {
        timeout: vi.fn().mockResolvedValue(undefined),
        user: { tag: 'User#0001' },
      };
      const mockGuild = {
        members: {
          fetch: vi.fn().mockResolvedValue(mockMember),
          ban: vi.fn(),
        },
      };
      const mockClient = {
        guilds: { fetch: vi.fn().mockResolvedValue(mockGuild) },
        channels: {
          fetch: vi.fn().mockResolvedValue({ send: vi.fn().mockResolvedValue({ id: 'msg' }) }),
        },
      };

      // First call: count query for escalation check
      // Second call: getNextCaseNumber for escalation case
      // Third call: INSERT for escalation case
      // Fourth call: UPDATE log_message_id
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: 3 }] })
        .mockResolvedValueOnce({ rows: [{ max_num: 5 }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 6,
              case_number: 6,
              action: 'timeout',
              target_id: 'user1',
              target_tag: 'User#0001',
              moderator_id: 'mod1',
              moderator_tag: 'Mod#0001',
              reason: 'Auto-escalation: 3 warns in 7 days',
              duration: '1h',
              created_at: new Date().toISOString(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // log_message_id update

      const config = {
        moderation: {
          escalation: {
            enabled: true,
            thresholds: [{ warns: 3, withinDays: 7, action: 'timeout', duration: '1h' }],
          },
          logging: { channels: { default: '123' } },
        },
      };

      const result = await checkEscalation(
        mockClient,
        'guild1',
        'user1',
        'mod1',
        'Mod#0001',
        config,
      );

      expect(result).toBeTruthy();
      expect(result.action).toBe('timeout');
      expect(mockMember.timeout).toHaveBeenCalled();
    });

    it('should handle ban escalation', async () => {
      const mockGuild = {
        members: {
          fetch: vi.fn().mockResolvedValue({ user: { tag: 'User#0001' } }),
          ban: vi.fn().mockResolvedValue(undefined),
        },
      };
      const mockClient = {
        guilds: { fetch: vi.fn().mockResolvedValue(mockGuild) },
        channels: {
          fetch: vi.fn().mockResolvedValue({ send: vi.fn().mockResolvedValue({ id: 'msg' }) }),
        },
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: 5 }] })
        .mockResolvedValueOnce({ rows: [{ max_num: 1 }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 2,
              case_number: 2,
              action: 'ban',
              target_id: 'user1',
              target_tag: 'User#0001',
              moderator_id: 'mod1',
              moderator_tag: 'Mod#0001',
              reason: 'Auto-escalation: 5 warns in 30 days',
              created_at: new Date().toISOString(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const config = {
        moderation: {
          escalation: {
            enabled: true,
            thresholds: [{ warns: 5, withinDays: 30, action: 'ban' }],
          },
          logging: { channels: { default: '123' } },
        },
      };

      const result = await checkEscalation(
        mockClient,
        'guild1',
        'user1',
        'mod1',
        'Mod#0001',
        config,
      );

      expect(result).toBeTruthy();
      expect(mockGuild.members.ban).toHaveBeenCalledWith('user1', { reason: expect.any(String) });
    });
  });

  describe('checkHierarchy', () => {
    it('should return null when moderator is higher', () => {
      const moderator = { roles: { highest: { position: 10 } } };
      const target = { roles: { highest: { position: 5 } } };
      expect(checkHierarchy(moderator, target)).toBeNull();
    });

    it('should return error when target is equal', () => {
      const moderator = { roles: { highest: { position: 5 } } };
      const target = { roles: { highest: { position: 5 } } };
      expect(checkHierarchy(moderator, target)).toContain('cannot moderate');
    });

    it('should return error when target is higher', () => {
      const moderator = { roles: { highest: { position: 3 } } };
      const target = { roles: { highest: { position: 10 } } };
      expect(checkHierarchy(moderator, target)).toContain('cannot moderate');
    });
  });

  describe('shouldSendDm', () => {
    it('should return true when enabled', () => {
      const config = { moderation: { dmNotifications: { warn: true } } };
      expect(shouldSendDm(config, 'warn')).toBe(true);
    });

    it('should return false when disabled', () => {
      const config = { moderation: { dmNotifications: { warn: false } } };
      expect(shouldSendDm(config, 'warn')).toBe(false);
    });

    it('should return false when not configured', () => {
      const config = { moderation: {} };
      expect(shouldSendDm(config, 'warn')).toBe(false);
    });
  });

  describe('tempban scheduler', () => {
    it('should start and stop scheduler', () => {
      vi.useFakeTimers();
      const client = {
        guilds: { fetch: vi.fn() },
        user: { id: 'bot1', tag: 'Bot#0001' },
      };

      // Mock pool query to return empty results for initial poll
      mockPool.query.mockResolvedValue({ rows: [] });

      startTempbanScheduler(client);
      // Starting again should be a no-op
      startTempbanScheduler(client);

      stopTempbanScheduler();
      // Stopping again should be a no-op
      stopTempbanScheduler();

      vi.useRealTimers();
    });

    it('should process expired tempbans on poll', async () => {
      const mockGuild = {
        members: { unban: vi.fn().mockResolvedValue(undefined) },
      };
      const mockClient = {
        guilds: { fetch: vi.fn().mockResolvedValue(mockGuild) },
        user: { id: 'bot1', tag: 'Bot#0001' },
        channels: {
          fetch: vi.fn().mockResolvedValue({ send: vi.fn().mockResolvedValue({ id: 'msg' }) }),
        },
      };

      // First call: poll query returns expired action
      // Subsequent calls: update executed, getNextCaseNumber, createCase, log_message_id update
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              guild_id: 'guild1',
              action: 'unban',
              target_id: 'user1',
              case_id: 5,
              execute_at: new Date(),
              executed: false,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE executed
        .mockResolvedValueOnce({ rows: [{ max_num: 6 }] }) // getNextCaseNumber
        .mockResolvedValueOnce({
          rows: [
            {
              id: 7,
              case_number: 7,
              action: 'unban',
              target_id: 'user1',
              target_tag: 'user1',
              moderator_id: 'bot1',
              moderator_tag: 'Bot#0001',
              reason: 'Tempban expired (case #5)',
              created_at: new Date().toISOString(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // log_message_id update

      // Use fake timers and start scheduler
      vi.useFakeTimers();
      startTempbanScheduler(mockClient);

      // Wait for initial poll promise
      await vi.advanceTimersByTimeAsync(100);

      expect(mockGuild.members.unban).toHaveBeenCalledWith('user1', 'Tempban expired');

      stopTempbanScheduler();
      vi.useRealTimers();
    });
  });
});
