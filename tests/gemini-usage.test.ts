import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { isUsagePageUrl, readUsageWindows, usagePageUrl } from '../src/core/usage-windows';
import { parseReset } from '../src/core/limits';
const { JSDOM } = createRequire(import.meta.url)('jsdom') as typeof import('jsdom');

// Modelled on gemini.google.com/usage as seen in Brave on 2026-10-22 (free account, labels only, no account data).
const page = (session: string, weekly: string) => `<main><h1>Usage limits</h1><p>Your plan's limits determine how much you can use Gemini over time.</p><p>Updated just now</p>
  <div class="card"><div class="row"><span class="title">Current usage <mat-icon>info</mat-icon></span><span>${session}</span></div><div role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div><span>Resets at 04:40</span></div>
  <div class="card"><div><div class="title">Weekly limit</div><div>Resets on 28 Oct at 14:40</div></div><span>${weekly}</span></div>
  <div class="upsell">Get 2x more usage with AI Plus</div></main>`;
const now = new Date(2026, 9, 22, 1, 0).getTime();
const read = (html: string, url = 'https://gemini.google.com/usage') => readUsageWindows(new JSDOM(html, { url }).window.document, 'gemini', [], now);

describe('Gemini usage limits page', () => {
  it('reads the 5-hour and weekly windows with their resets', () => {
    const windows = read(page('37% used', '4% used'));
    expect(windows.map(win => [win.key, win.percent, win.remainingPercent])).toEqual([['gemini:Session', 37, 63], ['gemini:Weekly', 4, 96]]);
    expect(windows[0].resetAt).toBe(new Date(2026, 9, 22, 4, 40).getTime());
    expect(windows[1].resetAt).toBe(new Date(2026, 9, 28, 14, 40).getTime());
    expect(windows.every(win => win.source === 'provider-page' && win.confidence === 'high')).toBe(true);
  });
  it('treats 0% as a real reading, not unknown', () => {
    expect(read(page('0% used', '0% used')).map(win => win.percent)).toEqual([0, 0]);
  });
  it('reads nothing when the page shows no percentage', () => {
    expect(read(page('Loading', 'Loading'))).toEqual([]);
  });
  it('only reads the usage page, not chats that quote the same words', () => {
    expect(read(page('37% used', '4% used'), 'https://gemini.google.com/app/abc')).toEqual([]);
  });
  it('ignores another extension’s overlay on the usage page', () => {
    const overlay = '<div data-extension="x"><div>Current usage</div><span>90% used</span></div>';
    expect(read(page('Loading', 'Loading') + overlay)).toEqual([]);
  });
  it('knows each service’s usage page', () => {
    expect(isUsagePageUrl('gemini', 'https://gemini.google.com/usage')).toBe(true);
    expect(isUsagePageUrl('gemini', 'https://gemini.google.com/app')).toBe(false);
    expect(isUsagePageUrl('claude', 'https://claude.ai/new#settings/usage')).toBe(true);
    expect(usagePageUrl('gemini')).toBe('https://gemini.google.com/usage');
    expect(usagePageUrl('chatgpt')).toBeUndefined();
  });
});

describe('reset times shown as dates and weekdays', () => {
  it('reads “Resets on 28 Oct at 14:40” and “Resets Oct 28 at 2:40 PM”', () => {
    expect(parseReset('Resets on 28 Oct at 14:40', now)).toBe(new Date(2026, 9, 28, 14, 40).getTime());
    expect(parseReset('Resets Oct 28 at 2:40 PM', now)).toBe(new Date(2026, 9, 28, 14, 40).getTime());
  });
  it('moves a date that already passed to next year', () => {
    expect(parseReset('Resets on 3 Jan at 09:00', now)).toBe(new Date(2027, 0, 3, 9, 0).getTime());
  });
  it('reads Claude’s weekday form “Resets Sun 12:30 AM”', () => {
    expect(parseReset('Resets Sun 12:30 AM', now)).toBe(new Date(2026, 9, 25, 0, 30).getTime());
  });
  it('rejects impossible dates', () => {
    expect(parseReset('Resets on 31 Feb at 10:00', now)).toBeUndefined();
  });
});
