import { describe, expect, it } from 'vitest';
import { laneFor, laneInUse } from '../src/core/usage-lanes';

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
  it('says “No limit shown” when the service shows only extras, like ChatGPT Work and credits', () => {
    const saved = { 'usageWindows:chatgpt': [win('chatgpt', 'Work weekly', { percent: 0, remainingPercent: 100 })] };
    expect(laneFor(saved, 'chatgpt', now)).toMatchObject({ value: 'No limit shown', detail: 'Chat: no limit shown · Work weekly 100% left' });
  });
  it('shows 0 sent for a service used this week but not in its current window', () => {
    expect(laneFor({ 'usageSends:grok': [now - 6 * 3600000] }, 'grok', now)).toMatchObject({ value: '0 sent', detail: '0 msgs in last 2 h · counted by Baton' });
  });
  it('knows which services are in use this week', () => {
    expect(laneInUse({ 'usageSends:grok': [now - 3 * 86400000] }, 'grok', now)).toBe(true);
    expect(laneInUse({ 'usageSends:grok': [now - 8 * 86400000] }, 'grok', now)).toBe(false);
    expect(laneInUse({ 'usageWindows:claude': [win('claude', 'Session', { percent: 5, at: now - 86400000 })] }, 'claude', now)).toBe(true);
    expect(laneInUse({}, 'perplexity', now)).toBe(false);
  });
  it('says nothing is known instead of inventing a number', () => {
    expect(laneFor({}, 'perplexity', now)).toEqual({ provider: 'perplexity', value: '—', detail: 'No usage shown yet', source: 'none' });
  });
});
