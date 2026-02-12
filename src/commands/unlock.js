/**
 * Unlock Command
 * Unlock a channel to restore messaging permissions
 */

import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { info, error as logError } from '../logger.js';
import { getConfig } from '../modules/config.js';
import { createCase, sendModLogEmbed } from '../modules/moderation.js';

export const data = new SlashCommandBuilder()
  .setName('unlock')
  .setDescription('Unlock a channel to restore messages')
  .addChannelOption((opt) =>
    opt
      .setName('channel')
      .setDescription('Channel to unlock (defaults to current)')
      .setRequired(false),
  )
  .addStringOption((opt) =>
    opt.setName('reason').setDescription('Reason for unlocking').setRequired(false),
  );

export const adminOnly = true;

/**
 * Execute the unlock command
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.options.getChannel('channel') || interaction.channel;
  const reason = interaction.options.getString('reason');

  try {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: null,
    });

    const notifyEmbed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(
        `🔓 This channel has been unlocked by ${interaction.user}${reason ? `\n**Reason:** ${reason}` : ''}`,
      )
      .setTimestamp();
    await channel.send({ embeds: [notifyEmbed] });

    const config = getConfig();
    const caseData = await createCase(interaction.guild.id, {
      action: 'unlock',
      targetId: channel.id,
      targetTag: `#${channel.name}`,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      reason,
    });
    await sendModLogEmbed(interaction.client, config, caseData);

    info('Channel unlocked', { channelId: channel.id, moderator: interaction.user.tag });
    await interaction.editReply(`✅ ${channel} has been unlocked.`);
  } catch (err) {
    logError('Unlock command failed', { error: err.message });
    await interaction.editReply(`❌ Failed to unlock channel: ${err.message}`);
  }
}
