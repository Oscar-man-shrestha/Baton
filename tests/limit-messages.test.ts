import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { makeAdapter } from '../src/core/adapter';
import { bundledSelectors } from '../src/core/selectors';
import { estimateMeter, parseReset } from '../src/core/limits';
import { reachedLimit } from '../src/core/rescue';
const { JSDOM } = createRequire(import.meta.url)('jsdom') as typeof import('jsdom');

// Wordings are representative; the exact live text has not been captured yet.
const detect = (id: 'chatgpt' | 'grok' | 'claude', body: string) => makeAdapter(id, bundledSelectors).detectLimit(new JSDOM(`<main>${body}</main>`, { url: id === 'grok' ? 'https://grok.com/' : id === 'claude' ? 'https://claude.ai/new' : 'https://chatgpt.com/' }).window.document);
const now = new Date(2026, 9, 22, 13, 0).getTime();

describe('plain-text limit messages near the composer', () => {
  it('catches ChatGPT’s plan limit text without an alert role', () => {
    const signal = detect('chatgpt', '<div data-message-author-role="assistant">Sure.</div><div class="banner"><div>You’ve hit the Free plan limit for GPT-5.6.</div><div>Responses will use another model until your limit resets after 4:12 PM.</div></div><div id="prompt-textarea" contenteditable="true"></div>');
    expect(signal.kind).toBe('banner');
    const meter = estimateMeter('chatgpt', signal.text, [], [], now);
    expect(meter.percent).toBe(100);
    expect(meter.feature).toBe('Model');
    expect(meter.resetAt).toBe(new Date(2026, 9, 22, 16, 12).getTime());
  });
  it('labels a ChatGPT image cap as images so chat is not treated as out', () => {
    const meter = estimateMeter('chatgpt', detect('chatgpt', '<p>You’ve reached your image creation limit. Try again in 3 hours.</p>').text, [], [], now);
    expect([meter.percent, meter.feature, meter.resetAt]).toEqual([100, 'Images', now + 3 * 3600000]);
    expect(reachedLimit({ 'meter:chatgpt': { ...meter, at: now - 1000 } }, 'chatgpt', now)).toBeUndefined();
  });
  it('catches Grok’s limit text and its countdown', () => {
    const signal = detect('grok', '<div><span>You’ve reached your limit of 20 messages per 2 hours.</span> <span>Try again in 1 hour 23 minutes.</span></div><textarea></textarea>');
    const meter = estimateMeter('grok', signal.text, [], [], now);
    expect([meter.percent, meter.feature, meter.resetAt]).toEqual([100, 'chat usage', now + 83 * 60000]);
    expect(reachedLimit({ 'meter:grok': { ...meter, at: now - 1000 } }, 'grok', now)?.provider).toBe('grok');
  });
  it('catches “out of free messages … until” wording', () => {
    const meter = estimateMeter('claude', detect('claude', '<div>You are out of free messages until 6:00 PM</div>').text, [], [], now);
    expect([meter.percent, meter.resetAt]).toEqual([100, new Date(2026, 9, 22, 18, 0).getTime()]);
  });
  it('ignores the same words inside chat messages, the sidebar and the unsent prompt', () => {
    expect(detect('chatgpt', '<div data-message-author-role="assistant"><p>You’ve hit the Free plan limit when this appears.</p></div>').kind).toBe('unknown');
    expect(detect('grok', '<nav><a>You’ve reached your limit - chat title</a></nav>').kind).toBe('unknown');
    expect(detect('chatgpt', '<div id="prompt-textarea" contenteditable="true"><p>why did I hit the limit?</p></div>').kind).toBe('unknown');
  });
  it('ignores long paragraphs that merely mention limits', () => {
    expect(detect('grok', `<p>${'Some article text about plans. '.repeat(12)}You’ve reached your limit is a message you might see.</p>`).kind).toBe('unknown');
  });
  it('does not mistake a near-limit warning for a reached limit', () => {
    const meter = estimateMeter('claude', detect('claude', '<div role="alert">You are approaching your usage limit.</div>').text, [], [], now);
    expect(meter.percent).toBeUndefined();
    expect(meter.nearLimit).toBe(true);
  });
});

describe('reset wordings', () => {
  it.each([
    ['Try again after 4:12 PM', new Date(2026, 9, 22, 16, 12)],
    ['available again at 9:30 AM', new Date(2026, 9, 23, 9, 30)],
    ['until 6:00 PM', new Date(2026, 9, 22, 18, 0)],
    ['Try again tomorrow at 1:30 PM', new Date(2026, 9, 23, 13, 30)],
    ['Resets at 04:40', new Date(2026, 9, 23, 4, 40)]
  ])('%s', (text, expected) => { expect(parseReset(text, now)).toBe(expected.getTime()); });
  it('ignores clock times that are not about a reset', () => {
    expect(parseReset('Meeting notes from 4:12 PM', now)).toBeUndefined();
  });
});
