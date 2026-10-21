import { describe, expect, it } from 'vitest';
import { messageSummary, recordLimitHit } from '../src/core/message-counts';

const now = Date.UTC(2026, 9, 22, 12);
const min = 60000;

describe('message counts for services without official numbers', () => {
  it('counts only messages in the service’s rolling window', () => {
    const sends = [now - 150 * min, now - 90 * min, now - 30 * min, now - min];
    expect(messageSummary('grok', sends, [], now)).toEqual({ count: 3, hours: 2, text: '3 msgs in last 2 h' });
    expect(messageSummary('deepseek', sends, [], now).count).toBe(4);
  });
  it('learns the limit from when the service last showed it', () => {
    const before = Array.from({ length: 20 }, (_, i) => now - 5 * 3600000 + i * 3 * min);
    const hits = recordLimitHit([], before, 'grok', now - 5 * 3600000 + 60 * min);
    expect(hits).toEqual([{ at: now - 5 * 3600000 + 60 * min, count: 20 }]);
    const recent = [now - 40 * min, now - 20 * min, now - 5 * min];
    expect(messageSummary('grok', [...before, ...recent], hits, now).text).toBe('3 msgs in last 2 h · limit hit after ~20 last time · ≈17 left (learned)');
  });
  it('uses the median of recent hits and never goes below zero', () => {
    const hits = [{ at: 1, count: 10 }, { at: 2, count: 30 }, { at: 3, count: 12 }];
    const sends = Array.from({ length: 15 }, (_, i) => now - i * min);
    expect(messageSummary('grok', sends, hits, now)).toMatchObject({ learnedLimit: 12, left: 0 });
  });
  it('records a limit at most once per hour and ignores hits with no counted messages', () => {
    const first = recordLimitHit([], [now - min], 'claude', now);
    expect(recordLimitHit(first, [now - min], 'claude', now + 30 * min)).toBe(first);
    expect(messageSummary('claude', [], [{ at: now, count: 0 }], now).learnedLimit).toBeUndefined();
  });
});
