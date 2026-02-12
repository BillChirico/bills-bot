/**
 * Slowmode Command
 * Set channel slowmode duration
 */

import { SlashCommandBuilder } from 'discord.js';
import { info, error as logError } from '../logger.js';
import { formatDuration, parseDuration } from '../utils/duration.js';

export const data = new SlashCommandBuilder()
  .setName('slowmode')
  .setDescription('Set channel slowmode')
  .addStringOption((opt) =>
    opt
      .setName('duration')
      .setDescription('Slowmode duration (0 to disable, e.g., 5s, 1m, 1h)')
      .setRequired(true),
  )
  .addChannelOption((opt) =>
    opt.setName('channel').setDescription('Channel (defaults to current)').setRequired(false),
  );

export const adminOnly = true;

/**
 * Execute the slowmode command
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.options.getChannel('channel') || interaction.channel;
  const durationStr = interaction.options.getString('duration');

  try {
    let seconds = 0;
    if (durationStr !== '0') {
      const ms = parseDuration(durationStr);
      if (!ms) {
        return await interaction.editReply(
          '❌ Invalid duration format. Use formats like: 5s, 1m, 1h',
        );
      }
      seconds = Math.min(Math.floor(ms / 1000), 21600); // Max 6 hours
    }

    await channel.setRateLimitPerUser(seconds);

    if (seconds === 0) {
      info('Slowmode disabled', { channelId: channel.id, moderator: interaction.user.tag });
      await interaction.editReply(`✅ Slowmode disabled in ${channel}.`);
    } else {
      info('Slowmode set', { channelId: channel.id, seconds, moderator: interaction.user.tag });
      await interaction.editReply(
        `✅ Slowmode set to **${formatDuration(seconds * 1000)}** in ${channel}.`,
      );
    }
  } catch (err) {
    logError('Slowmode command failed', { error: err.message });
    await interaction.editReply(`❌ Failed to set slowmode: ${err.message}`);
  }
}
