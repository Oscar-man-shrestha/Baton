import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { parseResetTooltip, readUsageWindows } from '../src/core/usage-windows';
import { reachedLimit, rescueOptions } from '../src/core/rescue';
const { JSDOM } = createRequire(import.meta.url)('jsdom') as typeof import('jsdom');

// Trimmed from chatgpt.com/settings/usage saved in Brave on 2026-10-22: classes removed, no account data.
const row = (label: string, reset: string, tooltip: string, left: string, value: number) => `<div><div><div><div>${label}</div></div></div><div><div><div><span><span title="${tooltip}">${reset}</span></span><span>${left}</span></div><div><progress max="100" value="${value}" aria-label="Usage remaining"></progress></div></div></div></div>`;
const page = (fiveHourLeft: number, weeklyLeft: number) => `<main><section><div><div>Plan limits</div><div>Shared across Codex, Work, Workspace Agents, and ChatGPT for Excel. Chat conversations are not included.</div></div>
  <div><div>${row('5-hour limit', 'Resets in 5h 0m', 'Thursday, October 22, 2026 at 5:39:17 AM GMT+5:30', `${fiveHourLeft}% left`, fiveHourLeft)}${row('Weekly limit', 'Resets in 5d 15h', 'Tuesday, October 27, 2026 at 4:04:33 PM GMT+5:30', `${weeklyLeft}% left`, weeklyLeft)}</div></div></section>
  <section><div>Credits</div><div><div><div>2,500 credits remaining</div><div>Current balance</div></div></div></section>
  <section><span>Usage limit resets</span><div>Use a reset to restore your 5-hour limit, weekly limit, or both</div><button role="tab" type="button"><span>Available <span>0</span></span></button></section></main>`;
const now = Date.parse('2026-10-21T19:10:00Z');
const read = (html: string, url = 'https://chatgpt.com/settings/usage?tab=overview') => readUsageWindows(new JSDOM(html, { url }).window.document, 'chatgpt', [], now);

describe('ChatGPT usage page', () => {
  it('reads Work limits as left, with exact tooltip resets, plus credits and banked resets', () => {
    const windows = read(page(63, 100));
    expect(windows.map(win => [win.feature, win.percent, win.remainingPercent, win.remainingCount])).toEqual([
      ['Work 5-hour', 37, 63, undefined], ['Work weekly', 0, 100, undefined], ['Credits', undefined, undefined, 2500], ['Banked limit resets', undefined, undefined, 0]
    ]);
    expect(windows[0].resetAt).toBe(Date.parse('2026-10-22T00:09:17Z'));
    expect(windows[1].resetAt).toBe(Date.parse('2026-10-27T10:34:33Z'));
    expect(windows[0].explanation).toContain('chat is not included');
  });
  it('never reads a full “usage remaining” bar as used up', () => {
    expect(read(page(100, 100)).slice(0, 2).map(win => win.percent)).toEqual([0, 0]);
  });
  it('also reads the Codex settings address and nothing on chat pages', () => {
    expect(read(page(63, 100), 'https://chatgpt.com/codex/settings/usage')).toHaveLength(4);
    expect(read(page(63, 100), 'https://chatgpt.com/c/abc').some(win => win.feature.startsWith('Work'))).toBe(false);
  });
  it('parses tooltip dates with time zones and rejects broken ones', () => {
    expect(parseResetTooltip('Tuesday, October 27, 2026 at 4:04:33 PM GMT+5:30')).toBe(Date.parse('2026-10-27T10:34:33Z'));
    expect(parseResetTooltip('October 27, 2026 at 16:04 UTC')).toBe(Date.parse('2026-10-27T16:04:00Z'));
    expect(parseResetTooltip('February 30, 2026 at 4:04 PM GMT')).toBeUndefined();
    expect(parseResetTooltip('soon')).toBeUndefined();
  });
  it('does not treat a full Work limit as ChatGPT chat being out', () => {
    const windows = read(page(0, 40));
    const saved = { 'usageWindows:chatgpt': windows };
    expect(windows[0].percent).toBe(100);
    expect(reachedLimit(saved, 'chatgpt', now)).toBeUndefined();
    expect(rescueOptions('claude', saved, {}, now).find(option => option.provider === 'chatgpt')?.detail).toBe('no limit shown');
  });
});
