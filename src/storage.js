/**
 * Storage Layer for Bill Bot
 *
 * Provides persistent storage for conversation history with support
 * for multiple backends (SQLite, JSON files).
 */

/**
 * Base Storage class - defines the interface all storage backends must implement
 */
export class Storage {
  /**
   * Get conversation history for a channel
   * @param {string} channelId - Discord channel ID
   * @param {number} limit - Maximum number of messages to return
   * @returns {Promise<Array<{role: string, content: string, timestamp: number}>>}
   */
  async getHistory(channelId, limit = 20) {
    throw new Error('getHistory() must be implemented by storage backend');
  }

  /**
   * Add a message to conversation history
   * @param {string} channelId - Discord channel ID
   * @param {string} role - Message role (user/assistant/system)
   * @param {string} content - Message content
   * @returns {Promise<void>}
   */
  async addMessage(channelId, role, content) {
    throw new Error('addMessage() must be implemented by storage backend');
  }

  /**
   * Prune old messages from storage
   * @param {number} daysOld - Delete messages older than this many days
   * @returns {Promise<number>} Number of messages deleted
   */
  async pruneOldMessages(daysOld) {
    throw new Error('pruneOldMessages() must be implemented by storage backend');
  }

  /**
   * Close/cleanup storage resources
   * @returns {Promise<void>}
   */
  async close() {
    // Default: no-op, backends can override if needed
  }
}

/**
 * In-Memory Storage - simple Map-based storage (no persistence)
 * Useful for testing and development
 */
export class MemoryStorage extends Storage {
  constructor() {
    super();
    this.conversations = new Map();
  }

  async getHistory(channelId, limit = 20) {
    const history = this.conversations.get(channelId) || [];
    return history.slice(-limit);
  }

  async addMessage(channelId, role, content) {
    if (!this.conversations.has(channelId)) {
      this.conversations.set(channelId, []);
    }
    const history = this.conversations.get(channelId);
    history.push({
      role,
      content,
      timestamp: Date.now()
    });
  }

  async pruneOldMessages(daysOld) {
    const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    let deleted = 0;

    for (const [channelId, history] of this.conversations.entries()) {
      const originalLength = history.length;
      const filtered = history.filter(msg => msg.timestamp >= cutoff);
      this.conversations.set(channelId, filtered);
      deleted += originalLength - filtered.length;
    }

    return deleted;
  }
}

/**
 * Storage Factory - creates appropriate storage backend based on configuration
 */
export class StorageFactory {
  /**
   * Create a storage instance
   * @param {string} backend - Storage backend type ('memory', 'sqlite', 'json')
   * @param {Object} options - Backend-specific configuration
   * @returns {Storage}
   */
  static create(backend = 'memory', options = {}) {
    switch (backend.toLowerCase()) {
      case 'memory':
        return new MemoryStorage();

      case 'sqlite':
        // SQLite backend will be implemented in next subtask
        throw new Error('SQLite storage not yet implemented');

      case 'json':
        // JSON backend will be implemented in subtask after SQLite
        throw new Error('JSON storage not yet implemented');

      default:
        throw new Error(`Unknown storage backend: ${backend}`);
    }
  }
}
