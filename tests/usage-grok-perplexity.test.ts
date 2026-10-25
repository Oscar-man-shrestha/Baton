import { describe, expect, it } from 'vitest';
import { parseUsageResponse, usageKindOf } from '../src/core/usage-api';
import { serviceCountSegments } from '../src/core/composer-line';

const now = Date.UTC(2026, 9, 25, 12);
describe('Grok and Perplexity publish exact counts (real answers, Oct 2026)', () => {
  it('Grok: one reading per model, with how many are left of how many', () => {
    const grok4 = parseUsageResponse('grok-rate-limits', JSON.stringify({ model: 'grok-4', data: { windowSizeSeconds: 86400, remainingQueries: 7, totalQueries: 7, lowEffortRateLimits: null, highEffortRateLimits: null } }), now);
    const grok3 = parseUsageResponse('grok-rate-limits', JSON.stringify({ model: 'grok-3', data: { windowSizeSeconds: 86400, remainingQueries: 2, totalQueries: 30, waitTimeSeconds: 3600 } }), now);
    expect(grok4).toMatchObject([{ provider: 'grok', feature: 'Grok 4', remainingCount: 7, percent: 0, source: 'provider-response' }]);
    expect(grok3[0]).toMatchObject({ feature: 'Grok 3', remainingCount: 2, resetAt: now + 3600000 });
    expect(serviceCountSegments([...grok4, ...grok3], now).map(segment => `${segment.label} ${segment.value}${segment.note ? ` (${segment.note})` : ''}`)).toEqual(['Grok 3 2 left (1h 0m)', 'Grok 4 7 left']);
  });
  it('Perplexity: free questions and each mode on the plan; modes the plan lacks are left out', () => {
    const status = { free_queries: { available: true, remaining_detail: { kind: 'exact', remaining: 10 } }, modes: { agentic_research: { available: false, remaining_detail: { kind: 'exact', remaining: 0 } }, labs: { available: false, remaining_detail: { kind: 'exact', remaining: 0 } }, pro_search: { available: true, remaining_detail: { kind: 'exact', remaining: 3 } }, research: { available: false, remaining_detail: { kind: 'exact', remaining: 0 } } } };
    const readings = parseUsageResponse('perplexity-rate-limit', JSON.stringify(status), now);
    expect(readings.map(reading => `${reading.feature} ${reading.remainingCount}`)).toEqual(['Free questions 10', 'Pro search 3']);
    expect(serviceCountSegments(readings, now).map(segment => `${segment.label} ${segment.value}`)).toEqual(['Pro search 3 left', 'Free questions 10 left']);
    expect(usageKindOf('https://www.perplexity.ai/rest/rate-limit/status?version=2.18&source=default')).toBe('perplexity-rate-limit');
    expect(usageKindOf('https://www.perplexity.ai/rest/thread/abc')).toBeUndefined();
  });
  it('ignores answers that are not limits', () => {
    expect(parseUsageResponse('grok-rate-limits', 'not json', now)).toEqual([]);
    expect(parseUsageResponse('grok-rate-limits', JSON.stringify({ model: 'grok-4', data: { error: 'unauthorized' } }), now)).toEqual([]);
    expect(parseUsageResponse('perplexity-rate-limit', JSON.stringify({ detail: 'signed out' }), now)).toEqual([]);
  });
  it('in the ranking and the panel: counts read as counts, and running out of one model or mode is not a limit', async () => {
    const { rescueOptions, reachedLimit } = await import('../src/core/rescue');
    const { laneFor } = await import('../src/core/usage-lanes');
    const grok = [...parseUsageResponse('grok-rate-limits', JSON.stringify({ model: 'grok-4', data: { remainingQueries: 0, totalQueries: 7, waitTimeSeconds: 7200 } }), now), ...parseUsageResponse('grok-rate-limits', JSON.stringify({ model: 'grok-3', data: { remainingQueries: 30, totalQueries: 30 } }), now)];
    const perplexity = parseUsageResponse('perplexity-rate-limit', JSON.stringify({ free_queries: { available: true, remaining_detail: { remaining: 10 } }, modes: { pro_search: { available: true, remaining_detail: { remaining: 0 } } } }), now);
    const saved = { 'usageWindows:grok': grok, 'usageWindows:perplexity': perplexity };
    expect(reachedLimit(saved, 'grok', now)).toBeUndefined();
    expect(reachedLimit(saved, 'perplexity', now)).toBeUndefined();
    const options = rescueOptions('chatgpt', saved, {}, now);
    expect(options.find(option => option.provider === 'grok')).toMatchObject({ status: 'room', detail: 'Grok 3: 30 left' });
    expect(options.find(option => option.provider === 'perplexity')).toMatchObject({ status: 'room', detail: 'Free questions: 10 left' });
    expect(laneFor(saved, 'grok', now)).toMatchObject({ value: '30 left', detail: 'Grok 3', source: 'service' });
    expect(laneFor(saved, 'perplexity', now).extras).toContain('Pro search: 0 left');
    const allOut = { 'usageWindows:grok': grok.map(win => ({ ...win, remainingCount: 0, percent: 100, remainingPercent: 0 })) };
    expect(reachedLimit(allOut, 'grok', now)).toBeDefined();
  });
});
