/**
 * Configuration Module
 * Loads config from PostgreSQL with config.json as the seed/fallback
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getPool } from '../db.js';
import { info, error as logError } from '../logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, '..', '..', 'config.json');

/** @type {Object} In-memory config cache */
let configCache = {};

/**
 * Load config.json from disk (used as seed/fallback)
 * @returns {Object} Configuration object from file
 */
export function loadConfigFromFile() {
  try {
    if (!existsSync(configPath)) {
      console.error('❌ config.json not found!');
      process.exit(1);
    }
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch (err) {
    console.error('❌ Failed to load config.json:', err.message);
    process.exit(1);
  }
}

/**
 * Load config from PostgreSQL, seeding from config.json if empty
 * Falls back to config.json if database is unavailable
 * @returns {Promise<Object>} Configuration object
 */
export async function loadConfig() {
  const fileConfig = loadConfigFromFile();

  try {
    let pool;
    try {
      pool = getPool();
    } catch {
      // DB not initialized — use file config
      info('Database not available, using config.json');
      configCache = { ...fileConfig };
      return configCache;
    }

    // Check if config table has any rows
    const { rows } = await pool.query('SELECT key, value FROM config');

    if (rows.length === 0) {
      // Seed database from config.json
      info('No config in database, seeding from config.json');
      for (const [key, value] of Object.entries(fileConfig)) {
        await pool.query(
          'INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
          [key, JSON.stringify(value)]
        );
      }
      info('Config seeded to database');
      configCache = { ...fileConfig };
    } else {
      // Load from database
      configCache = {};
      for (const row of rows) {
        configCache[row.key] = row.value;
      }
      info('Config loaded from database');
    }
  } catch (err) {
    logError('Failed to load config from database, using config.json', { error: err.message });
    configCache = { ...fileConfig };
  }

  return configCache;
}

/**
 * Get the current config (from cache)
 * @returns {Object} Configuration object
 */
export function getConfig() {
  return configCache;
}

/**
 * Get a specific config section
 * @param {string} section - Top-level config section name
 * @returns {Object|undefined} Section config or undefined
 */
export function getConfigSection(section) {
  return configCache[section];
}

/**
 * Set a config value using dot notation (e.g., "ai.model" or "welcome.enabled")
 * Persists to database and updates in-memory cache
 * @param {string} path - Dot-notation path (e.g., "ai.model")
 * @param {*} value - Value to set (automatically parsed from string)
 * @returns {Promise<Object>} Updated section config
 */
export async function setConfigValue(path, value) {
  const parts = path.split('.');
  if (parts.length < 2) {
    throw new Error('Path must include section and key (e.g., "ai.model")');
  }

  const section = parts[0];

  // Create a deep clone of the section to avoid mutating cache before DB write succeeds
  const sectionClone = JSON.parse(JSON.stringify(configCache[section] || {}));

  // Navigate to the nested key and set the value on the clone
  let current = sectionClone;
  for (let i = 1; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }

  const finalKey = parts[parts.length - 1];
  const parsedValue = parseValue(value);
  current[finalKey] = parsedValue;

  // Update database first, before modifying the cache
  const pool = getPool();
  await pool.query(
    'INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
    [section, JSON.stringify(sectionClone)]
  );

  // Only update in-memory cache after DB write succeeds
  configCache[section] = sectionClone;

  info('Config updated', { path, value: parsedValue });
  return configCache[section];
}

/**
 * Reset a config section to config.json defaults
 * @param {string} [section] - Section to reset, or all if omitted
 * @returns {Promise<Object>} Reset config
 */
export async function resetConfig(section) {
  const fileConfig = loadConfigFromFile();
  const pool = getPool();

  if (section) {
    if (!fileConfig[section]) {
      throw new Error(`Section '${section}' not found in config.json defaults`);
    }

    await pool.query(
      'INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
      [section, JSON.stringify(fileConfig[section])]
    );

    // Mutate in-place so references stay valid
    const sectionData = configCache[section];
    if (sectionData && typeof sectionData === 'object') {
      for (const key of Object.keys(sectionData)) delete sectionData[key];
      Object.assign(sectionData, fileConfig[section]);
    } else {
      configCache[section] = { ...fileConfig[section] };
    }
    info('Config section reset', { section });
  } else {
    // Reset all — mutate in-place
    for (const [key, value] of Object.entries(fileConfig)) {
      await pool.query(
        'INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
        [key, JSON.stringify(value)]
      );
      if (configCache[key] && typeof configCache[key] === 'object') {
        for (const k of Object.keys(configCache[key])) delete configCache[key][k];
        Object.assign(configCache[key], value);
      } else {
        configCache[key] = { ...value };
      }
    }
    info('All config reset to defaults');
  }

  return configCache;
}

/**
 * Parse a string value into its appropriate JS type
 * @param {string} value - String value to parse
 * @returns {*} Parsed value
 */
function parseValue(value) {
  if (typeof value !== 'string') return value;

  // Booleans
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Null
  if (value === 'null') return null;

  // Numbers (keep large integers as strings to preserve Discord snowflake IDs)
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    const num = Number(value);
    // If it's an integer that exceeds MAX_SAFE_INTEGER, keep it as a string
    if (Number.isInteger(num) && !Number.isSafeInteger(num)) {
      return value;
    }
    return num;
  }

  // JSON arrays/objects
  if ((value.startsWith('[') && value.endsWith(']')) || (value.startsWith('{') && value.endsWith('}'))) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  // Plain string
  return value;
}
