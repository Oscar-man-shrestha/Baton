import { describe, expect, it } from 'vitest';
import { estimateMeter } from '../src/core/limits';
import { meterSummary, usageAlert } from '../src/core/usage-alerts';

describe('usage alerts', () => {
  const now = Date.UTC(2026, 9, 21, 6);
  it('alerts once for a provider-reported threshold', () => {
    const meter = estimateMeter('claude', 'Session usage: 84% used. Resets in 2 hours', [], [], now);
    const first = usageAlert(meter, [], now);
    expect(first?.message).toContain('84% used');
    expect(usageAlert(meter, [first!.key], now)).toBeUndefined();
    const changedCountdown = estimateMeter('claude', 'Session usage: 85% used. Resets in 2 hours', [], [], now + 600000);
    expect(usageAlert(changedCountdown, [first!.key], now + 600000)).toBeUndefined();
    expect(usageAlert(estimateMeter('claude', 'Session usage: 96% used. Resets in 2 hours', [], [], now), [first!.key], now)?.key).toContain(':95');
  });
  it('does not alert from token history or unknown quotas', () => {
    expect(usageAlert(estimateMeter('grok', '', []), [], now)).toBeUndefined();
    expect(usageAlert(estimateMeter('gemini', 'Usage quota: 42% remaining', []), [], now)).toBeUndefined();
  });
  it('alerts on a visible near or reached limit without making up a percentage', () => {
    const near = estimateMeter('deepseek', 'You are approaching your usage limit', [], [], now);
    expect(near.percent).toBeUndefined();
    expect(usageAlert(near, [], now)?.message).toContain('close to a limit');
    const reached = estimateMeter('chatgpt', 'Usage limit reached. Try again in 30 minutes', [], [], now);
    expect(usageAlert(reached, [], now)?.message).toContain('reports a limit');
  });
  it('marks old or unreported balances as unknown', () => {
    const meter = { ...estimateMeter('gemini', 'Usage quota: 17% remaining', [], [], now), at: now };
    expect(meterSummary(meter, now)).toContain('17% left');
    expect(meterSummary(meter, now + 3600001)).toContain('No recent');
  });
});
