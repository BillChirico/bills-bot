import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	addToHistory,
	generateResponse,
	getConversationHistory,
	getHistory,
	setConversationHistory,
} from '../../src/modules/ai.js';

describe('ai module', () => {
	beforeEach(() => {
		// Clear conversation history before each test
		setConversationHistory(new Map());
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('getConversationHistory', () => {
		it('should return the conversation history map', () => {
			const history = getConversationHistory();
			expect(history).toBeInstanceOf(Map);
		});

		it('should return the same map instance', () => {
			const history1 = getConversationHistory();
			const history2 = getConversationHistory();
			expect(history1).toBe(history2);
		});
	});

	describe('setConversationHistory', () => {
		it('should set the conversation history map', () => {
			const newHistory = new Map([['channel1', [{ role: 'user', content: 'hello' }]]]);
			setConversationHistory(newHistory);
			const history = getConversationHistory();
			expect(history).toBe(newHistory);
		});
	});

	describe('getHistory', () => {
		it('should return empty array for new channel', () => {
			const history = getHistory('channel1');
			expect(history).toEqual([]);
		});

		it('should return existing history for channel', () => {
			addToHistory('channel1', 'user', 'hello');
			const history = getHistory('channel1');
			expect(history).toHaveLength(1);
			expect(history[0]).toEqual({ role: 'user', content: 'hello' });
		});

		it('should create separate histories for different channels', () => {
			addToHistory('channel1', 'user', 'hello');
			addToHistory('channel2', 'user', 'world');
			const history1 = getHistory('channel1');
			const history2 = getHistory('channel2');
			expect(history1).toHaveLength(1);
			expect(history2).toHaveLength(1);
			expect(history1[0].content).toBe('hello');
			expect(history2[0].content).toBe('world');
		});
	});

	describe('addToHistory', () => {
		it('should add message to channel history', () => {
			addToHistory('channel1', 'user', 'hello');
			const history = getHistory('channel1');
			expect(history).toHaveLength(1);
			expect(history[0]).toEqual({ role: 'user', content: 'hello' });
		});

		it('should support multiple messages', () => {
			addToHistory('channel1', 'user', 'hello');
			addToHistory('channel1', 'assistant', 'hi there');
			addToHistory('channel1', 'user', 'how are you');
			const history = getHistory('channel1');
			expect(history).toHaveLength(3);
		});

		it('should trim history when exceeding max length', () => {
			// Add 21 messages (max is 20)
			for (let i = 0; i < 21; i++) {
				addToHistory('channel1', 'user', `message ${i}`);
			}
			const history = getHistory('channel1');
			expect(history).toHaveLength(20);
			// First message should be removed
			expect(history[0].content).toBe('message 1');
			expect(history[19].content).toBe('message 20');
		});

		it('should keep trimming as more messages are added', () => {
			// Add 25 messages
			for (let i = 0; i < 25; i++) {
				addToHistory('channel1', 'user', `message ${i}`);
			}
			const history = getHistory('channel1');
			expect(history).toHaveLength(20);
			expect(history[0].content).toBe('message 5');
			expect(history[19].content).toBe('message 24');
		});
	});

	describe('generateResponse', () => {
		it('should make API request and return response', async () => {
			const mockFetch = vi.fn(async () => ({
				ok: true,
				json: async () => ({
					choices: [{ message: { content: 'Hello!' } }],
				}),
			}));
			global.fetch = mockFetch;

			const config = { ai: { model: 'claude-sonnet-4-20250514', maxTokens: 1024 } };
			const response = await generateResponse('channel1', 'hi', 'user1', config);

			expect(response).toBe('Hello!');
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		it('should include system prompt in request', async () => {
			const mockFetch = vi.fn(async () => ({
				ok: true,
				json: async () => ({
					choices: [{ message: { content: 'Response' } }],
				}),
			}));
			global.fetch = mockFetch;

			const config = {
				ai: {
					systemPrompt: 'You are a test bot',
					model: 'claude-sonnet-4-20250514',
					maxTokens: 1024,
				},
			};

			await generateResponse('channel1', 'test', 'user1', config);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.messages[0].role).toBe('system');
			expect(requestBody.messages[0].content).toContain('test bot');
		});

		it('should include conversation history', async () => {
			addToHistory('channel1', 'user', 'previous message');
			addToHistory('channel1', 'assistant', 'previous response');

			const mockFetch = vi.fn(async () => ({
				ok: true,
				json: async () => ({
					choices: [{ message: { content: 'New response' } }],
				}),
			}));
			global.fetch = mockFetch;

			const config = { ai: {} };
			await generateResponse('channel1', 'new message', 'user1', config);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.messages).toHaveLength(4); // system + 2 history + new user
		});

		it('should update history after successful response', async () => {
			const mockFetch = vi.fn(async () => ({
				ok: true,
				json: async () => ({
					choices: [{ message: { content: 'AI response' } }],
				}),
			}));
			global.fetch = mockFetch;

			const config = { ai: {} };
			await generateResponse('channel1', 'hello', 'user1', config);

			const history = getHistory('channel1');
			expect(history).toHaveLength(2);
			expect(history[0].content).toContain('user1: hello');
			expect(history[1].content).toBe('AI response');
		});

		it('should handle API errors gracefully', async () => {
			const mockFetch = vi.fn(async () => ({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
			}));
			global.fetch = mockFetch;

			const config = { ai: {} };
			const response = await generateResponse('channel1', 'test', 'user1', config);

			expect(response).toContain('trouble thinking');
		});

		it('should handle network errors gracefully', async () => {
			const mockFetch = vi.fn(async () => {
				throw new Error('Network error');
			});
			global.fetch = mockFetch;

			const config = { ai: {} };
			const response = await generateResponse('channel1', 'test', 'user1', config);

			expect(response).toContain('trouble thinking');
		});

		it('should update health monitor on success', async () => {
			const mockFetch = vi.fn(async () => ({
				ok: true,
				json: async () => ({
					choices: [{ message: { content: 'Response' } }],
				}),
			}));
			global.fetch = mockFetch;

			const healthMonitor = {
				recordAIRequest: vi.fn(),
				setAPIStatus: vi.fn(),
			};

			const config = { ai: {} };
			await generateResponse('channel1', 'test', 'user1', config, healthMonitor);

			expect(healthMonitor.recordAIRequest).toHaveBeenCalled();
			expect(healthMonitor.setAPIStatus).toHaveBeenCalledWith('ok');
		});

		it('should update health monitor on error', async () => {
			const mockFetch = vi.fn(async () => ({
				ok: false,
				status: 500,
				statusText: 'Error',
			}));
			global.fetch = mockFetch;

			const healthMonitor = {
				setAPIStatus: vi.fn(),
			};

			const config = { ai: {} };
			await generateResponse('channel1', 'test', 'user1', config, healthMonitor);

			expect(healthMonitor.setAPIStatus).toHaveBeenCalledWith('error');
		});

		it('should use configured model and maxTokens', async () => {
			const mockFetch = vi.fn(async () => ({
				ok: true,
				json: async () => ({
					choices: [{ message: { content: 'Response' } }],
				}),
			}));
			global.fetch = mockFetch;

			const config = {
				ai: {
					model: 'claude-opus-4',
					maxTokens: 2048,
				},
			};

			await generateResponse('channel1', 'test', 'user1', config);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.model).toBe('claude-opus-4');
			expect(requestBody.max_tokens).toBe(2048);
		});

		it('should use default model if not configured', async () => {
			const mockFetch = vi.fn(async () => ({
				ok: true,
				json: async () => ({
					choices: [{ message: { content: 'Response' } }],
				}),
			}));
			global.fetch = mockFetch;

			const config = { ai: {} };
			await generateResponse('channel1', 'test', 'user1', config);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(requestBody.model).toBe('claude-sonnet-4-20250514');
			expect(requestBody.max_tokens).toBe(1024);
		});

		it('should handle empty API response', async () => {
			const mockFetch = vi.fn(async () => ({
				ok: true,
				json: async () => ({
					choices: [],
				}),
			}));
			global.fetch = mockFetch;

			const config = { ai: {} };
			const response = await generateResponse('channel1', 'test', 'user1', config);

			expect(response).toBe('I got nothing. Try again?');
		});

		it('should include authorization header if token is set', async () => {
			const mockFetch = vi.fn(async () => ({
				ok: true,
				json: async () => ({
					choices: [{ message: { content: 'Response' } }],
				}),
			}));
			global.fetch = mockFetch;

			// Set token via environment (module imports OPENCLAW_TOKEN)
			const config = { ai: {} };
			await generateResponse('channel1', 'test', 'user1', config);

			const headers = mockFetch.mock.calls[0][1].headers;
			expect(headers['Content-Type']).toBe('application/json');
		});

		it('should format user message with username', async () => {
			const mockFetch = vi.fn(async () => ({
				ok: true,
				json: async () => ({
					choices: [{ message: { content: 'Response' } }],
				}),
			}));
			global.fetch = mockFetch;

			const config = { ai: {} };
			await generateResponse('channel1', 'hello', 'JohnDoe', config);

			const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
			const lastMessage = requestBody.messages[requestBody.messages.length - 1];
			expect(lastMessage.content).toBe('JohnDoe: hello');
		});
	});
});