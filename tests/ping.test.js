/**
 * Tests for src/commands/ping.js
 * Ping command for checking bot latency
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('ping command', () => {
  let pingCommand;
  let mockInteraction;

  beforeEach(async () => {
    pingCommand = await import('../src/commands/ping.js');

    mockInteraction = {
      reply: vi.fn().mockResolvedValue({
        resource: {
          message: {
            createdTimestamp: 1000,
          },
        },
      }),
      editReply: vi.fn().mockResolvedValue({}),
      createdTimestamp: 900,
      client: {
        ws: {
          ping: 42,
        },
      },
    };
  });

  describe('command structure', () => {
    it('should export data property', () => {
      expect(pingCommand.data).toBeDefined();
      expect(pingCommand.data.name).toBe('ping');
    });

    it('should have correct command name', () => {
      expect(pingCommand.data.name).toBe('ping');
    });

    it('should have description', () => {
      expect(pingCommand.data.description).toBeDefined();
      expect(pingCommand.data.description.length).toBeGreaterThan(0);
    });

    it('should export execute function', () => {
      expect(pingCommand.execute).toBeDefined();
      expect(typeof pingCommand.execute).toBe('function');
    });
  });

  describe('execute', () => {
    it('should reply with initial message', async () => {
      await pingCommand.execute(mockInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Pinging...',
        withResponse: true,
      });
    });

    it('should calculate latency', async () => {
      await pingCommand.execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
      const editedMessage = mockInteraction.editReply.mock.calls[0][0];
      expect(editedMessage).toContain('Pong');
      expect(editedMessage).toContain('ms');
    });

    it('should include API latency', async () => {
      await pingCommand.execute(mockInteraction);

      const editedMessage = mockInteraction.editReply.mock.calls[0][0];
      expect(editedMessage).toContain('API');
      expect(editedMessage).toContain('42ms');
    });

    it('should include round-trip latency', async () => {
      await pingCommand.execute(mockInteraction);

      const editedMessage = mockInteraction.editReply.mock.calls[0][0];
      expect(editedMessage).toContain('Latency');
      expect(editedMessage).toContain('100ms'); // 1000 - 900 = 100
    });

    it('should handle different latencies', async () => {
      mockInteraction.client.ws.ping = 123;
      mockInteraction.createdTimestamp = 500;
      mockInteraction.reply.mockResolvedValue({
        resource: {
          message: {
            createdTimestamp: 750,
          },
        },
      });

      await pingCommand.execute(mockInteraction);

      const editedMessage = mockInteraction.editReply.mock.calls[0][0];
      expect(editedMessage).toContain('250ms'); // 750 - 500 = 250
      expect(editedMessage).toContain('123ms');
    });

    it('should handle negative latency (clock skew)', async () => {
      mockInteraction.createdTimestamp = 2000;
      mockInteraction.reply.mockResolvedValue({
        resource: {
          message: {
            createdTimestamp: 1500,
          },
        },
      });

      await pingCommand.execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('should include ping emoji', async () => {
      await pingCommand.execute(mockInteraction);

      const editedMessage = mockInteraction.editReply.mock.calls[0][0];
      expect(editedMessage).toContain('🏓');
    });

    it('should include signal emoji', async () => {
      await pingCommand.execute(mockInteraction);

      const editedMessage = mockInteraction.editReply.mock.calls[0][0];
      expect(editedMessage).toContain('📡');
    });

    it('should include heartbeat emoji', async () => {
      await pingCommand.execute(mockInteraction);

      const editedMessage = mockInteraction.editReply.mock.calls[0][0];
      expect(editedMessage).toContain('💓');
    });
  });
});