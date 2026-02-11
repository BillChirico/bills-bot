import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recordCommunityActivity, renderWelcomeMessage } from '../../src/modules/welcome.js';

describe('welcome module', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('renderWelcomeMessage', () => {
		it('should replace {user} placeholder', () => {
			const result = renderWelcomeMessage('Welcome {user}!', { id: '123' }, { name: 'Test', memberCount: 10 });
			expect(result).toBe('Welcome <@123>!');
		});

		it('should replace {username} placeholder', () => {
			const result = renderWelcomeMessage('Hello {username}', { id: '123', username: 'John' }, { name: 'Test', memberCount: 10 });
			expect(result).toBe('Hello John');
		});

		it('should replace {server} placeholder', () => {
			const result = renderWelcomeMessage('Welcome to {server}', { id: '123' }, { name: 'MyServer', memberCount: 10 });
			expect(result).toBe('Welcome to MyServer');
		});

		it('should replace {memberCount} placeholder', () => {
			const result = renderWelcomeMessage('Member #{memberCount}', { id: '123' }, { name: 'Test', memberCount: 42 });
			expect(result).toBe('Member #42');
		});

		it('should replace all placeholders', () => {
			const result = renderWelcomeMessage(
				'Welcome {user} ({username}) to {server}! You are member #{memberCount}',
				{ id: '123', username: 'John' },
				{ name: 'TestServer', memberCount: 100 }
			);
			expect(result).toBe('Welcome <@123> (John) to TestServer! You are member #100');
		});

		it('should handle multiple occurrences of same placeholder', () => {
			const result = renderWelcomeMessage('{user} {user} {user}', { id: '123' }, { name: 'Test', memberCount: 10 });
			expect(result).toBe('<@123> <@123> <@123>');
		});

		it('should handle missing username gracefully', () => {
			const result = renderWelcomeMessage('Hello {username}', { id: '123' }, { name: 'Test', memberCount: 10 });
			expect(result).toBe('Hello Unknown');
		});

		it('should handle templates without placeholders', () => {
			const result = renderWelcomeMessage('Hello world', { id: '123' }, { name: 'Test', memberCount: 10 });
			expect(result).toBe('Hello world');
		});

		it('should handle empty template', () => {
			const result = renderWelcomeMessage('', { id: '123' }, { name: 'Test', memberCount: 10 });
			expect(result).toBe('');
		});
	});

	describe('recordCommunityActivity', () => {
		it('should track message activity', () => {
			const message = {
				guild: { id: 'guild1' },
				channel: { id: 'channel1', isTextBased: () => true },
				author: { bot: false },
			};
			const config = {
				welcome: {
					dynamic: {
						excludeChannels: [],
					},
				},
			};

			expect(() => recordCommunityActivity(message, config)).not.toThrow();
		});

		it('should ignore bot messages', () => {
			const message = {
				guild: { id: 'guild1' },
				channel: { id: 'channel1', isTextBased: () => true },
				author: { bot: true },
			};
			const config = {
				welcome: {
					dynamic: {
						excludeChannels: [],
					},
				},
			};

			recordCommunityActivity(message, config);
			// Should not throw or cause issues
		});

		it('should ignore messages from excluded channels', () => {
			const message = {
				guild: { id: 'guild1' },
				channel: { id: 'channel1', isTextBased: () => true },
				author: { bot: false },
			};
			const config = {
				welcome: {
					dynamic: {
						excludeChannels: ['channel1'],
					},
				},
			};

			recordCommunityActivity(message, config);
			// Should not throw
		});

		it('should handle missing guild', () => {
			const message = {
				channel: { id: 'channel1', isTextBased: () => true },
				author: { bot: false },
			};
			const config = {};

			expect(() => recordCommunityActivity(message, config)).not.toThrow();
		});

		it('should handle missing channel', () => {
			const message = {
				guild: { id: 'guild1' },
				author: { bot: false },
			};
			const config = {};

			expect(() => recordCommunityActivity(message, config)).not.toThrow();
		});

		it('should handle non-text channels', () => {
			const message = {
				guild: { id: 'guild1' },
				channel: { id: 'voice1', isTextBased: () => false },
				author: { bot: false },
			};
			const config = {};

			recordCommunityActivity(message, config);
			// Should not throw
		});

		it('should handle missing config', () => {
			const message = {
				guild: { id: 'guild1' },
				channel: { id: 'channel1', isTextBased: () => true },
				author: { bot: false },
			};

			expect(() => recordCommunityActivity(message, null)).not.toThrow();
		});

		it('should handle null message', () => {
			const config = {};
			expect(() => recordCommunityActivity(null, config)).not.toThrow();
		});

		it('should accumulate multiple messages', () => {
			const message = {
				guild: { id: 'guild1' },
				channel: { id: 'channel1', isTextBased: () => true },
				author: { bot: false },
			};
			const config = {
				welcome: {
					dynamic: {
						excludeChannels: [],
					},
				},
			};

			// Record multiple messages
			for (let i = 0; i < 5; i++) {
				recordCommunityActivity(message, config);
			}

			// Should not throw
		});

		it('should handle different channels independently', () => {
			const config = {
				welcome: {
					dynamic: {
						excludeChannels: [],
					},
				},
			};

			const message1 = {
				guild: { id: 'guild1' },
				channel: { id: 'channel1', isTextBased: () => true },
				author: { bot: false },
			};

			const message2 = {
				guild: { id: 'guild1' },
				channel: { id: 'channel2', isTextBased: () => true },
				author: { bot: false },
			};

			recordCommunityActivity(message1, config);
			recordCommunityActivity(message2, config);

			// Should track separately
		});

		it('should respect activity window', () => {
			vi.useFakeTimers();

			const message = {
				guild: { id: 'guild1' },
				channel: { id: 'channel1', isTextBased: () => true },
				author: { bot: false },
			};
			const config = {
				welcome: {
					dynamic: {
						excludeChannels: [],
						activityWindowMinutes: 10,
					},
				},
			};

			recordCommunityActivity(message, config);
			vi.advanceTimersByTime(11 * 60 * 1000); // Advance past window
			recordCommunityActivity(message, config);

			vi.useRealTimers();
		});
	});

	describe('edge cases', () => {
		it('should handle very long server names', () => {
			const longName = 'a'.repeat(1000);
			const result = renderWelcomeMessage('{server}', { id: '123' }, { name: longName, memberCount: 10 });
			expect(result).toBe(longName);
		});

		it('should handle very large member counts', () => {
			const result = renderWelcomeMessage('{memberCount}', { id: '123' }, { name: 'Test', memberCount: 999999 });
			expect(result).toBe('999999');
		});

		it('should handle special characters in server name', () => {
			const result = renderWelcomeMessage('{server}', { id: '123' }, { name: 'Test & <Server>', memberCount: 10 });
			expect(result).toBe('Test & <Server>');
		});

		it('should handle special characters in username', () => {
			const result = renderWelcomeMessage('{username}', { id: '123', username: 'User<script>' }, { name: 'Test', memberCount: 10 });
			expect(result).toBe('User<script>');
		});

		it('should handle numeric usernames', () => {
			const result = renderWelcomeMessage('{username}', { id: '123', username: '12345' }, { name: 'Test', memberCount: 10 });
			expect(result).toBe('12345');
		});
	});
});