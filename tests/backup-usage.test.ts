import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { exportBackup, previewBackup, mergeBackup } from '../src/core/backup';
import { briefSchema } from '../src/core/brief';
import { parseClaudeUsage, activeWindows, readUsageWindows, resetCountdown, isClaudeUsageUrl } from '../src/core/usage-windows';
import { parseReset, estimateMeter } from '../src/core/limits';
const { JSDOM } = createRequire(import.meta.url)('jsdom') as typeof import('jsdom');
const now = Date.UTC(2026, 9, 21, 9);
describe('full backup', () => {
  const url = 'https://gemini.google.com/app/saved';
  const brief = briefSchema.parse({ goal: 'Save my context' });
  const store = { projects: [{ id: 'p', name: 'Saved edits', updatedAt: now, threads: [url], brief, draft: 'My edited draft' }], folders: ['Personal'], [`brief:${url}`]: brief, [`savedAt:brief:${url}`]: now, [`archive:brief:${url}`]: { turns: [{ role: 'user', index: 0, text: 'Original request', id: 'u1' }], incomplete: true }, apiKey: 'DO_NOT_EXPORT', desktopUsageAlerts: true };
  it('roundtrips messages, edited drafts, folders, timestamps and coverage, excluding settings and keys', async () => {
    const text = await exportBackup(store); expect(text).not.toContain('DO_NOT_EXPORT'); expect(text).not.toContain('desktopUsageAlerts');
    const preview = await previewBackup(text); expect(preview.contexts).toBe(1); expect(preview.projects).toBe(1);
    const restored = mergeBackup({}, preview.data); expect(restored[`archive:brief:${url}`]).toEqual(store[`archive:brief:${url}`]); expect((restored.projects as any)[0].draft).toBe('My edited draft');
  });
  it('rejects modified files before any local write', async () => { const file = await exportBackup(store); await expect(previewBackup(file.replace('Original request', 'Injected request'))).rejects.toThrow('checksum'); });
  it('retains newer local projects and captures', async () => {
    const preview = await previewBackup(await exportBackup(store));
    const newer = { ...store, projects: [{ ...store.projects[0], updatedAt: now + 1, draft: 'New draft' }], [`savedAt:brief:${url}`]: now + 1 };
    const changes = mergeBackup(newer, preview.data); expect(changes[`brief:${url}`]).toBeUndefined(); expect((changes.projects as any)[0].draft).toBe('New draft');
  });
  it('does not accept unrecognized backup formats', async () => { await expect(previewBackup('{"projects":[]}')).rejects.toThrow(); });
});
describe('real quota windows', () => {
  it('distinguishes Claude API percent from completion fractions and never coerces null to zero', () => {
    expect(parseClaudeUsage({ five_hour: { utilization: 31, resets_at: '2026-10-21T12:00:00Z' }, seven_day: { utilization: 5 }, seven_day_sonnet: { utilization: null } }, now).map(w => w.percent)).toEqual([31, 5]);
    expect(parseClaudeUsage({ message_limit: { windows: { '5h': { utilization: .31, resets_at: now / 1000 + 3600 }, '7d': { utilization: .05 } } } }, now).map(w => w.percent)).toEqual([31, 5]);
    expect(parseClaudeUsage({ five_hour: { utilization: null } }, now)).toEqual([]); expect(parseClaudeUsage({ five_hour: { utilization: 500 } }, now)).toEqual([]);
  });
  it('expires stale and reset readings instead of inventing a new zero balance', () => {
    const windows = parseClaudeUsage({ five_hour: { utilization: 31, resets_at: (now + 60000) / 1000 } }, now);
    expect(activeWindows(windows, now)).toHaveLength(1); expect(activeWindows(windows, now + 60001)).toHaveLength(0);
    expect(activeWindows(parseClaudeUsage({ five_hour: { utilization: 31 } }, now), now + 3600001)).toHaveLength(0);
  });
  it('reads separate semantic windows, rejecting chat text and extension widgets', () => {
    const doc = new JSDOM(`<main><article><div role="progressbar" aria-label="Session usage" aria-valuenow="99" aria-valuemax="100"></div></article><div role="progressbar" aria-label="Session usage" aria-valuenow="31" aria-valuemax="100">Resets in 2 hours 45 minutes</div><div role="progressbar" aria-label="Weekly usage" aria-valuenow="5" aria-valuemax="100"></div><aside><div role="progressbar" aria-label="Usage" aria-valuenow="0" aria-valuemax="100"></div></aside><div hidden><div role="progressbar" aria-label="Usage" aria-valuenow="100" aria-valuemax="100"></div></div><div id="capsule-widget"><div role="alert">Usage 100% used</div></div></main>`, { url: 'https://claude.ai/chat/x' }).window.document;
    const windows = readUsageWindows(doc, 'claude', Array.from(doc.querySelectorAll('article')), now);
    expect(windows.map(win => [win.feature, win.percent])).toEqual([['Session', 31], ['Weekly', 5]]); expect(windows[0].resetAt).toBe(now + 165 * 60000);
  });
  it('parses multiple-unit reset countdowns', () => {
    expect(parseReset('Resets in 3 days 9 hours', now)).toBe(now + 81 * 3600000);
    expect(resetCountdown(now + 165 * 60000, now)).toBe('2h 45m'); expect(resetCountdown(now - 1, now)).toBe(''); expect(parseReset('resets at 99:99', now)).toBeUndefined();
  });
  it('does not assign a broad container value to the wrong window or clamp invalid percentages', () => {
    const doc = new JSDOM('<main><div data-testid="usage"><div role="progressbar" aria-label="Session usage" aria-valuenow="31" aria-valuemax="100"></div><div role="progressbar" aria-label="Weekly usage" aria-valuenow="5" aria-valuemax="100"></div></div></main>').window.document;
    expect(readUsageWindows(doc, 'claude', [], now).map(w => [w.feature, w.percent])).toEqual([['Session', 31], ['Weekly', 5]]);
    expect(estimateMeter('claude', 'Usage 131% used', []).percent).toBeUndefined();
  });

});


