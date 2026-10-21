import { describe, expect, it, vi } from 'vitest';
import { isSupportedChatUrl, sendWithBootstrap } from '../src/core/connection';

describe('connecting to an already open chat', () => {
  it('accepts only the six configured HTTPS chat hosts', () => {
    expect(isSupportedChatUrl('https://gemini.google.com/app')).toBe(true);
    expect(isSupportedChatUrl('https://chatgpt.com/c/abc')).toBe(true);
    expect(isSupportedChatUrl('https://chatgpt.com.evil.example/c/abc')).toBe(false);
    expect(isSupportedChatUrl('http://chatgpt.com/c/abc')).toBe(false);
  });
  it('injects the content script on a missing receiver, then retries without reloading', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('Could not establish connection. Receiving end does not exist.')).mockRejectedValueOnce(new Error('Could not establish connection. Receiving end does not exist.')).mockResolvedValue({ ready: true });
    const inject = vi.fn().mockResolvedValue(undefined);
    expect(await sendWithBootstrap({ id: 7, url: 'https://chatgpt.com/c/abc' }, { type: 'PING' }, send, inject, async () => {})).toEqual({ ready: true });
    expect(inject).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledTimes(3);
  });
  it('never injects on unrelated errors or unsupported pages', async () => {
    const send = vi.fn().mockRejectedValue(new Error('Tab closed'));
    const inject = vi.fn();
    await expect(sendWithBootstrap({ id: 7, url: 'https://claude.ai/new' }, {}, send, inject, async () => {})).rejects.toThrow('Tab closed');
    await expect(sendWithBootstrap({ id: 7, url: 'https://example.com' }, {}, send, inject, async () => {})).rejects.toThrow('supported AI chat');
    expect(inject).not.toHaveBeenCalled();
  });
});
