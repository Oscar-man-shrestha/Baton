import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { estimateMeter, parseRemainingCount, parseStatedLimit } from '../src/core/limits';
import { messageSummary } from '../src/core/message-counts';
import { rescueOptions } from '../src/core/rescue';
import { makeAdapter } from '../src/core/adapter';
import { bundledSelectors } from '../src/core/selectors';
import { composerStatusText } from '../src/core/composer-status';
const { JSDOM } = createRequire(import.meta.url)('jsdom') as typeof import('jsdom');

const now = Date.UTC(2026, 9, 22, 12);
const min = 60000;

describe('limits the service states', () => {
  it.each([
    ['You’ve reached your limit of 20 messages per 2 hours.', { count: 20, hours: 2 }],
    ['Limit of 50 queries every 3 hrs', { count: 50, hours: 3 }],
    ['You have reached the limit of 10 messages per hour', { count: 10, hours: 1 }],
    ['limit of 5 Pro searches per day', { count: 5, hours: 24 }],
    ['limit of 30 messages every 90 minutes', { count: 30, hours: 1.5 }]
  ])('%s', (text, expected) => { expect(parseStatedLimit(text)).toEqual(expected); });
  it('ignores numbers that are not a stated limit', () => {
    expect(parseStatedLimit('I have 20 messages from 2 hours ago')).toBeUndefined();
    expect(parseStatedLimit('limit of 0 messages per 2 hours')).toBeUndefined();
  });
});

describe('“N left” notices', () => {
  it.each([
    ['3 Pro searches left today', { count: 3, what: 'Pro searches' }],
    ['You have 2 responses left', { count: 2, what: 'responses' }],
    ['1 message remaining until 4 PM', { count: 1, what: 'message' }]
  ])('%s', (text, expected) => { expect(parseRemainingCount(text)).toEqual(expected); });
  it('becomes a reading with a count, and 0 left counts as reached', () => {
    const meter = estimateMeter('perplexity', '3 Pro searches left today', [], [], now);
    expect([meter.tier, meter.remainingCount, meter.feature, meter.percent]).toEqual(['banner', 3, 'Pro searches', undefined]);
    expect(composerStatusText(0, { ...meter, at: now }, now)).toBe('3 Pro searches left (service notice)');
    expect(estimateMeter('claude', '0 messages remaining until 6:00 PM', [], [], now).percent).toBe(100);
  });
  it('is found as plain text near the composer, but not inside a chat message', () => {
    const doc = (body: string) => new JSDOM(`<main>${body}</main>`, { url: 'https://www.perplexity.ai/' }).window.document;
    expect(makeAdapter('perplexity', bundledSelectors).detectLimit(doc('<div><span>3 Pro searches left today</span></div><textarea></textarea>')).text).toContain('3 Pro searches left');
    expect(makeAdapter('perplexity', bundledSelectors).detectLimit(doc('<div data-testid="answer-message"><p>You may see 3 Pro searches left today.</p></div>')).kind).toBe('unknown');
  });
});

describe('counts with a stated limit', () => {
  const sends = [now - 100 * min, now - 60 * min, now - 30 * min, now - 5 * min];
  it('uses the service’s own figure and window over a learned one', () => {
    const summary = messageSummary('grok', sends, [{ at: 1, count: 12 }], now, { count: 20, hours: 2 });
    expect(summary.text).toBe('4 of 20 msgs in last 2 h · ≈16 left (limit stated by Grok)');
    expect(messageSummary('grok', sends, [], now, { count: 20, hours: 0.5 }).text).toBe('1 of 20 msgs in last 30 min · ≈19 left (limit stated by Grok)');
  });
  it('lets the rescue card rank a counted service as having room', () => {
    const saved = { 'usageSends:grok': sends, 'statedLimit:grok': { count: 20, hours: 2 }, 'usageSends:deepseek': sends, 'limitHits:deepseek': [{ at: 1, count: 4 }] };
    const options = rescueOptions('claude', saved, { chatgpt: false, gemini: false, perplexity: false }, now);
    expect(options.map(option => [option.provider, option.status, option.detail])).toEqual([
      ['grok', 'room', '≈16 of 20 left (counted)'], ['deepseek', 'unknown', '≈0 of 4 left (counted)']
    ]);
  });
});
