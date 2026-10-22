import { describe, expect, it, vi } from 'vitest';
import { browserName, cleanFeedback, feedbackText, sendFeedback } from '../src/core/feedback';

describe('feedback', () => {
  it('trims, caps and drops empty fields', () => {
    expect(cleanFeedback({ kind: 'bug', message: '  broken on claude  ', reason: '', site: 'claude' })).toEqual({ kind: 'bug', message: 'broken on claude', site: 'claude' });
    expect(cleanFeedback({ kind: 'idea', message: 'x'.repeat(2000) }).message!.length).toBe(1500);
    expect(() => cleanFeedback({ kind: 'spam' as any })).toThrow();
  });
  it('posts one insert-only row with the public key', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 201 }));
    expect(await sendFeedback({ kind: 'uninstall', reason: 'in-the-way', version: '1.0.0' }, fetcher as any)).toBe(true);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/rest\/v1\/baton_feedback$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ kind: 'uninstall', reason: 'in-the-way', version: '1.0.0' });
    expect((init.headers as Record<string, string>).Prefer).toBe('return=minimal');
  });
  it('reports failure instead of throwing, so the page can offer copy or email', async () => {
    expect(await sendFeedback({ kind: 'bug' }, (async () => new Response('', { status: 404 })) as any)).toBe(false);
    expect(await sendFeedback({ kind: 'bug' }, (async () => { throw new Error('offline'); }) as any)).toBe(false);
  });
  it('names the browser and formats a plain-text copy', () => {
    expect(browserName('Mozilla/5.0 Chrome/130 Safari/537.36 Edg/130')).toBe('Edge');
    expect(browserName('Mozilla/5.0 Chrome/130', true)).toBe('Brave');
    expect(feedbackText({ kind: 'bug', site: 'claude', message: 'Bar missing' })).toBe('Baton feedback (bug)\nSite: claude\nBar missing');
  });
});
