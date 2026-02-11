import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock logger
vi.mock('../src/logger.js', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

// We mock pg with a constructor that returns a mock pool
const mockClient = {
  query: vi.fn().mockResolvedValue({ rows: [] }),
  release: vi.fn(),
};

const mockPool = {
  connect: vi.fn().mockResolvedValue(mockClient),
  query: vi.fn().mockResolvedValue({ rows: [] }),
  end: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
};

vi.mock('pg', () => {
  return {
    default: {
      Pool: vi.fn(function MockPool() {
        return mockPool;
      }),
    },
  };
});

describe('db module', () => {
  let initDb;
  let getPool;
  let closeDb;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Reset mock implementations
    mockClient.query.mockResolvedValue({ rows: [] });
    mockPool.connect.mockResolvedValue(mockClient);
    mockPool.query.mockResolvedValue({ rows: [] });
    mockPool.end.mockResolvedValue(undefined);

    // Set DATABASE_URL for tests
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

    const db = await import('../src/db.js');
    initDb = db.initDb;
    getPool = db.getPool;
    closeDb = db.closeDb;
  });

  afterEach(async () => {
    try {
      await closeDb();
    } catch {
      // ignore
    }
    delete process.env.DATABASE_URL;
    vi.restoreAllMocks();
  });

  describe('initDb', () => {
    it('should create pool and initialize schema', async () => {
      const pool = await initDb();
      expect(pool).toBeDefined();

      // Should have created config table
      const queries = mockPool.query.mock.calls.map((c) => c[0]);
      expect(queries.some((q) => q.includes('CREATE TABLE IF NOT EXISTS config'))).toBe(true);

      // Should have created conversations table
      expect(queries.some((q) => q.includes('CREATE TABLE IF NOT EXISTS conversations'))).toBe(
        true,
      );

      // Should have created indexes
      expect(queries.some((q) => q.includes('idx_conversations_channel_created'))).toBe(true);
      expect(queries.some((q) => q.includes('idx_conversations_created_at'))).toBe(true);
    });

    it('should return existing pool on subsequent calls', async () => {
      const pool1 = await initDb();
      const pool2 = await initDb();
      expect(pool1).toBe(pool2);
    });

    it('should reject concurrent initDb calls while initialization is in progress', async () => {
      let resolveConnect;
      const pendingConnect = new Promise((resolve) => {
        resolveConnect = resolve;
      });
      mockPool.connect.mockImplementationOnce(() => pendingConnect);

      const firstInit = initDb();
      const secondInit = initDb();

      await expect(secondInit).rejects.toThrow('initDb is already in progress');

      resolveConnect(mockClient);
      const pool = await firstInit;
      expect(pool).toBeDefined();
      expect(mockPool.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPool', () => {
    it('should throw if pool not initialized', () => {
      expect(() => getPool()).toThrow('Database not initialized');
    });

    it('should return pool after initialization', async () => {
      await initDb();
      const pool = getPool();
      expect(pool).toBeDefined();
    });
  });

  describe('closeDb', () => {
    it('should close pool gracefully', async () => {
      await initDb();
      await closeDb();
      expect(mockPool.end).toHaveBeenCalled();
    });

    it('should handle close when no pool exists', async () => {
      // Should not throw
      await closeDb();
    });
  });

  describe('conversations table schema', () => {
    it('should include all required columns', async () => {
      await initDb();

      const queries = mockPool.query.mock.calls.map((c) => c[0]);
      const createTableSql = queries.find((q) =>
        q.includes('CREATE TABLE IF NOT EXISTS conversations'),
      );

      expect(createTableSql).toBeDefined();
      expect(createTableSql).toContain('channel_id TEXT NOT NULL');
      expect(createTableSql).toContain('role TEXT NOT NULL');
      expect(createTableSql).toContain('content TEXT NOT NULL');
      expect(createTableSql).toContain('username TEXT');
      expect(createTableSql).toContain('created_at TIMESTAMPTZ');
      expect(createTableSql).toContain('id SERIAL PRIMARY KEY');
    });

    it('should create composite index on channel_id and created_at', async () => {
      await initDb();

      const queries = mockPool.query.mock.calls.map((c) => c[0]);
      const indexSql = queries.find((q) => q.includes('idx_conversations_channel_created'));

      expect(indexSql).toBeDefined();
      expect(indexSql).toContain('channel_id');
      expect(indexSql).toContain('created_at');
    });

    it('should create standalone created_at index for TTL cleanup', async () => {
      await initDb();

      const queries = mockPool.query.mock.calls.map((c) => c[0]);
      const indexSql = queries.find((q) => q.includes('idx_conversations_created_at'));

      expect(indexSql).toBeDefined();
      expect(indexSql).toContain('ON conversations (created_at)');
    });
  });
});
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pgMocks = vi.hoisted(() => ({
  poolConfig: null,
  poolQuery: vi.fn(),
  poolOn: vi.fn(),
  poolConnect: vi.fn(),
  poolEnd: vi.fn(),
  clientQuery: vi.fn(),
  clientRelease: vi.fn(),
}));

vi.mock('../src/logger.js', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('pg', () => {
  class Pool {
    constructor(config) {
      pgMocks.poolConfig = config;
    }

    query(...args) {
      return pgMocks.poolQuery(...args);
    }

    on(...args) {
      return pgMocks.poolOn(...args);
    }

    connect(...args) {
      return pgMocks.poolConnect(...args);
    }

    end(...args) {
      return pgMocks.poolEnd(...args);
    }
  }

  return { default: { Pool } };
});

describe('db module', () => {
  let dbModule;
  let originalDatabaseUrl;
  let originalDatabaseSsl;

  beforeEach(async () => {
    vi.resetModules();

    // Save original env vars to restore after each test
    originalDatabaseUrl = process.env.DATABASE_URL;
    originalDatabaseSsl = process.env.DATABASE_SSL;

    pgMocks.poolConfig = null;
    pgMocks.poolQuery.mockReset().mockResolvedValue({});
    pgMocks.poolOn.mockReset();
    pgMocks.poolConnect.mockReset();
    pgMocks.poolEnd.mockReset().mockResolvedValue(undefined);
    pgMocks.clientQuery.mockReset().mockResolvedValue({});
    pgMocks.clientRelease.mockReset();

    pgMocks.poolConnect.mockResolvedValue({
      query: pgMocks.clientQuery,
      release: pgMocks.clientRelease,
    });

    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
    delete process.env.DATABASE_SSL;

    dbModule = await import('../src/db.js');
  });

  afterEach(async () => {
    try {
      await dbModule.closeDb();
    } catch {
      // ignore cleanup failures
    }

    // Restore original env vars
    if (originalDatabaseUrl !== undefined) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
    if (originalDatabaseSsl !== undefined) {
      process.env.DATABASE_SSL = originalDatabaseSsl;
    } else {
      delete process.env.DATABASE_SSL;
    }
    vi.clearAllMocks();
  });

  describe('initDb', () => {
    it('should initialize database pool', async () => {
      const pool = await dbModule.initDb();
      expect(pool).toBeDefined();
      expect(pgMocks.poolConnect).toHaveBeenCalled();
      expect(pgMocks.clientQuery).toHaveBeenCalledWith('SELECT NOW()');
      expect(pgMocks.clientRelease).toHaveBeenCalled();
      expect(pgMocks.poolQuery).toHaveBeenCalled();
    });

    it('should return existing pool on second call', async () => {
      const pool1 = await dbModule.initDb();
      const pool2 = await dbModule.initDb();
      expect(pool1).toBe(pool2);
      expect(pgMocks.poolConnect).toHaveBeenCalledTimes(1);
    });

    it('should throw if DATABASE_URL is not set', async () => {
      delete process.env.DATABASE_URL;
      await expect(dbModule.initDb()).rejects.toThrow(
        'DATABASE_URL environment variable is not set',
      );
    });

    it('should clean up pool on connection test failure', async () => {
      pgMocks.poolConnect.mockRejectedValueOnce(new Error('connection failed'));
      await expect(dbModule.initDb()).rejects.toThrow('connection failed');
      expect(pgMocks.poolEnd).toHaveBeenCalled();
    });
  });

  describe('getPool', () => {
    it('should throw if pool not initialized', () => {
      expect(() => dbModule.getPool()).toThrow('Database not initialized');
    });

    it('should return pool after init', async () => {
      await dbModule.initDb();
      expect(dbModule.getPool()).toBeDefined();
    });
  });

  describe('closeDb', () => {
    it('should close pool', async () => {
      await dbModule.initDb();
      await dbModule.closeDb();
      expect(pgMocks.poolEnd).toHaveBeenCalled();
    });

    it('should do nothing if pool not initialized', async () => {
      await dbModule.closeDb();
    });

    it('should handle close error gracefully', async () => {
      await dbModule.initDb();
      pgMocks.poolEnd.mockRejectedValueOnce(new Error('close failed'));
      await dbModule.closeDb();
    });
  });

  describe('SSL configuration', () => {
    it('should disable SSL for railway.internal connections', async () => {
      process.env.DATABASE_URL = 'postgresql://test@postgres.railway.internal:5432/db';
      await dbModule.initDb();
      expect(pgMocks.poolConfig.ssl).toBe(false);
    });

    it('should disable SSL when DATABASE_SSL is "false"', async () => {
      process.env.DATABASE_URL = 'postgresql://test@localhost/db';
      process.env.DATABASE_SSL = 'false';
      await dbModule.initDb();
      expect(pgMocks.poolConfig.ssl).toBe(false);
    });

    it('should disable SSL when DATABASE_SSL is "off"', async () => {
      process.env.DATABASE_URL = 'postgresql://test@localhost/db';
      process.env.DATABASE_SSL = 'off';
      await dbModule.initDb();
      expect(pgMocks.poolConfig.ssl).toBe(false);
    });

    it('should use rejectUnauthorized: false for "no-verify"', async () => {
      process.env.DATABASE_URL = 'postgresql://test@localhost/db';
      process.env.DATABASE_SSL = 'no-verify';
      await dbModule.initDb();
      expect(pgMocks.poolConfig.ssl).toEqual({ rejectUnauthorized: false });
    });

    it('should use rejectUnauthorized: true by default', async () => {
      process.env.DATABASE_URL = 'postgresql://test@localhost/db';
      delete process.env.DATABASE_SSL;
      await dbModule.initDb();
      expect(pgMocks.poolConfig.ssl).toEqual({ rejectUnauthorized: true });
    });
  });
});
