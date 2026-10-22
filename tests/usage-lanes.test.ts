import { describe, expect, it } from 'vitest';
import { laneFor } from '../src/core/usage-lanes';

const now = Date.UTC(2026, 9, 22, 3);
const min = 60000;
const win = (provider: string, feature: string, extra: Record<string, unknown>) => ({ provider, tier: 'banner', confidence: 'high', key: `${provider}:${feature}`, feature, at: now - min, source: 'provider-page', explanation: '', ...extra });

describe('dashboard lanes', () => {
  it('shows the tightest chat window from the service, with its reset', () => {
    const saved = { 'usageWindows:claude': [win('claude', 'Session', { percent: 54, remainingPercent: 46, resetAt: now + 124 * min }), win('claude', 'Weekly', { percent: 8, remainingPercent: 92 })] };
    expect(laneFor(saved, 'claude', now)).toEqual({ provider: 'claude', left: 46, value: '46% left', detail: 'Session · resets in 2h 4m', source: 'service' });
  });
  it('keeps ChatGPT Work limits and credits as extras, not as the chat lane', () => {
    const saved = { 'usageWindows:chatgpt': [win('chatgpt', 'Work 5-hour', { percent: 0, remainingPercent: 100 }), win('chatgpt', 'Credits', { remainingCount: 2500 })], 'usageSends:chatgpt': [now - 10 * min] };
    expect(laneFor(saved, 'chatgpt', now)).toMatchObject({ value: '1 sent', source: 'counted', detail: '1 msg in last 5 h · counted by Baton · Work 5-hour 100% left · Credits 2,500 left' });
  });
  it('uses a stated or learned limit when the service shows no numbers', () => {
    const saved = { 'usageSends:grok': [now - 30 * min, now - 10 * min], 'statedLimit:grok': { count: 20, hours: 2 } };
    expect(laneFor(saved, 'grok', now)).toMatchObject({ left: 90, value: '≈18 left', source: 'counted' });
  });
  it('says nothing is known instead of inventing a number', () => {
    expect(laneFor({}, 'perplexity', now)).toEqual({ provider: 'perplexity', value: '—', detail: 'No usage shown yet', source: 'none' });
  });
});
