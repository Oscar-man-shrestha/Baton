import { describe, expect, it, vi } from 'vitest';
import { createActiveChatTracker } from '../src/core/active-chat';

describe('sidebar follows the active conversation', () => {
  it('connects newly selected providers and clears the previous quota immediately', async () => {
    let tab = { id: 1, url: 'https://claude.ai/new' };
    const update = vi.fn();
    const connect = vi.fn(async (current: typeof tab) => ({ ready: true, provider: current.id === 1 ? 'claude' as const : 'gemini' as const }));
    const refresh = createActiveChatTracker(async () => tab, connect, update);
    await refresh();
    tab = { id: 2, url: 'https://gemini.google.com/app' };
    await refresh();
    expect(update.mock.calls.map(call => call[1])).toEqual([undefined, 'claude', undefined, 'gemini']);
  });
  it('does not restore a stale provider when an older connection finishes last', async () => {
    let finish!: (value: { ready: boolean; provider: 'claude' }) => void;
    let tab = { id: 1, url: 'https://claude.ai/new' };
    const update = vi.fn();
    const refresh = createActiveChatTracker(async () => tab, current => current.id === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ ready: true, provider: 'gemini' }), update);
    const first = refresh();
    await vi.waitFor(() => expect(finish).toBeDefined());
    tab = { id: 2, url: 'https://gemini.google.com/app' };
    await refresh();
    finish({ ready: true, provider: 'claude' }); await first;
    expect(update.mock.calls.at(-1)?.[1]).toBe('gemini');
  });
  it('clears the provider on unsupported pages without connecting to them', async () => {
    const update = vi.fn(); const connect = vi.fn();
    const refresh = createActiveChatTracker(async () => ({ id: 3, url: 'https://example.com' }), connect, update);
    await refresh(); expect(connect).not.toHaveBeenCalled(); expect(update).toHaveBeenCalledWith(expect.anything(), undefined);
  });
  it('leaves capture recovery available when an AI tab cannot connect', async () => {
    const update = vi.fn(); const failed = vi.fn();
    await createActiveChatTracker(async () => ({ id: 1, url: 'https://claude.ai/new' }), async () => { throw new Error('Page unavailable'); }, update, failed)();
    expect(update).toHaveBeenCalledTimes(1); expect(update.mock.calls[0][1]).toBeUndefined();
    expect(failed).toHaveBeenCalledWith({ id: 1, url: 'https://claude.ai/new' });
  });
});
