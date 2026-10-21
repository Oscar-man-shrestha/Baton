import type { ProviderId } from './selectors';
import { isUsagePageUrl, usagePageUrl } from './usage-windows';

type Tab = { id?: number; url?: string; status?: string };
export type RefreshDeps = {
  tabs: () => Promise<Tab[]>;
  /** Opens a background tab and returns its id. */
  open: (url: string) => Promise<number | undefined>;
  close: (tabId: number) => Promise<void>;
  /** Asks the page to read its usage now; false when the page is not ready yet. */
  ask: (tabId: number) => Promise<boolean>;
  /** Time of the newest stored reading for this service, 0 when none. */
  readingAt: (provider: ProviderId) => Promise<number>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};
export type RefreshResult = { provider: ProviderId; status: 'read' | 'no-reading'; opened: boolean };

/** User-pressed refresh: read each service's own usage page, reusing an open one, and close only tabs opened here. */
export async function refreshAllUsage(providers: ProviderId[], deps: RefreshDeps, timeout = 20000, interval = 1500): Promise<RefreshResult[]> {
  const open = await deps.tabs();
  return Promise.all(providers.filter(provider => usagePageUrl(provider)).map(async (provider): Promise<RefreshResult> => {
    const start = deps.now();
    const existing = open.find(tab => tab.id !== undefined && isUsagePageUrl(provider, tab.url));
    const tabId = existing?.id ?? await deps.open(usagePageUrl(provider)!);
    const opened = !existing && tabId !== undefined;
    try {
      if (tabId === undefined) return { provider, status: 'no-reading', opened };
      while (deps.now() - start < timeout) {
        await deps.ask(tabId).catch(() => false);
        if (await deps.readingAt(provider) >= start) return { provider, status: 'read', opened };
        await deps.sleep(interval);
      }
      return { provider, status: 'no-reading', opened };
    } finally {
      if (opened) await deps.close(tabId!).catch(() => {});
    }
  }));
}
