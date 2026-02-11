import { PermissionFlagsBits } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { getPermissionError, hasPermission, isAdmin } from '../../src/utils/permissions.js';

describe('permissions', () => {
	describe('isAdmin', () => {
		it('should return true for Discord Administrator permission', () => {
			const member = {
				permissions: {
					has: (perm) => perm === PermissionFlagsBits.Administrator,
				},
			};
			const config = {};
			expect(isAdmin(member, config)).toBe(true);
		});

		it('should return true for configured admin role', () => {
			const member = {
				permissions: { has: () => false },
				roles: {
					cache: {
						has: (roleId) => roleId === 'admin-role-123',
					},
				},
			};
			const config = {
				permissions: {
					adminRoleId: 'admin-role-123',
				},
			};
			expect(isAdmin(member, config)).toBe(true);
		});

		it('should return false for non-admin member', () => {
			const member = {
				permissions: { has: () => false },
				roles: {
					cache: { has: () => false },
				},
			};
			const config = {
				permissions: {
					adminRoleId: 'admin-role-123',
				},
			};
			expect(isAdmin(member, config)).toBe(false);
		});

		it('should return false for null member', () => {
			const config = {};
			expect(isAdmin(null, config)).toBe(false);
		});

		it('should return false for null config', () => {
			const member = {
				permissions: { has: () => true },
			};
			expect(isAdmin(member, null)).toBe(false);
		});

		it('should prioritize Discord admin permission over role', () => {
			const member = {
				permissions: {
					has: (perm) => perm === PermissionFlagsBits.Administrator,
				},
				roles: {
					cache: { has: () => false },
				},
			};
			const config = {
				permissions: {
					adminRoleId: 'admin-role-123',
				},
			};
			expect(isAdmin(member, config)).toBe(true);
		});

		it('should handle missing adminRoleId in config', () => {
			const member = {
				permissions: { has: () => false },
				roles: {
					cache: { has: () => true },
				},
			};
			const config = {
				permissions: {},
			};
			expect(isAdmin(member, config)).toBe(false);
		});
	});

	describe('hasPermission', () => {
		it('should allow everyone when permissions are disabled', () => {
			const member = {
				permissions: { has: () => false },
			};
			const config = {
				permissions: {
					enabled: false,
				},
			};
			expect(hasPermission(member, 'test', config)).toBe(true);
		});

		it('should allow everyone when usePermissions is false', () => {
			const member = {
				permissions: { has: () => false },
			};
			const config = {
				permissions: {
					enabled: true,
					usePermissions: false,
				},
			};
			expect(hasPermission(member, 'test', config)).toBe(true);
		});

		it('should allow everyone for "everyone" permission level', () => {
			const member = {
				permissions: { has: () => false },
			};
			const config = {
				permissions: {
					enabled: true,
					usePermissions: true,
					allowedCommands: {
						test: 'everyone',
					},
				},
			};
			expect(hasPermission(member, 'test', config)).toBe(true);
		});

		it('should check admin for "admin" permission level', () => {
			const adminMember = {
				permissions: {
					has: (perm) => perm === PermissionFlagsBits.Administrator,
				},
			};
			const regularMember = {
				permissions: { has: () => false },
				roles: { cache: { has: () => false } },
			};
			const config = {
				permissions: {
					enabled: true,
					usePermissions: true,
					allowedCommands: {
						test: 'admin',
					},
				},
			};
			expect(hasPermission(adminMember, 'test', config)).toBe(true);
			expect(hasPermission(regularMember, 'test', config)).toBe(false);
		});

		it('should default to admin-only for unlisted commands', () => {
			const adminMember = {
				permissions: {
					has: (perm) => perm === PermissionFlagsBits.Administrator,
				},
			};
			const regularMember = {
				permissions: { has: () => false },
				roles: { cache: { has: () => false } },
			};
			const config = {
				permissions: {
					enabled: true,
					usePermissions: true,
					allowedCommands: {},
				},
			};
			expect(hasPermission(adminMember, 'unlisted', config)).toBe(true);
			expect(hasPermission(regularMember, 'unlisted', config)).toBe(false);
		});

		it('should deny for unknown permission levels', () => {
			const member = {
				permissions: { has: () => false },
			};
			const config = {
				permissions: {
					enabled: true,
					usePermissions: true,
					allowedCommands: {
						test: 'custom-level',
					},
				},
			};
			expect(hasPermission(member, 'test', config)).toBe(false);
		});

		it('should return false for null member', () => {
			const config = {
				permissions: {
					enabled: true,
					usePermissions: true,
				},
			};
			expect(hasPermission(null, 'test', config)).toBe(false);
		});

		it('should return false for null commandName', () => {
			const member = {
				permissions: { has: () => true },
			};
			const config = {
				permissions: {
					enabled: true,
					usePermissions: true,
				},
			};
			expect(hasPermission(member, null, config)).toBe(false);
		});

		it('should return false for null config', () => {
			const member = {
				permissions: { has: () => true },
			};
			expect(hasPermission(member, 'test', null)).toBe(false);
		});

		it('should handle missing allowedCommands in config', () => {
			const adminMember = {
				permissions: {
					has: (perm) => perm === PermissionFlagsBits.Administrator,
				},
			};
			const config = {
				permissions: {
					enabled: true,
					usePermissions: true,
				},
			};
			expect(hasPermission(adminMember, 'test', config)).toBe(true);
		});
	});

	describe('getPermissionError', () => {
		it('should return formatted error message', () => {
			const message = getPermissionError('config');
			expect(message).toContain('config');
			expect(message).toContain('permission');
			expect(message).toContain('administrator');
		});

		it('should include command name in message', () => {
			const message = getPermissionError('status');
			expect(message).toContain('status');
		});

		it('should start with error emoji', () => {
			const message = getPermissionError('test');
			expect(message).toMatch(/^❌/);
		});

		it('should format command name as code', () => {
			const message = getPermissionError('test');
			expect(message).toContain('`/test`');
		});
	});
});