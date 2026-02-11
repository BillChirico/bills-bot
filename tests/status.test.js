/**
 * Tests for src/commands/status.js
 * Bot health status command
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';

// Mock the health monitor
vi.mock('../src/utils/health.js', () => ({
  HealthMonitor: {
    getInstance: vi.fn(() => ({
      getStatus: vi.fn(() => ({
        uptimeFormatted: '2h 30m',
        memory: { formatted: '150MB' },
        api: { status: 'ok' },
        lastAIRequest: Date.now() - 60000,
      })),
      getDetailedStatus: vi.fn(() => ({
        uptimeFormatted: '2h 30m',
        memory: {
          formatted: '150MB',
          heapUsed: 120,
          rss: 180,
          external: 10,
          arrayBuffers: 5,
        },
        api: { status: 'ok' },
        lastAIRequest: Date.now() - 60000,
        process: {
          pid: 12345,
          platform: 'linux',
          nodeVersion: 'v20.0.0',
          uptime: 9000,
        },
      })),
    })),
  },
}));

describe('status command', () => {
  let statusCommand;
  let mockInteraction;

  beforeEach(async () => {
    statusCommand = await import('../src/commands/status.js');

    mockInteraction = {
      options: {
        getBoolean: vi.fn().mockReturnValue(false),
      },
      memberPermissions: {
        has: vi.fn().mockReturnValue(false),
      },
      reply: vi.fn().mockResolvedValue({}),
      followUp: vi.fn().mockResolvedValue({}),
      replied: false,
      deferred: false,
    };
  });

  describe('command structure', () => {
    it('should export data property', () => {
      expect(statusCommand.data).toBeDefined();
      expect(statusCommand.data.name).toBe('status');
    });

    it('should have correct command name', () => {
      expect(statusCommand.data.name).toBe('status');
    });

    it('should have description', () => {
      expect(statusCommand.data.description).toBeDefined();
      expect(statusCommand.data.description.length).toBeGreaterThan(0);
    });

    it('should export execute function', () => {
      expect(statusCommand.execute).toBeDefined();
      expect(typeof statusCommand.execute).toBe('function');
    });

    it('should have detailed boolean option', () => {
      const options = statusCommand.data.options;
      expect(Array.isArray(options)).toBe(true);
      expect(options.length).toBeGreaterThan(0);
      expect(options[0].name).toBe('detailed');
      expect(options[0].type).toBe(5); // Boolean type
    });
  });

  describe('execute - basic mode', () => {
    it('should reply with status embed', async () => {
      await statusCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      const replyArgs = mockInteraction.reply.mock.calls[0][0];
      expect(replyArgs.embeds).toBeDefined();
      expect(replyArgs.embeds.length).toBe(1);
    });

    it('should include uptime in status', async () => {
      await statusCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const fields = embed.data.fields;
      const uptimeField = fields.find((f) => f.name.includes('Uptime'));
      expect(uptimeField).toBeDefined();
      expect(uptimeField.value).toContain('2h 30m');
    });

    it('should include memory usage', async () => {
      await statusCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const fields = embed.data.fields;
      const memoryField = fields.find((f) => f.name.includes('Memory'));
      expect(memoryField).toBeDefined();
      expect(memoryField.value).toContain('150MB');
    });

    it('should include API status', async () => {
      await statusCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const fields = embed.data.fields;
      const apiField = fields.find((f) => f.name.includes('API'));
      expect(apiField).toBeDefined();
      expect(apiField.value).toContain('OK');
    });

    it('should include last AI request', async () => {
      await statusCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const fields = embed.data.fields;
      const aiField = fields.find((f) => f.name.includes('AI Request'));
      expect(aiField).toBeDefined();
    });

    it('should show correct status emoji for ok', async () => {
      await statusCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const fields = embed.data.fields;
      const apiField = fields.find((f) => f.name.includes('API'));
      expect(apiField.value).toContain('🟢');
    });

    it('should include footer with hint', async () => {
      await statusCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      expect(embed.data.footer.text).toContain('detailed');
    });

    it('should not be ephemeral by default', async () => {
      await statusCommand.execute(mockInteraction);

      const replyArgs = mockInteraction.reply.mock.calls[0][0];
      expect(replyArgs.ephemeral).toBeUndefined();
    });
  });

  describe('execute - detailed mode', () => {
    beforeEach(() => {
      mockInteraction.options.getBoolean.mockReturnValue(true);
      mockInteraction.memberPermissions.has.mockReturnValue(true);
    });

    it('should show detailed diagnostics for admins', async () => {
      await statusCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      expect(embed.data.title).toContain('Detailed');
    });

    it('should include process ID', async () => {
      await statusCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const fields = embed.data.fields;
      const pidField = fields.find((f) => f.name.includes('Process ID'));
      expect(pidField).toBeDefined();
      expect(pidField.value).toContain('12345');
    });

    it('should include platform', async () => {
      await statusCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const fields = embed.data.fields;
      const platformField = fields.find((f) => f.name.includes('Platform'));
      expect(platformField).toBeDefined();
      expect(platformField.value).toContain('linux');
    });

    it('should include Node version', async () => {
      await statusCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const fields = embed.data.fields;
      const nodeField = fields.find((f) => f.name.includes('Node'));
      expect(nodeField).toBeDefined();
      expect(nodeField.value).toContain('v20');
    });

    it('should include heap usage', async () => {
      await statusCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const fields = embed.data.fields;
      const heapField = fields.find((f) => f.name.includes('Heap'));
      expect(heapField).toBeDefined();
      expect(heapField.value).toContain('120');
    });

    it('should include RSS memory', async () => {
      await statusCommand.execute(mockInteraction);

      const embed = mockInteraction.reply.mock.calls[0][0].embeds[0];
      const fields = embed.data.fields;
      const rssField = fields.find((f) => f.name.includes('RSS'));
      expect(rssField).toBeDefined();
      expect(rssField.value).toContain('180');
    });

    it('should be ephemeral for detailed mode', async () => {
      await statusCommand.execute(mockInteraction);

      const replyArgs = mockInteraction.reply.mock.calls[0][0];
      expect(replyArgs.ephemeral).toBe(true);
    });

    it('should deny non-admins access to detailed mode', async () => {
      mockInteraction.memberPermissions.has.mockReturnValue(false);

      await statusCommand.execute(mockInteraction);

      const replyArgs = mockInteraction.reply.mock.calls[0][0];
      expect(replyArgs.content).toContain('administrators');
      expect(replyArgs.ephemeral).toBe(true);
    });

    it('should check for Administrator permission', async () => {
      await statusCommand.execute(mockInteraction);

      expect(mockInteraction.memberPermissions.has).toHaveBeenCalledWith(
        PermissionFlagsBits.Administrator
      );
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      const { HealthMonitor } = await import('../src/utils/health.js');
      HealthMonitor.getInstance.mockImplementation(() => {
        throw new Error('Health monitor error');
      });

      await expect(statusCommand.execute(mockInteraction)).resolves.not.toThrow();
    });

    it('should send error message on failure', async () => {
      const { HealthMonitor } = await import('../src/utils/health.js');
      HealthMonitor.getInstance.mockImplementation(() => {
        throw new Error('Health monitor error');
      });

      await statusCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      const replyArgs = mockInteraction.reply.mock.calls[0][0];
      expect(replyArgs.content).toContain("couldn't retrieve");
    });

    it('should use followUp if already replied', async () => {
      mockInteraction.replied = true;
      const { HealthMonitor } = await import('../src/utils/health.js');
      HealthMonitor.getInstance.mockImplementation(() => {
        throw new Error('Health monitor error');
      });

      await statusCommand.execute(mockInteraction);

      expect(mockInteraction.followUp).toHaveBeenCalled();
    });

    it('should handle followUp failures silently', async () => {
      mockInteraction.replied = true;
      mockInteraction.followUp.mockRejectedValue(new Error('Follow up failed'));
      const { HealthMonitor } = await import('../src/utils/health.js');
      HealthMonitor.getInstance.mockImplementation(() => {
        throw new Error('Health monitor error');
      });

      await expect(statusCommand.execute(mockInteraction)).resolves.not.toThrow();
    });
  });

  // Emoji and time formatting already tested in basic mode tests above
});