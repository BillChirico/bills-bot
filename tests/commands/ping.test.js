import { describe, expect, it, vi } from 'vitest';
import { data, execute } from '../../src/commands/ping.js';

describe('ping command', () => {
	describe('command data', () => {
		it('should have correct name', () => {
			expect(data.name).toBe('ping');
		});

		it('should have description', () => {
			expect(data.description).toBeTruthy();
			expect(typeof data.description).toBe('string');
		});

		it('should have toJSON method', () => {
			expect(typeof data.toJSON).toBe('function');
		});
	});

	describe('execute', () => {
		it('should reply with pong message', async () => {
			const mockEditReply = vi.fn();
			const mockReply = vi.fn(async () => ({
				resource: {
					message: {
						createdTimestamp: 1000,
					},
				},
			}));

			const interaction = {
				reply: mockReply,
				editReply: mockEditReply,
				createdTimestamp: 900,
				client: {
					ws: {
						ping: 50,
					},
				},
			};

			await execute(interaction);

			expect(mockReply).toHaveBeenCalledWith({
				content: 'Pinging...',
				withResponse: true,
			});
			expect(mockEditReply).toHaveBeenCalledTimes(1);
		});

		it('should calculate latency correctly', async () => {
			const mockEditReply = vi.fn();
			const mockReply = vi.fn(async () => ({
				resource: {
					message: {
						createdTimestamp: 1000,
					},
				},
			}));

			const interaction = {
				reply: mockReply,
				editReply: mockEditReply,
				createdTimestamp: 900,
				client: {
					ws: {
						ping: 50,
					},
				},
			};

			await execute(interaction);

			expect(mockEditReply).toHaveBeenCalledWith(
				expect.stringContaining('100ms')
			);
		});

		it('should include API latency', async () => {
			const mockEditReply = vi.fn();
			const mockReply = vi.fn(async () => ({
				resource: {
					message: {
						createdTimestamp: 2000,
					},
				},
			}));

			const interaction = {
				reply: mockReply,
				editReply: mockEditReply,
				createdTimestamp: 1000,
				client: {
					ws: {
						ping: 75,
					},
				},
			};

			await execute(interaction);

			expect(mockEditReply).toHaveBeenCalledWith(
				expect.stringContaining('75ms')
			);
		});

		it('should round API latency', async () => {
			const mockEditReply = vi.fn();
			const mockReply = vi.fn(async () => ({
				resource: {
					message: {
						createdTimestamp: 1000,
					},
				},
			}));

			const interaction = {
				reply: mockReply,
				editReply: mockEditReply,
				createdTimestamp: 900,
				client: {
					ws: {
						ping: 75.7,
					},
				},
			};

			await execute(interaction);

			expect(mockEditReply).toHaveBeenCalledWith(
				expect.stringContaining('76ms')
			);
		});

		it('should include pong emoji', async () => {
			const mockEditReply = vi.fn();
			const mockReply = vi.fn(async () => ({
				resource: {
					message: {
						createdTimestamp: 1000,
					},
				},
			}));

			const interaction = {
				reply: mockReply,
				editReply: mockEditReply,
				createdTimestamp: 900,
				client: {
					ws: {
						ping: 50,
					},
				},
			};

			await execute(interaction);

			expect(mockEditReply).toHaveBeenCalledWith(
				expect.stringContaining('🏓')
			);
		});

		it('should handle negative latency gracefully', async () => {
			const mockEditReply = vi.fn();
			const mockReply = vi.fn(async () => ({
				resource: {
					message: {
						createdTimestamp: 900,
					},
				},
			}));

			const interaction = {
				reply: mockReply,
				editReply: mockEditReply,
				createdTimestamp: 1000,
				client: {
					ws: {
						ping: 50,
					},
				},
			};

			await execute(interaction);

			// Should still complete without error
			expect(mockEditReply).toHaveBeenCalled();
		});

		it('should handle very high latency', async () => {
			const mockEditReply = vi.fn();
			const mockReply = vi.fn(async () => ({
				resource: {
					message: {
						createdTimestamp: 5000,
					},
				},
			}));

			const interaction = {
				reply: mockReply,
				editReply: mockEditReply,
				createdTimestamp: 1000,
				client: {
					ws: {
						ping: 1000,
					},
				},
			};

			await execute(interaction);

			expect(mockEditReply).toHaveBeenCalledWith(
				expect.stringContaining('4000ms')
			);
		});
	});
});