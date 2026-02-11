/**
 * Shared command loading utility
 *
 * Loads all command modules from the commands directory with proper error handling.
 */

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { error as logError, warn as logWarn } from '../logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const commandsPath = join(__dirname, '..', 'commands');

/**
 * Load all command modules from the commands directory
 * @returns {Promise<Array<{data: object, execute: function}>>} Array of loaded command modules
 */
export async function loadCommands() {
  const commandFiles = readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
  const commands = [];

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    try {
      const command = await import(filePath);
      if (command.data && command.execute) {
        commands.push(command);
      } else {
        logWarn('Command missing data or execute export', { file });
      }
    } catch (err) {
      logError('Failed to load command', { file, error: err.message });
    }
  }

  return commands;
}
