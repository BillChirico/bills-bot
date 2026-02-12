/**
 * Purge Command
 * Bulk delete messages with filtering subcommands
 */

import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { info, error as logError } from '../logger.js';
import { getConfig } from '../modules/config.js';

export const data = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('Bulk delete messages')
  .addSubcommand((sub) =>
    sub
      .setName('all')
      .setDescription('Delete recent messages')
      .addIntegerOption((opt) =>
        opt
          .setName('count')
          .setDescription('Number of messages (1-100)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('user')
      .setDescription('Delete messages from a specific user')
      .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(true))
      .addIntegerOption((opt) =>
        opt
          .setName('count')
          .setDescription('Number of messages to scan (1-100)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('bot')
      .setDescription('Delete messages from bots')
      .addIntegerOption((opt) =>
        opt
          .setName('count')
          .setDescription('Number of messages to scan (1-100)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('contains')
      .setDescription('Delete messages containing text')
      .addStringOption((opt) =>
        opt.setName('text').setDescription('Text to search for').setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('count')
          .setDescription('Number of messages to scan (1-100)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('links')
      .setDescription('Delete messages containing links')
      .addIntegerOption((opt) =>
        opt
          .setName('count')
          .setDescription('Number of messages to scan (1-100)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('attachments')
      .setDescription('Delete messages with attachments')
      .addIntegerOption((opt) =>
        opt
          .setName('count')
          .setDescription('Number of messages to scan (1-100)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100),
      ),
  );

export const adminOnly = true;

/**
 * Execute the purge command
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const subcommand = interaction.options.getSubcommand();
  const count = interaction.options.getInteger('count');
  const channel = interaction.channel;

  try {
    const fetched = await channel.messages.fetch({ limit: count });

    // Filter out messages older than 14 days (Discord bulk delete limit)
    const fourteenDaysAgo = Date.now() - 14 * 86400 * 1000;
    let filtered = fetched.filter((m) => m.createdTimestamp > fourteenDaysAgo);

    switch (subcommand) {
      case 'user': {
        const user = interaction.options.getUser('user');
        filtered = filtered.filter((m) => m.author.id === user.id);
        break;
      }
      case 'bot':
        filtered = filtered.filter((m) => m.author.bot);
        break;
      case 'contains': {
        const text = interaction.options.getString('text').toLowerCase();
        filtered = filtered.filter((m) => m.content.toLowerCase().includes(text));
        break;
      }
      case 'links':
        filtered = filtered.filter((m) => /https?:\/\/\S+/i.test(m.content));
        break;
      case 'attachments':
        filtered = filtered.filter((m) => m.attachments.size > 0);
        break;
      // 'all' — no additional filter needed
    }

    const deleted = await channel.bulkDelete(filtered, true);

    info('Purge executed', {
      guildId: interaction.guild.id,
      channelId: channel.id,
      moderator: interaction.user.tag,
      subcommand,
      deleted: deleted.size,
    });

    // Send mod log embed for the purge action
    try {
      const config = getConfig();
      const channels = config.moderation?.logging?.channels;
      if (channels) {
        const channelId = channels.purges || channels.default;
        if (channelId) {
          const logChannel = await interaction.client.channels.fetch(channelId).catch(() => null);
          if (logChannel) {
            const embed = new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle(`Purge — ${subcommand.toUpperCase()}`)
              .addFields(
                { name: 'Channel', value: `<#${channel.id}>`, inline: true },
                {
                  name: 'Moderator',
                  value: `<@${interaction.user.id}> (${interaction.user.tag})`,
                  inline: true,
                },
                { name: 'Deleted', value: `${deleted.size} message(s)`, inline: true },
                { name: 'Filter', value: subcommand === 'all' ? 'None' : subcommand },
              )
              .setTimestamp();

            await logChannel.send({ embeds: [embed] });
          }
        }
      }
    } catch (err) {
      logError('Failed to send purge log', { error: err.message });
    }

    await interaction.editReply(`Deleted **${deleted.size}** message(s).`);
  } catch (err) {
    logError('Purge command failed', { error: err.message, subcommand });
    await interaction.editReply(
      'Failed to delete messages. Messages older than 14 days cannot be bulk deleted.',
    );
  }
}
