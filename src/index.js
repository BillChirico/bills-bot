/**
 * Bill Bot - Volvox Discord Bot
 * Main entry point - orchestrates modules
 *
 * Features:
 * - AI chat powered by Claude
 * - Welcome messages for new members
 * - Spam/scam detection and moderation
 */

import { Client, GatewayIntentBits } from 'discord.js';
import { config as dotenvConfig } from 'dotenv';
import { loadConfig } from './modules/config.js';
import { registerEventHandlers } from './modules/events.js';

// Load environment variables
dotenvConfig();

// Load configuration
const config = loadConfig();

// Initialize Discord client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Register all event handlers
registerEventHandlers(client, config);

// Login to Discord
client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error('❌ Login failed:', err.message);
  process.exit(1);
});
