import { describe, expect, it } from 'vitest';
import { refreshAllUsage, type RefreshDeps } from '../src/core/usage-refresh';
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
    const results = await refreshAllUsage(['claude', 'gemini', 'chatgpt'], deps);
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
