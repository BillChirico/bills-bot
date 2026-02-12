/**
 * Unban Command
 * Unbans a user from the server and records a moderation case.
 */

import { SlashCommandBuilder } from 'discord.js';
import { info, error as logError } from '../logger.js';
import { getConfig } from '../modules/config.js';
import { createCase, sendModLogEmbed } from '../modules/moderation.js';

export const data = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Unban a user from the server')
  .addStringOption((opt) =>
    opt.setName('user_id').setDescription('User ID to unban').setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName('reason').setDescription('Reason for unban').setRequired(false),
  );

export const adminOnly = true;

/**
 * Execute the unban command
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const config = getConfig();
    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason');

    await interaction.guild.members.unban(userId, reason || undefined);

    const caseData = await createCase(interaction.guild.id, {
      action: 'unban',
      targetId: userId,
      targetTag: userId,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      reason,
    });

    await sendModLogEmbed(interaction.client, config, caseData);

    info('User unbanned', { target: userId, moderator: interaction.user.tag });
    await interaction.editReply(
      `✅ **${userId}** has been unbanned. (Case #${caseData.case_number})`,
    );
  } catch (err) {
    logError('Command error', { error: err.message, command: 'unban' });
    const content = `❌ Failed to execute: ${err.message}`;
    if (interaction.deferred) {
      await interaction.editReply(content);
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  }
}
