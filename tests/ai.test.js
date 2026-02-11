/**
 * Tests for src/modules/ai.js
 * AI chat functionality powered by Claude via OpenClaw
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  getConversationHistory,
  setConversationHistory,
  getHistory,
  addToHistory,
  generateResponse,
  OPENCLAW_URL,
  OPENCLAW_TOKEN,
} from '../src/modules/ai.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('AI module', () => {
  beforeEach(() => {
    // Reset conversation history before each test
    setConversationHistory(new Map());
    vi.clearAllMocks();
  });

  describe('conversation history management', () => {
    it('should return empty Map initially', () => {
      const history = getConversationHistory();
      expect(history).toBeInstanceOf(Map);
      expect(history.size).toBe(0);
    });

    it('should allow setting conversation history', () => {
      const newHistory = new Map();
      newHistory.set('channel1', [{ role: 'user', content: 'hello' }]);
      setConversationHistory(newHistory);

      const history = getConversationHistory();
      expect(history.size).toBe(1);
      expect(history.get('channel1')).toEqual([{ role: 'user', content: 'hello' }]);
    });

    it('should get empty history for new channel', () => {
      const channelHistory = getHistory('channel1');
      expect(Array.isArray(channelHistory)).toBe(true);
      expect(channelHistory.length).toBe(0);
    });

    it('should create history for new channel on first access', () => {
      const history1 = getHistory('channel1');
      const history2 = getHistory('channel1');
      expect(history1).toBe(history2); // Same reference
    });
  });

  describe('addToHistory', () => {
    it('should add message to channel history', () => {
      addToHistory('channel1', 'user', 'Hello there');
      const history = getHistory('channel1');
      expect(history).toEqual([{ role: 'user', content: 'Hello there' }]);
    });

    it('should add multiple messages', () => {
      addToHistory('channel1', 'user', 'Hello');
      addToHistory('channel1', 'assistant', 'Hi!');
      const history = getHistory('channel1');
      expect(history).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ]);
    });

    it('should trim history when exceeding MAX_HISTORY (20 messages)', () => {
      // Add 25 messages
      for (let i = 0; i < 25; i++) {
        addToHistory('channel1', 'user', `Message ${i}`);
      }
      const history = getHistory('channel1');
      expect(history.length).toBe(20);
      expect(history[0].content).toBe('Message 5'); // First 5 removed
      expect(history[19].content).toBe('Message 24');
    });

    it('should maintain separate history per channel', () => {
      addToHistory('channel1', 'user', 'Channel 1 message');
      addToHistory('channel2', 'user', 'Channel 2 message');

      const history1 = getHistory('channel1');
      const history2 = getHistory('channel2');

      expect(history1.length).toBe(1);
      expect(history2.length).toBe(1);
      expect(history1[0].content).toBe('Channel 1 message');
      expect(history2[0].content).toBe('Channel 2 message');
    });
  });

  describe('OpenClaw configuration', () => {
    it('should export OPENCLAW_URL', () => {
      expect(OPENCLAW_URL).toBeDefined();
      expect(typeof OPENCLAW_URL).toBe('string');
    });

    it('should export OPENCLAW_TOKEN', () => {
      expect(OPENCLAW_TOKEN).toBeDefined();
      expect(typeof OPENCLAW_TOKEN).toBe('string');
    });

    it('should have default URL if not in env', () => {
      expect(OPENCLAW_URL).toContain('localhost:18789');
    });
  });

  describe('generateResponse', () => {
    const mockConfig = {
      ai: {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024,
        systemPrompt: 'You are a helpful bot.',
      },
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should generate response from API', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Hello! How can I help you?',
              },
            },
          ],
        }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const response = await generateResponse(
        'channel1',
        'Hi there',
        'testuser',
        mockConfig
      );

      expect(response).toBe('Hello! How can I help you?');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should include username in user message', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      await generateResponse('channel1', 'Hello', 'john', mockConfig);

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      const lastMessage = requestBody.messages[requestBody.messages.length - 1];

      expect(lastMessage.content).toContain('john:');
      expect(lastMessage.content).toContain('Hello');
    });

    it('should include conversation history in request', async () => {
      addToHistory('channel1', 'user', 'john: Previous message');
      addToHistory('channel1', 'assistant', 'Previous response');

      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'New response' } }],
        }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      await generateResponse('channel1', 'New message', 'john', mockConfig);

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.messages.length).toBeGreaterThan(2); // system + history + new message
    });

    it('should update history after successful response', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'AI response' } }],
        }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      await generateResponse('channel1', 'User message', 'john', mockConfig);

      const history = getHistory('channel1');
      expect(history.length).toBe(2);
      expect(history[0]).toEqual({ role: 'user', content: 'john: User message' });
      expect(history[1]).toEqual({ role: 'assistant', content: 'AI response' });
    });

    it('should send Authorization header when token is provided', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      await generateResponse('channel1', 'Hello', 'user', mockConfig);

      const callArgs = global.fetch.mock.calls[0];
      const headers = callArgs[1].headers;

      if (OPENCLAW_TOKEN) {
        expect(headers.Authorization).toBeDefined();
      }
    });

    it('should use configured model and maxTokens', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      await generateResponse('channel1', 'Hello', 'user', mockConfig);

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.model).toBe('claude-sonnet-4-20250514');
      expect(requestBody.max_tokens).toBe(1024);
    });

    it('should use default values when config is incomplete', async () => {
      const minimalConfig = { ai: {} };
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      await generateResponse('channel1', 'Hello', 'user', minimalConfig);

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.model).toBeDefined();
      expect(requestBody.max_tokens).toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const response = await generateResponse('channel1', 'Hello', 'user', mockConfig);

      expect(response).toContain("I'm having trouble");
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const response = await generateResponse('channel1', 'Hello', 'user', mockConfig);

      expect(response).toContain("I'm having trouble");
    });

    it('should handle missing response content', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [],
        }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const response = await generateResponse('channel1', 'Hello', 'user', mockConfig);

      expect(response).toBe('I got nothing. Try again?');
    });

    it('should call health monitor when provided', async () => {
      const mockHealthMonitor = {
        recordAIRequest: vi.fn(),
        setAPIStatus: vi.fn(),
      };

      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      await generateResponse('channel1', 'Hello', 'user', mockConfig, mockHealthMonitor);

      expect(mockHealthMonitor.recordAIRequest).toHaveBeenCalled();
      expect(mockHealthMonitor.setAPIStatus).toHaveBeenCalledWith('ok');
    });

    it('should set health monitor error status on failure', async () => {
      const mockHealthMonitor = {
        recordAIRequest: vi.fn(),
        setAPIStatus: vi.fn(),
      };

      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Error',
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      await generateResponse('channel1', 'Hello', 'user', mockConfig, mockHealthMonitor);

      expect(mockHealthMonitor.setAPIStatus).toHaveBeenCalledWith('error');
    });

    it('should include system prompt in messages', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      await generateResponse('channel1', 'Hello', 'user', mockConfig);

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      const systemMessage = requestBody.messages[0];

      expect(systemMessage.role).toBe('system');
      expect(systemMessage.content).toContain('helpful bot');
    });

    it('should use default system prompt when not configured', async () => {
      const configWithoutPrompt = { ai: {} };
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      await generateResponse('channel1', 'Hello', 'user', configWithoutPrompt);

      const callArgs = global.fetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      const systemMessage = requestBody.messages[0];

      expect(systemMessage.content).toContain('Volvox Bot');
    });
  });
});