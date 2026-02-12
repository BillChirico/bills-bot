import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/duration.js', () => ({
  parseDuration: vi.fn(),
  formatDuration: vi.fn().mockReturnValue('5 minutes'),
}));
vi.mock('../../src/logger.js', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));

import { adminOnly, data, execute } from '../../src/commands/slowmode.js';
import { parseDuration } from '../../src/utils/duration.js';

function createInteraction(duration = '5m', channel = null) {
  const mockChannel = channel || {
    id: 'ch1',
    name: 'general',
    setRateLimitPerUser: vi.fn().mockResolvedValue(undefined),
    toString: () => '<#ch1>',
  };

  return {
    options: {
      getString: vi.fn().mockReturnValue(duration),
      getChannel: vi.fn().mockReturnValue(null),
    },
    channel: mockChannel,
    user: { id: 'mod1', tag: 'Mod#0001' },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  };
}

describe('slowmode command', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should export data with correct name', () => {
    expect(data.name).toBe('slowmode');
  });

  it('should export adminOnly flag', () => {
    expect(adminOnly).toBe(true);
  });

  it('should set slowmode with valid duration', async () => {
    parseDuration.mockReturnValue(300000); // 5 minutes

    const interaction = createInteraction('5m');
    await execute(interaction);

    expect(interaction.channel.setRateLimitPerUser).toHaveBeenCalledWith(300);
    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('Slowmode set to'));
  });

  it('should disable slowmode with "0"', async () => {
    const interaction = createInteraction('0');
    await execute(interaction);

    expect(interaction.channel.setRateLimitPerUser).toHaveBeenCalledWith(0);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('Slowmode disabled'),
    );
  });

  it('should reject invalid duration', async () => {
    parseDuration.mockReturnValue(null);

    const interaction = createInteraction('abc');
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('Invalid duration'));
  });

  it('should cap at 6 hours (21600 seconds)', async () => {
    parseDuration.mockReturnValue(86400000); // 24 hours

    const interaction = createInteraction('24h');
    await execute(interaction);

    expect(interaction.channel.setRateLimitPerUser).toHaveBeenCalledWith(21600);
  });

  it('should use specified channel when provided', async () => {
    parseDuration.mockReturnValue(60000); // 1 minute
    const targetChannel = {
      id: 'ch2',
      name: 'other',
      setRateLimitPerUser: vi.fn().mockResolvedValue(undefined),
      toString: () => '<#ch2>',
    };

    const interaction = createInteraction('1m');
    interaction.options.getChannel = vi.fn().mockReturnValue(targetChannel);
    await execute(interaction);

    expect(targetChannel.setRateLimitPerUser).toHaveBeenCalledWith(60);
  });

  it('should handle errors gracefully', async () => {
    parseDuration.mockReturnValue(60000);

    const interaction = createInteraction('1m');
    interaction.channel.setRateLimitPerUser = vi
      .fn()
      .mockRejectedValue(new Error('Missing permissions'));
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('Failed to set slowmode'),
    );
  });
});
