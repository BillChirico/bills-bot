import { describe, expect, it, vi } from 'vitest';
import { isSpam, sendSpamAlert } from '../../src/modules/spam.js';

describe('spam module', () => {
	describe('isSpam', () => {
		it('should detect crypto spam', () => {
			expect(isSpam('Free Bitcoin here!')).toBe(true);
			expect(isSpam('Free crypto giveaway')).toBe(true);
			expect(isSpam('Get free BTC now')).toBe(true);
			expect(isSpam('Free ETH airdrop')).toBe(true);
			expect(isSpam('Claim your free NFT')).toBe(true);
		});

		it('should detect airdrop spam', () => {
			expect(isSpam('Airdrop claim now')).toBe(true);
			expect(isSpam('Amazing airdrop claim your tokens')).toBe(true);
		});

		it('should detect Discord Nitro spam', () => {
			expect(isSpam('Discord Nitro free link')).toBe(true);
			expect(isSpam('Free nitro gift claim here')).toBe(true);
			expect(isSpam('Nitro gift claim')).toBe(true);
		});

		it('should detect verification phishing', () => {
			expect(isSpam('Click to verify your account')).toBe(true);
			expect(isSpam('Click here verify account now')).toBe(true);
		});

		it('should detect profit scams', () => {
			expect(isSpam('Guaranteed profit 100%')).toBe(true);
			expect(isSpam('GUARANTEED PROFITS!!!')).toBe(true);
		});

		it('should detect investment scams', () => {
			expect(isSpam('Invest now double your money')).toBe(true);
			expect(isSpam('Invest and double money guaranteed')).toBe(true);
		});

		it('should detect DM scams', () => {
			expect(isSpam('DM me for free stuff')).toBe(true);
			expect(isSpam('dm me for free crypto')).toBe(true);
		});

		it('should detect money-making scams', () => {
			expect(isSpam('Make $5000 daily from home')).toBe(true);
			expect(isSpam('Make 10k+ weekly guaranteed')).toBe(true);
			expect(isSpam('Make $500+ monthly passive income')).toBe(true);
		});

		it('should not flag legitimate messages', () => {
			expect(isSpam('Hello everyone!')).toBe(false);
			expect(isSpam('Check out this cool project')).toBe(false);
			expect(isSpam('I love crypto but this is legitimate discussion')).toBe(false);
			expect(isSpam('Anyone want to airdrop some files?')).toBe(false);
		});

		it('should be case-insensitive', () => {
			expect(isSpam('FREE BITCOIN')).toBe(true);
			expect(isSpam('free bitcoin')).toBe(true);
			expect(isSpam('FrEe BiTcOiN')).toBe(true);
		});

		it('should handle empty strings', () => {
			expect(isSpam('')).toBe(false);
		});

		it('should handle whitespace variations', () => {
			expect(isSpam('free    crypto')).toBe(true);
			expect(isSpam('free\ncrypto')).toBe(true);
			expect(isSpam('free\tcrypto')).toBe(true);
		});
	});

	describe('sendSpamAlert', () => {
		it('should send alert to configured channel', async () => {
			const mockSend = vi.fn();
			const mockChannel = { send: mockSend };
			const mockClient = {
				channels: {
					fetch: vi.fn(async () => mockChannel),
				},
			};
			const mockMessage = {
				author: { id: '123', username: 'spammer' },
				channel: { id: '456' },
				content: 'spam content',
				url: 'https://discord.com/...',
			};
			const config = {
				moderation: {
					alertChannelId: '789',
				},
			};

			await sendSpamAlert(mockMessage, mockClient, config);

			expect(mockClient.channels.fetch).toHaveBeenCalledWith('789');
			expect(mockSend).toHaveBeenCalledTimes(1);
			expect(mockSend).toHaveBeenCalledWith(
				expect.objectContaining({
					embeds: expect.arrayContaining([expect.anything()]),
				}),
			);
		});

		it('should include message content in alert', async () => {
			const mockSend = vi.fn();
			const mockChannel = { send: mockSend };
			const mockClient = {
				channels: {
					fetch: vi.fn(async () => mockChannel),
				},
			};
			const mockMessage = {
				author: { id: '123' },
				channel: { id: '456' },
				content: 'Free Bitcoin here!',
				url: 'https://discord.com/...',
			};
			const config = {
				moderation: {
					alertChannelId: '789',
				},
			};

			await sendSpamAlert(mockMessage, mockClient, config);

			const embedArg = mockSend.mock.calls[0][0].embeds[0];
			expect(embedArg.data.fields.some((f) => f.value.includes('Free Bitcoin'))).toBe(true);
		});

		it('should truncate long messages', async () => {
			const mockSend = vi.fn();
			const mockChannel = { send: mockSend };
			const mockClient = {
				channels: {
					fetch: vi.fn(async () => mockChannel),
				},
			};
			const longContent = 'a'.repeat(2000);
			const mockMessage = {
				author: { id: '123' },
				channel: { id: '456' },
				content: longContent,
				url: 'https://discord.com/...',
			};
			const config = {
				moderation: {
					alertChannelId: '789',
				},
			};

			await sendSpamAlert(mockMessage, mockClient, config);

			const embedArg = mockSend.mock.calls[0][0].embeds[0];
			const contentField = embedArg.data.fields.find((f) => f.name === 'Content');
			expect(contentField.value.length).toBeLessThanOrEqual(1000);
		});

		it('should auto-delete if configured', async () => {
			const mockDelete = vi.fn(async () => Promise.resolve());
			const mockChannel = {
				send: vi.fn(),
			};
			const mockClient = {
				channels: {
					fetch: vi.fn(async () => mockChannel),
				},
			};
			const mockMessage = {
				author: { id: '123' },
				channel: { id: '456' },
				content: 'spam',
				url: 'https://discord.com/...',
				delete: mockDelete,
			};
			const config = {
				moderation: {
					alertChannelId: '789',
					autoDelete: true,
				},
			};

			await sendSpamAlert(mockMessage, mockClient, config);

			expect(mockDelete).toHaveBeenCalledTimes(1);
		});

		it('should not delete if autoDelete is false', async () => {
			const mockDelete = vi.fn(async () => Promise.resolve());
			const mockChannel = {
				send: vi.fn(),
			};
			const mockClient = {
				channels: {
					fetch: vi.fn(async () => mockChannel),
				},
			};
			const mockMessage = {
				author: { id: '123' },
				channel: { id: '456' },
				content: 'spam',
				url: 'https://discord.com/...',
				delete: mockDelete,
			};
			const config = {
				moderation: {
					alertChannelId: '789',
					autoDelete: false,
				},
			};

			await sendSpamAlert(mockMessage, mockClient, config);

			expect(mockDelete).not.toHaveBeenCalled();
		});

		it('should handle missing alert channel gracefully', async () => {
			const mockClient = {
				channels: {
					fetch: vi.fn(async () => null),
				},
			};
			const mockMessage = {
				author: { id: '123' },
				channel: { id: '456' },
				content: 'spam',
				url: 'https://discord.com/...',
			};
			const config = {
				moderation: {
					alertChannelId: '789',
				},
			};

			await expect(sendSpamAlert(mockMessage, mockClient, config)).resolves.not.toThrow();
		});

		it('should handle channel fetch error gracefully', async () => {
			const mockClient = {
				channels: {
					fetch: vi.fn(async () => {
						throw new Error('Channel not found');
					}),
				},
			};
			const mockMessage = {
				author: { id: '123' },
				channel: { id: '456' },
				content: 'spam',
				url: 'https://discord.com/...',
			};
			const config = {
				moderation: {
					alertChannelId: '789',
				},
			};

			await expect(sendSpamAlert(mockMessage, mockClient, config)).resolves.not.toThrow();
		});

		it('should handle missing alertChannelId', async () => {
			const mockClient = {
				channels: {
					fetch: vi.fn(),
				},
			};
			const mockMessage = {
				author: { id: '123' },
				channel: { id: '456' },
				content: 'spam',
				url: 'https://discord.com/...',
			};
			const config = {
				moderation: {},
			};

			await sendSpamAlert(mockMessage, mockClient, config);

			expect(mockClient.channels.fetch).not.toHaveBeenCalled();
		});

		it('should handle delete errors gracefully', async () => {
			const mockChannel = {
				send: vi.fn(),
			};
			const mockClient = {
				channels: {
					fetch: vi.fn(async () => mockChannel),
				},
			};
			const mockMessage = {
				author: { id: '123' },
				channel: { id: '456' },
				content: 'spam',
				url: 'https://discord.com/...',
				delete: vi.fn(async () => {
					throw new Error('Cannot delete');
				}),
			};
			const config = {
				moderation: {
					alertChannelId: '789',
					autoDelete: true,
				},
			};

			await expect(sendSpamAlert(mockMessage, mockClient, config)).resolves.not.toThrow();
		});

		it('should show empty for empty content', async () => {
			const mockSend = vi.fn();
			const mockChannel = { send: mockSend };
			const mockClient = {
				channels: {
					fetch: vi.fn(async () => mockChannel),
				},
			};
			const mockMessage = {
				author: { id: '123' },
				channel: { id: '456' },
				content: '',
				url: 'https://discord.com/...',
			};
			const config = {
				moderation: {
					alertChannelId: '789',
				},
			};

			await sendSpamAlert(mockMessage, mockClient, config);

			const embedArg = mockSend.mock.calls[0][0].embeds[0];
			const contentField = embedArg.data.fields.find((f) => f.name === 'Content');
			expect(contentField.value).toBe('*empty*');
		});
	});
});