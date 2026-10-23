import { describe, expect, it } from 'vitest';
import { refreshAfterSendDue, refreshAllUsage, usageCheckSummary, type RefreshDeps } from '../src/core/usage-refresh';
import type { ProviderId } from '../src/core/selectors';

function fakeBrowser(tabs: { id: number; url: string }[], readsAfter: Partial<Record<ProviderId, number>>) {
  let clock = 1000;
  const log: string[] = [];
  const asked = new Map<number, number>();
  const tabProvider = new Map<number, ProviderId>(tabs.map(tab => [tab.id, tab.url.includes('claude') ? 'claude' : 'gemini']));
  let nextId = 100;
  const deps: RefreshDeps = {
    tabs: async () => tabs,
    open: async url => { const id = nextId++; tabProvider.set(id, url.includes('claude') ? 'claude' : 'gemini'); log.push(`open ${url}`); return id; },
    close: async id => { log.push(`close ${id}`); },
    ask: async id => { asked.set(id, (asked.get(id) || 0) + 1); return true; },
    readingAt: async provider => {
      const id = [...tabProvider].find(([, p]) => p === provider)?.[0];
      const after = readsAfter[provider];
      return after !== undefined && id !== undefined && (asked.get(id) || 0) >= after ? clock : 0;
    },
    sleep: async ms => { clock += ms; },
    now: () => clock
  };
  return { deps, log };
}

describe('refresh all usage', () => {
  it('opens missing usage pages in the background, reads them and closes only those tabs', async () => {
    const { deps, log } = fakeBrowser([{ id: 7, url: 'https://claude.ai/settings/usage' }], { claude: 1, gemini: 2 });
    const results = await refreshAllUsage(['claude', 'gemini', 'grok'], deps);
    expect(results).toEqual([{ provider: 'claude', status: 'read', opened: false }, { provider: 'gemini', status: 'read', opened: true }]);
    expect(log).toEqual(['open https://gemini.google.com/usage', 'close 100']);
  });
  it('gives up after the timeout, says so, and still closes its tab', async () => {
    const { deps, log } = fakeBrowser([], {});
    expect(await refreshAllUsage(['gemini'], deps, 6000)).toEqual([{ provider: 'gemini', status: 'no-reading', opened: true }]);
    expect(log).toEqual(['open https://gemini.google.com/usage', 'close 100']);
  });
  it('skips services without a usage page', async () => {
    const { deps, log } = fakeBrowser([], {});
    expect(await refreshAllUsage(['deepseek', 'grok'], deps)).toEqual([]);
    expect(log).toEqual([]);
  });
});

describe('refresh after a send', () => {
  const now = 10 * 3600000;
  it('runs at most every 5 minutes per service and skips fresh readings', () => {
    expect(refreshAfterSendDue(undefined, 0, now)).toBe(true);
    expect(refreshAfterSendDue(now - 4 * 60000, 0, now)).toBe(false);
    expect(refreshAfterSendDue(now - 6 * 60000, now - 10 * 60000, now)).toBe(true);
    expect(refreshAfterSendDue(undefined, now - 60000, now)).toBe(false);
  });
});

describe('usage check line', () => {
  const time = (at: number) => `T${at}`;
  it('says in plain words whether the last check found new figures', () => {
    const empty = { at: 100, route: 'tab', steps: ['usage 200', 'five_hour=null'], readings: 0 };
    expect(usageCheckSummary('Claude', empty, { lastReading: 50, time, now: 100 })).toBe('Checked at T100: Claude didn’t share new figures, so these are from T50.');
    expect(usageCheckSummary('Claude', { ...empty, retryAt: 300 }, { time, now: 100 })).toBe('Checked at T100: Claude didn’t share new figures. Baton tries again at T300.');
    expect(usageCheckSummary('Gemini', { ...empty, readings: 2 }, { time })).toBe('Checked at T100: new figures from Gemini.');
    expect(usageCheckSummary('ChatGPT', undefined, { time })).toBe('Baton checks ChatGPT for new figures when you open a chat there.');
    expect(usageCheckSummary('Claude', empty, { off: true, time })).toMatch(/^Baton isn’t checking Claude usage/);
    // The technical detail (field names, status codes) never reaches the plain line.
    expect(usageCheckSummary('Claude', empty, { lastReading: 50, time })).not.toMatch(/null|200|five_hour/);
  });
});
