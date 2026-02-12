import { ChannelType } from 'discord.js';
import { vi } from 'vitest';

/**
 * Create a mock channel for lock/unlock tests.
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock channel
 */
export function createMockChannel(overrides = {}) {
  const id = overrides.id || 'chan1';
  return {
    id,
    name: overrides.name || 'general',
    type: overrides.type || ChannelType.GuildText,
    permissionOverwrites: { edit: vi.fn().mockResolvedValue(undefined) },
    send: vi.fn().mockResolvedValue(undefined),
    toString: () => `<#${id}>`,
    ...overrides,
  };
}

/**
 * Create a mock interaction for lock/unlock channel commands.
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock interaction
 */
export function createChannelCommandInteraction(overrides = {}) {
  return {
    options: {
      getChannel: vi.fn().mockReturnValue(null),
      getString: vi.fn().mockReturnValue(null),
    },
    channel: createMockChannel(),
    guild: {
      id: 'guild1',
      roles: { everyone: { id: 'everyone-role' } },
    },
    user: { id: 'mod1', tag: 'Mod#0001', toString: () => '<@mod1>' },
    client: { channels: { fetch: vi.fn() } },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    deferred: true,
    ...overrides,
  };
}
