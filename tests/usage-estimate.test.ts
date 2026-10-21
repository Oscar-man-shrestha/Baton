import { describe, expect, it } from 'vitest';
import { displayLabel, displayWindows, perMessageCost, recordReadings } from '../src/core/usage-estimate';
import type { UsageWindow } from '../src/core/usage-windows';

const t0 = new Date(2026, 9, 22, 1, 0).getTime();
const min = 60000;
const reset = t0 + 4 * 60 * min;
const win = (feature: string, percent: number, at: number, extra: Partial<UsageWindow> = {}): UsageWindow => ({ provider: 'claude', tier: 'banner', confidence: 'high', key: `claude:${feature}`, feature, percent, remainingPercent: 100 - percent, at, resetAt: reset, source: 'provider-page', explanation: '', ...extra });

describe('live usage estimate', () => {
  it('learns a per-message cost from two readings with sends between them', () => {
    const history = recordReadings(recordReadings({}, [win('Session', 30, t0)]), [win('Session', 36, t0 + 30 * min)]);
    expect(perMessageCost(history['claude:Session'], [t0 + 5 * min, t0 + 10 * min, t0 + 20 * min])).toBe(2);
  });
  it('ignores pairs across a reset or with no sends', () => {
    const readings = [{ at: t0, percent: 30, resetAt: reset }, { at: t0 + 10 * min, percent: 5, resetAt: reset + 5 * 3600000 }];
    expect(perMessageCost(readings, [t0 + min])).toBeUndefined();
    expect(perMessageCost([{ at: t0, percent: 30 }, { at: t0 + 10 * min, percent: 34 }], [])).toBeUndefined();
  });
  it('moves the last official reading forward by messages sent since, clearly marked', () => {
    const history = recordReadings(recordReadings({}, [win('Session', 30, t0)]), [win('Session', 36, t0 + 30 * min)]);
    const sends = [t0 + 5 * min, t0 + 10 * min, t0 + 20 * min, t0 + 40 * min, t0 + 50 * min, t0 + 55 * min];
    const now = t0 + 60 * min;
    const [shown] = displayWindows([win('Session', 36, t0 + 30 * min)], history, sends, now);
    expect([shown.percent, shown.estimate?.sends, shown.estimate?.from]).toEqual([42, 3, 36]);
    expect(displayLabel(shown, now)).toMatch(/^Session ≈42% used · est\. · 3 msgs since 36% at .+ · resets in 3h 0m$/);
  });
  it('without a learned cost, says how many messages were sent instead of inventing a number', () => {
    const history = recordReadings({}, [win('Session', 41, t0)]);
    const now = t0 + 20 * min;
    const [shown] = displayWindows([win('Session', 41, t0)], history, [t0 + 5 * min, t0 + 6 * min], now);
    expect(shown.percent).toBe(41);
    expect(displayLabel(shown, now)).toMatch(/^Session 41% used at .+ · 2 msgs since 41% at /);
  });
  it('keeps showing the last reading after an hour, but stops at the reset or after six hours', () => {
    const history = recordReadings({}, [win('Session', 41, t0)]);
    expect(displayWindows([], history, [], t0 + 2 * 3600000)).toHaveLength(0);
    const stored = [win('Session', 41, t0)];
    expect(displayWindows(stored, history, [], t0 + 2 * 3600000)[0].estimate?.from).toBe(41);
    expect(displayWindows(stored, history, [], reset + 1)).toEqual([]);
    expect(displayWindows([win('Session', 41, t0, { resetAt: undefined })], recordReadings({}, [win('Session', 41, t0, { resetAt: undefined })]), [], t0 + 7 * 3600000)).toEqual([]);
  });
  it('never estimates ChatGPT Work limits or counts from chat messages', () => {
    const work = win('Work 5-hour', 10, t0, { provider: 'chatgpt', key: 'chatgpt:Work 5-hour' });
    const credits = { ...win('Credits', 0, t0, { provider: 'chatgpt', key: 'chatgpt:Credits' }), percent: undefined, remainingPercent: undefined, remainingCount: 2500 };
    const history = recordReadings({}, [work, credits]);
    expect(history).toEqual({});
    const shown = displayWindows([work, credits], history, [t0 + min], t0 + 10 * min);
    expect(shown.map(item => [item.feature, item.percent, item.estimate])).toEqual([['Work 5-hour', 10, undefined], ['Credits', undefined, undefined]]);
  });
  it('caps an estimate at 100%', () => {
    const history = recordReadings(recordReadings({}, [win('Session', 80, t0)]), [win('Session', 90, t0 + 10 * min)]);
    const [shown] = displayWindows([win('Session', 90, t0 + 10 * min)], history, [t0 + min, ...Array.from({ length: 20 }, (_, i) => t0 + 11 * min + i * 1000)], t0 + 20 * min);
    expect(shown.percent).toBe(100);
  });
});