describe('Claude settings text rows', () => {
  it.each(['https://claude.ai/settings/usage', 'https://claude.ai/new#settings/usage'])('reads plain nested rows in the page or settings overlay: %s', url => {
    const doc = new JSDOM(`<main></main><div role="dialog"><h2>Usage limits</h2><section><div><div><span>Current session</span><p>Resets in 2 hours 45 minutes</p></div><span>31% used</span></div><div><div><span>All models</span><p>Resets in 3 days</p></div><span>5% used</span></div></section></div>`, { url }).window.document;
    const windows = readUsageWindows(doc, 'claude', [], now);
    expect(windows.map(win => [win.feature, win.percent])).toEqual([['Session',31],['Weekly',5]]);
    expect(windows[0].resetAt).toBe(now + 165 * 60000);
  });
  it('recognizes only native Claude usage destinations', () => {
    expect(isClaudeUsageUrl('https://claude.ai/new#settings/usage')).toBe(true);
    expect(isClaudeUsageUrl('https://claude.ai/settings/usage')).toBe(true);
    expect(isClaudeUsageUrl('https://claude.ai.evil.example/new#settings/usage')).toBe(false);
    expect(isClaudeUsageUrl('https://claude.ai/chat/usage')).toBe(false);
  });
  it('does not invent a quota from an unavailable row or hidden competing extension', () => {
    const doc = new JSDOM(`<main><div><span>Current session</span><p>Not available on your plan</p></div><div data-extension><span>All models</span><p>0% used</p></div></main>`, { url: 'https://claude.ai/settings/usage' }).window.document;
    expect(readUsageWindows(doc, 'claude', [], now)).toEqual([]);
  });
});
