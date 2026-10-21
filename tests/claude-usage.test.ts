import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { readUsageWindows } from '../src/core/usage-windows';
import { parseReset } from '../src/core/limits';
import { reachedLimit } from '../src/core/rescue';
const { JSDOM } = createRequire(import.meta.url)('jsdom') as typeof import('jsdom');

// Trimmed from claude.ai/new#settings/usage saved in Brave on 2026-10-22 (Pro plan): classes and ids simplified, no account data.
const meter = (id: string, label: string, reset: string, used: number) => `<div><div><div><div><span id="${id}">${label}</span></div></div><div>${reset}</div><div><div><div role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${used}" aria-valuetext="${used}% used" aria-labelledby="${id}"><div></div></div></div></div><div>${used}% used</div></div></div>`;
const page = (session: number, weekly: number) => `<main><section><h3><span><span>Plan usage limits</span><span>Pro</span></span></h3><div><div>${meter('s', 'Current session', 'Resets in 3 hr 16 min', session)}</div></div></section>
  <section><h3>Weekly limits</h3><div><a href="https://support.claude.com/">Learn more about usage limits</a><div>${meter('w', 'All models', 'Resets Sun 12:30 AM', weekly)}</div></div></section>
  <section id="resets"><h3>Limit resets</h3><div id="resets-full" role="group"><div><span><div><span>Full reset</span></div><button type="button" aria-label="About full resets"></button></span><div><span>Expires Oct 22</span></div></div><button type="button" disabled><span>Reset for free</span></button><div role="status"></div></div></section></main>`;
const now = new Date(2026, 9, 22, 1, 4).getTime();
const read = (html: string) => readUsageWindows(new JSDOM(html, { url: 'https://claude.ai/new#settings/usage' }).window.document, 'claude', [], now);

describe('Claude usage page', () => {
  it('reads session and weekly with both reset styles, plus the full-reset offer', () => {
    const windows = read(page(41, 6));
    expect(windows.map(win => [win.feature, win.percent, win.remainingCount])).toEqual([
      ['Full reset (expires Oct 22)', undefined, 1], ['Session', 41, undefined], ['Weekly', 6, undefined]
    ]);
    expect(windows[1].resetAt).toBe(now + (3 * 60 + 16) * 60000);
    expect(windows[2].resetAt).toBe(new Date(2026, 9, 25, 0, 30).getTime());
  });
  it('flags a full session as a reached limit for the rescue card', () => {
    expect(reachedLimit({ 'usageWindows:claude': read(page(100, 40)) }, 'claude', now)).toEqual({ provider: 'claude', feature: 'Session', resetAt: now + (3 * 60 + 16) * 60000 });
  });
  it('reads hr/min countdowns', () => {
    expect(parseReset('Resets in 3 hr 16 min', now)).toBe(now + 196 * 60000);
    expect(parseReset('Try again in 2 hrs', now)).toBe(now + 2 * 3600000);
    expect(parseReset('in 45 mins', now)).toBe(now + 45 * 60000);
  });
});
