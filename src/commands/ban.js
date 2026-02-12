/**
 * Ban Command
 * Bans a user from the server and records a moderation case.
 */

import { SlashCommandBuilder } from 'discord.js';
import { info, error as logError } from '../logger.js';
import { getConfig } from '../modules/config.js';
import {
  checkHierarchy,
  createCase,
  sendDmNotification,
  sendModLogEmbed,
  shouldSendDm,
} from '../modules/moderation.js';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a user from the server')
  .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((opt) =>
    opt.setName('reason').setDescription('Reason for ban').setRequired(false),
  )
  .addIntegerOption((opt) =>
    opt
      .setName('delete_messages')
      .setDescription('Days of messages to delete (0-7)')
      .setMinValue(0)
      .setMaxValue(7)
      .setRequired(false),
  );

export const adminOnly = true;

/**
 * Execute the ban command
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const config = getConfig();
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const deleteMessageDays = interaction.options.getInteger('delete_messages') || 0;

    let member = null;
    try {
      member = await interaction.guild.members.fetch(user.id);
    } catch {
      // User not in guild — skip hierarchy check
    }

    if (member) {
      const hierarchyError = checkHierarchy(interaction.member, member);
      if (hierarchyError) {
        return await interaction.editReply(hierarchyError);
      }

      const botMember = interaction.guild.members.me;
      if (botMember && member.roles.highest.position >= botMember.roles.highest.position) {
        return await interaction.editReply(
          '❌ I cannot ban this member because my role is not high enough.',
        );
      }

      if (shouldSendDm(config, 'ban')) {
        await sendDmNotification(member, 'ban', reason, interaction.guild.name);
      }
    }

    await interaction.guild.members.ban(user.id, {
      deleteMessageSeconds: deleteMessageDays * 86400,
      reason: reason || undefined,
    });

    const caseData = await createCase(interaction.guild.id, {
      action: 'ban',
      targetId: user.id,
      targetTag: user.tag,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      reason,
    });

    await sendModLogEmbed(interaction.client, config, caseData);

    info('User banned', { target: user.tag, moderator: interaction.user.tag });
    await interaction.editReply(
      `✅ **${user.tag}** has been banned. (Case #${caseData.case_number})`,
    );
  } catch (err) {
    logError('Command error', { error: err.message, command: 'ban' });

    const lower = err.message?.toLowerCase() || '';
    const content =
      lower.includes('missing permissions') || lower.includes('missing access')
        ? '❌ I do not have permission to ban that user.'
        : `❌ Failed to execute: ${err.message}`;

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(content);
      } else {
        await interaction.reply({ content, ephemeral: true });
      }
    } catch {
      // Interaction expired/already handled
    }
  }
}
