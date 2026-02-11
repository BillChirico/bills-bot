import { describe, expect, it, vi } from 'vitest';

// Mock discord.js PermissionFlagsBits before importing permissions module
vi.mock('discord.js', () => ({
  PermissionFlagsBits: {
    Administrator: BigInt(0x8),
  },
}));

const { getPermissionError, hasPermission, isAdmin } = await import('../src/utils/permissions.js');

describe('permissions', () => {
  // Helper to create mock member
  const createMockMember = (opts = {}) => ({
    permissions: {
      has: vi.fn().mockReturnValue(opts.isDiscordAdmin || false),
    },
    roles: {
      cache: {
        has: vi.fn().mockReturnValue(opts.hasAdminRole || false),
      },
    },
  });

  describe('isAdmin()', () => {
    it('should return false for null member', () => {
      expect(isAdmin(null, {})).toBe(false);
    });

    it('should return false for null config', () => {
      expect(isAdmin(createMockMember(), null)).toBe(false);
    });

    it('should return true for Discord Administrator', () => {
      const member = createMockMember({ isDiscordAdmin: true });
      expect(isAdmin(member, {})).toBe(true);
    });

    it('should return true for configured admin role', () => {
      const member = createMockMember({ hasAdminRole: true });
      const config = { permissions: { adminRoleId: '12345' } };
      expect(isAdmin(member, config)).toBe(true);
      expect(member.roles.cache.has).toHaveBeenCalledWith('12345');
    });

    it('should return false for non-admin member', () => {
      const member = createMockMember();
      const config = { permissions: { adminRoleId: '12345' } };
      expect(isAdmin(member, config)).toBe(false);
    });
  });

  describe('hasPermission()', () => {
    it('should return false for null member', () => {
      expect(hasPermission(null, 'ping', {})).toBe(false);
    });

    it('should return false for null commandName', () => {
      expect(hasPermission(createMockMember(), null, {})).toBe(false);
    });

    it('should return false for null config', () => {
      expect(hasPermission(createMockMember(), 'ping', null)).toBe(false);
    });

    it('should return true when permissions disabled', () => {
      const member = createMockMember();
      const config = { permissions: { enabled: false } };
      expect(hasPermission(member, 'ping', config)).toBe(true);
    });

    it('should return true when usePermissions is false', () => {
      const member = createMockMember();
      const config = { permissions: { enabled: true, usePermissions: false } };
      expect(hasPermission(member, 'ping', config)).toBe(true);
    });

    it('should return true for everyone permission level', () => {
      const member = createMockMember();
      const config = {
        permissions: {
          enabled: true,
          usePermissions: true,
          allowedCommands: { ping: 'everyone' },
        },
      };
      expect(hasPermission(member, 'ping', config)).toBe(true);
    });

    it('should return true for admin permission level when user is admin', () => {
      const member = createMockMember({ isDiscordAdmin: true });
      const config = {
        permissions: {
          enabled: true,
          usePermissions: true,
          allowedCommands: { config: 'admin' },
        },
      };
      expect(hasPermission(member, 'config', config)).toBe(true);
    });

    it('should return false for admin permission level when user is not admin', () => {
      const member = createMockMember();
      const config = {
        permissions: {
          enabled: true,
          usePermissions: true,
          allowedCommands: { config: 'admin' },
        },
      };
      expect(hasPermission(member, 'config', config)).toBe(false);
    });

    it('should require admin for unconfigured commands', () => {
      const member = createMockMember();
      const config = {
        permissions: {
          enabled: true,
          usePermissions: true,
          allowedCommands: {},
        },
      };
      expect(hasPermission(member, 'unknown', config)).toBe(false);
    });

    it('should allow admin for unconfigured commands', () => {
      const member = createMockMember({ isDiscordAdmin: true });
      const config = {
        permissions: {
          enabled: true,
          usePermissions: true,
          allowedCommands: {},
        },
      };
      expect(hasPermission(member, 'unknown', config)).toBe(true);
    });

    it('should return false for unknown permission level', () => {
      const member = createMockMember();
      const config = {
        permissions: {
          enabled: true,
          usePermissions: true,
          allowedCommands: { test: 'unknown_level' },
        },
      };
      expect(hasPermission(member, 'test', config)).toBe(false);
    });
  });

  describe('getPermissionError()', () => {
    it('should return error message with command name', () => {
      const message = getPermissionError('config');
      expect(message).toContain('/config');
      expect(message).toContain('permission');
      expect(message).toContain('administrator');
    });
  });
});
