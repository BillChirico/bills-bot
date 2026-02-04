/**
 * Rate Limiting Utility
 *
 * Provides per-user and per-channel rate limiting for AI requests
 * using a timestamp-based sliding window approach.
 */

import { info, warn, debug } from '../logger.js';

// Rate limiting tracking (timestamp-based sliding window)
const userRateLimits = new Map();
const channelRateLimits = new Map();

// Cleanup interval reference
let cleanupInterval = null;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Clean up every 5 minutes

/**
 * Check if user and channel are within rate limits
 * @param {string} userId - Discord user ID
 * @param {string} channelId - Discord channel ID
 * @param {Object} config - Bot configuration
 * @returns {{ allowed: boolean, retryAfter: number }} - Whether request is allowed and seconds until next allowed request
 */
export function checkRateLimit(userId, channelId, config) {
  if (!config.rateLimit?.enabled) {
    return { allowed: true, retryAfter: 0 };
  }

  const now = Date.now();

  // Check user rate limit
  const userLimit = config.rateLimit.perUser;
  const userWindowMs = userLimit.windowMinutes * 60 * 1000;

  if (!userRateLimits.has(userId)) {
    userRateLimits.set(userId, []);
  }

  const userTimestamps = userRateLimits.get(userId);
  const userRecentRequests = userTimestamps.filter(ts => now - ts < userWindowMs);

  if (userRecentRequests.length >= userLimit.requestsPerMinute) {
    const oldestRequest = Math.min(...userRecentRequests);
    const retryAfter = Math.ceil((oldestRequest + userWindowMs - now) / 1000);
    warn('Rate limit exceeded for user', {
      userId,
      requests: userRecentRequests.length,
      limit: userLimit.requestsPerMinute,
      retryAfter
    });
    return { allowed: false, retryAfter, type: 'user' };
  }

  // Check channel rate limit
  const channelLimit = config.rateLimit.perChannel;
  const channelWindowMs = channelLimit.windowMinutes * 60 * 1000;

  if (!channelRateLimits.has(channelId)) {
    channelRateLimits.set(channelId, []);
  }

  const channelTimestamps = channelRateLimits.get(channelId);
  const channelRecentRequests = channelTimestamps.filter(ts => now - ts < channelWindowMs);

  if (channelRecentRequests.length >= channelLimit.requestsPerMinute) {
    const oldestRequest = Math.min(...channelRecentRequests);
    const retryAfter = Math.ceil((oldestRequest + channelWindowMs - now) / 1000);
    warn('Rate limit exceeded for channel', {
      channelId,
      requests: channelRecentRequests.length,
      limit: channelLimit.requestsPerMinute,
      retryAfter
    });
    return { allowed: false, retryAfter, type: 'channel' };
  }

  // Update tracking with current request
  userTimestamps.push(now);
  userRateLimits.set(userId, userTimestamps.filter(ts => now - ts < userWindowMs));

  channelTimestamps.push(now);
  channelRateLimits.set(channelId, channelTimestamps.filter(ts => now - ts < channelWindowMs));

  debug('Rate limit check passed', { userId, channelId });
  return { allowed: true, retryAfter: 0 };
}

/**
 * Clean up old rate limit entries to prevent memory leaks
 * @param {Object} config - Bot configuration
 */
export function cleanupOldEntries(config) {
  if (!config.rateLimit?.enabled) return;

  const now = Date.now();
  const userWindowMs = config.rateLimit.perUser.windowMinutes * 60 * 1000;
  const channelWindowMs = config.rateLimit.perChannel.windowMinutes * 60 * 1000;
  const maxWindowMs = Math.max(userWindowMs, channelWindowMs);

  let usersCleaned = 0;
  let channelsCleaned = 0;

  // Clean up user rate limits
  for (const [userId, timestamps] of userRateLimits.entries()) {
    const recent = timestamps.filter(ts => now - ts < maxWindowMs);
    if (recent.length === 0) {
      userRateLimits.delete(userId);
      usersCleaned++;
    } else {
      userRateLimits.set(userId, recent);
    }
  }

  // Clean up channel rate limits
  for (const [channelId, timestamps] of channelRateLimits.entries()) {
    const recent = timestamps.filter(ts => now - ts < maxWindowMs);
    if (recent.length === 0) {
      channelRateLimits.delete(channelId);
      channelsCleaned++;
    } else {
      channelRateLimits.set(channelId, recent);
    }
  }

  if (usersCleaned > 0 || channelsCleaned > 0) {
    debug('Rate limit cleanup completed', { usersCleaned, channelsCleaned });
  }
}

/**
 * Start the rate limit cleanup interval
 * @param {Object} config - Bot configuration
 */
export function startRateLimitCleanup(config) {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  if (config.rateLimit?.enabled) {
    cleanupInterval = setInterval(() => cleanupOldEntries(config), CLEANUP_INTERVAL_MS);
    info('Rate limiting enabled', {
      perUser: config.rateLimit.perUser,
      perChannel: config.rateLimit.perChannel
    });
  }
}

/**
 * Stop the rate limit cleanup interval
 */
export function stopRateLimitCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Get user-friendly rate limit message
 * @param {number} retryAfter - Seconds until next allowed request
 * @param {string} type - 'user' or 'channel'
 * @returns {string} User-friendly message
 */
export function getRateLimitMessage(retryAfter, type = 'user') {
  if (type === 'channel') {
    return `This channel is getting a lot of activity! Please wait ${retryAfter} seconds before asking me something.`;
  }
  return `Whoa there! You're asking too fast. Please wait ${retryAfter} seconds before trying again.`;
}
