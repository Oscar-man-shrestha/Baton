import { describe, it, expect, vi, afterEach } from 'vitest';
import { estimateMeter, parseReset } from '../src/core/limits';
import { activeWindows, isCurrentReading, mergeUsageWindows, type UsageWindow } from '../src/core/usage-windows';
import { currentBadge, updateBadge, usageQueue } from '../src/core/usage-delivery';
import type { Meter } from '../src/core/limits';

const now = Date.UTC(2026, 9, 21, 10);
const window = (changes: Partial<UsageWindow> = {}): UsageWindow => ({ provider: 'claude', tier: 'banner', confidence: 'high', key: 'claude:Session', feature: 'Session', percent: 31, remainingPercent: 69, resetAt: now + 120000, at: now, explanation: 'Service reading', source: 'provider-page', evidenceKey: 'same-dom', ...changes });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('quota reading accuracy', () => {
  it('keeps decimal readings and rejects negative, oversized, and unrelated retry messages', () => {
    expect(estimateMeter('claude', 'Session usage: 31.4% used', []).percent).toBe(31.4);
    expect(estimateMeter('gemini', 'Usage quota: 68.6% remaining', []).remainingPercent).toBe(68.6);
    for (const text of ['Usage: -31% used', 'Usage: 131% used', 'Usage: -42% remaining', 'Network error. Try again in 2 minutes']) expect(estimateMeter('claude', text, []).tier).toBe('unknown');
  });
  it('does not interpret months as minutes, while supporting compact countdowns', () => {
    expect(parseReset('Resets in 2 months', now)).toBeUndefined();
    expect(parseReset('Resets in 2h45m', now)).toBe(now + 165 * 60000);
  });
  it('does not move an unchanged reset forward or resurrect it after expiry', () => {
    const initial = [window()];
    const reread = mergeUsageWindows(initial, [window({ at: now + 60000, resetAt: now + 180000 })], now + 60000);
    expect(reread[0].resetAt).toBe(initial[0].resetAt);
    const expired = mergeUsageWindows(reread, [window({ at: now + 180000, resetAt: now + 300000 })], now + 180000);
    expect(activeWindows(expired, now + 180000)).toEqual([]);
    const again = mergeUsageWindows(expired, [window({ at: now + 240000, resetAt: now + 360000 })], now + 240000);
    expect(activeWindows(again, now + 240000)).toEqual([]);
    const updated = mergeUsageWindows(again, [window({ evidenceKey: 'new-reset', at: now + 240000, resetAt: now + 360000 })], now + 240000);
    expect(activeWindows(updated, now + 240000)).toHaveLength(1);
  });
  it('retains another observed bucket without refreshing its observation time', () => {
    const weekly = window({ key: 'claude:Weekly', feature: 'Weekly', resetAt: now + 86400000 });
    const merged = mergeUsageWindows([weekly], [window({ at: now + 60000 })], now + 60000);
    expect(merged.find(win => win.feature === 'Weekly')?.at).toBe(now);
    expect(activeWindows(merged, now + 3600001)).toEqual([]);
  });
  it('rejects future, expired, non-finite, and invalid cached values', () => {
    for (const changes of [{at: now + 1}, {at: now - 3600001}, {percent: NaN}, {percent: 101}, {remainingTokens: -1}, {resetAt: now}]) expect(isCurrentReading(window(changes), now)).toBe(false);
    expect(activeWindows(null as unknown as UsageWindow[], now)).toEqual([]);
  });
  it('keeps the most constrained current bucket in the badge', () => {
    let record = updateBadge(undefined, window({ feature: 'Weekly', percent: 96, resetAt: now + 86400000 }), now);
    record = updateBadge(record, window({ feature: 'Session', percent: 31 }), now);
    expect(currentBadge(record, now)?.percent).toBe(96);
    record = updateBadge(record, window({ feature: 'Weekly', percent: 5, resetAt: now + 86400000 }), now);
    expect(currentBadge(record, now)?.percent).toBe(31);
    expect(currentBadge(record, now + 3600001)).toBeUndefined();
  });
  it('serializes read/modify/write operations and recovers after failure', async () => {
    const enqueue = usageQueue(); const records: number[] = [];
    await Promise.all([1, 2, 3].map(value => enqueue(async () => { const before = [...records]; await Promise.resolve(); records.splice(0, records.length, ...before, value); })));
    expect(records).toEqual([1, 2, 3]);
    await expect(enqueue(async () => { throw Error('Temporary failure'); })).rejects.toThrow();
    await expect(enqueue(async () => 4)).resolves.toBe(4);
  });
});

vi.mock('wxt/utils/define-background', () => ({ defineBackground: (setup: () => void) => setup }));
describe('background usage delivery', () => {
  it('retains both simultaneous alerts, avoids duplicates, and clears an expired badge', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const local: Record<string, unknown> = { desktopUsageAlerts: true };
    const session: Record<string, unknown> = {};
    const storage = (data: Record<string, unknown>) => ({ get: async (keys: string | string[]) => { await Promise.resolve(); return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, data[key]])); }, set: async (changes: Record<string, unknown>) => { await Promise.resolve(); Object.assign(data, changes); }, remove: async (key: string) => { delete data[key]; } });
    let listener: (message: unknown, sender: unknown, respond: (result: unknown) => void) => unknown;
    const event = { addListener: vi.fn(), removeListener: vi.fn() };
    const badge = vi.fn().mockResolvedValue(undefined), notify = vi.fn().mockResolvedValue('created');
    vi.stubGlobal('chrome', { alarms: { onAlarm: event, create: async () => {} }, runtime: { onInstalled: event, onMessage: { addListener: (fn: typeof listener) => { listener = fn; } }, getURL: (path: string) => `chrome-extension://test/${path}` }, tabs: { onActivated: event, onUpdated: event, onRemoved: event }, storage: { local: storage(local), session: storage(session) }, action: { setBadgeText: badge, setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined), setTitle: vi.fn().mockResolvedValue(undefined) }, permissions: { contains: async () => true }, notifications: { create: notify } });
    const { default: setup } = await import('../entrypoints/background'); (setup as unknown as () => void)();
    const dispatch = (message: unknown) => new Promise(resolve => listener(message, { url: 'https://claude.ai/chat/test', tab: { id: 7 } }, resolve));
    const observation = (feature: string, percent: number): Meter => ({ ...window(), feature, percent, remainingPercent: 100 - percent });
    await Promise.all([observation('Session',84), observation('Weekly',96), observation('Session',84)].map(meter => dispatch({ type: 'OBSERVE_USAGE', provider: 'claude', meter })));
    expect(notify).toHaveBeenCalledTimes(2);
    expect(local.deliveredUsageAlerts).toHaveLength(2);
    expect(badge.mock.calls.at(-1)?.[0]).toEqual({ tabId: 7, text: '96%' });
    vi.spyOn(Date, 'now').mockReturnValue(now + 3600001);
    await dispatch({ type: 'REFRESH_USAGE_BADGE' });
    expect(badge.mock.calls.at(-1)?.[0]).toEqual({ tabId: 7, text: '' });
    expect(session['usageBadge:7']).toBeUndefined();
  });
});
