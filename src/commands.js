/**
 * Bill Bot - Slash Command Definitions
 *
 * Defines all slash commands for Discord interactions
 */

import { SlashCommandBuilder } from 'discord.js';

/**
 * Slash command definitions
 * Each command is built using Discord's SlashCommandBuilder
 */
const commands = [
  // /ask - AI chat command
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask the AI a question')
    .addStringOption(option =>
      option
        .setName('question')
        .setDescription('Your question for the AI')
        .setRequired(true)
    ),

  // /help - Show available commands
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available commands and usage instructions'),

  // /clear - Reset conversation history
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear your conversation history with the bot'),

  // /status - Show bot health and stats
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show bot status, uptime, and health information'),
];

/**
 * Export commands as JSON for registration with Discord API
 */
export const commandData = commands.map(command => command.toJSON());

/**
 * Export commands array for reference
 */
export default commands;
