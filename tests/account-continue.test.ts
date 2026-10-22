import { describe, expect, it } from 'vitest';
import { PENDING_MS, pendingFor, shouldOffer, signInLabel, switchHelp } from '../src/core/account-continue';

const now = Date.UTC(2026, 9, 22, 12);
const pending = { provider: 'chatgpt', draft: 'Goal: finish login', at: now - 60000, from: 'https://chatgpt.com/c/abc' } as const;

describe('same AI, another account', () => {
  it('keeps a waiting project for six hours, for that AI only', () => {
    expect(pendingFor(pending, 'chatgpt', now)).toEqual(pending);
    expect(pendingFor(pending, 'claude', now)).toBeUndefined();
    expect(pendingFor({ ...pending, at: now - PENDING_MS - 1 }, 'chatgpt', now)).toBeUndefined();
    expect(pendingFor({ ...pending, draft: '  ' }, 'chatgpt', now)).toBeUndefined();
    expect(pendingFor(undefined, 'chatgpt', now)).toBeUndefined();
  });
  it('offers it only on a fresh chat, not the one it came from', () => {
    expect(shouldOffer(pending as any, { url: 'https://chatgpt.com/', turnCount: 0, hasEditor: true })).toBe(true);
    expect(shouldOffer(pending as any, { url: 'https://chatgpt.com/c/abc', turnCount: 0, hasEditor: true })).toBe(false);
    expect(shouldOffer(pending as any, { url: 'https://chatgpt.com/c/new', turnCount: 3, hasEditor: true })).toBe(false);
    expect(shouldOffer(pending as any, { url: 'https://chatgpt.com/', turnCount: 0, hasEditor: false })).toBe(false);
    expect(shouldOffer(undefined, { url: 'https://chatgpt.com/', turnCount: 0, hasEditor: true })).toBe(false);
  });
  it('points to each service’s own account screens; Gemini uses Google’s chooser', () => {
    expect(switchHelp('gemini').chooser).toMatch(/^https:\/\/accounts\.google\.com\/AccountChooser/);
    expect(switchHelp('chatgpt').chooser).toBeUndefined();
    expect(switchHelp('perplexity').steps[0]).toContain('Sign out');
  });
  it('logs out only where the service has a log-out page', () => {
    expect(switchHelp('claude').logout).toBe('https://claude.ai/logout');
    expect(switchHelp('chatgpt').logout).toBe('https://chatgpt.com/auth/logout');
    expect(switchHelp('grok').logout).toBe('https://grok.com/sign-out');
    expect(switchHelp('perplexity').logout).toBeUndefined();
    expect(switchHelp('deepseek').logout).toBeUndefined();
    expect(switchHelp('gemini').logout).toBeUndefined();
  });
  it('finds the button that leads to Google’s chooser', () => {
    expect(signInLabel('Continue with Google')).toBe('google');
    expect(signInLabel(' Sign in with Google ')).toBe('google');
    expect(signInLabel('Log in')).toBe('login');
    expect(signInLabel('Continue with Apple')).toBeUndefined();
    expect(signInLabel('New chat')).toBeUndefined();
  });
});
