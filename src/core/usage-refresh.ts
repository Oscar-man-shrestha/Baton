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
/** After a send: refresh at most every 5 minutes per service, and not when a reading is under 2 minutes old. */
export function refreshAfterSendDue(lastRun: number | undefined, newestReading: number, now = Date.now()): boolean {
  return !(lastRun && now - lastRun < 5 * 60000) && !(newestReading && now - newestReading < 2 * 60000);
}
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

export type UsageCheck = { at: number; route: string; steps: string[]; readings: number; retryAt?: number };
const clockTime = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export type CheckStatus = { tone: 'ok' | 'stale' | 'idle' | 'off'; headline: string; detail: string };
/** The status box under a usage card: whether Baton's last check with your sign-in found new figures, in plain words. */
export function usageCheckSummary(name: string, check: UsageCheck | undefined, options: { off?: boolean; lastReading?: number; now?: number; time?: (at: number) => string } = {}): CheckStatus {
  const time = options.time || clockTime;
  if (options.off) return { tone: 'off', headline: 'Sign-in check is off', detail: 'Turn it on under Usage → Read usage with my sign-in.' };
  if (!check) return { tone: 'idle', headline: 'Not checked yet', detail: `Baton checks when you open a ${name} chat.` };
  const next = check.retryAt && check.retryAt > (options.now ?? Date.now()) ? ` · next check ${time(check.retryAt)}` : '';
  if (check.readings) return { tone: 'ok', headline: 'Up to date', detail: `Checked ${time(check.at)}` };
  return { tone: 'stale', headline: options.lastReading ? `No new figures since ${time(options.lastReading)}` : `${name} shared no figures`, detail: `Checked ${time(check.at)}${next}` };
}

export type CheckField = { name: string; filled: boolean };
export type CheckDetails = { requests: { name: string; ok: boolean; status: string; tab?: boolean }[]; fields: CheckField[]; notes: string[] };
/**
 * What a usage check recorded (“usage 200”, “claude-usage fields: five_hour=null, …”), sorted into requests, fields and
 * notes. “tab: …” steps are what the open tab tried before Baton asked from the background; a note said twice shows once.
 */
export function readCheckSteps(steps: string[]): CheckDetails {
  const details: CheckDetails = { requests: [], fields: [], notes: [] };
  for (const raw of steps) {
    const tab = raw.startsWith('tab: ');
    const step = tab ? raw.slice(5) : raw;
    const request = step.match(/^(\S+) (\d{3}|failed)$/);
    const fields = step.match(/^\S+ fields: (.*)$/);
    if (request) details.requests.push({ name: request[1], status: request[2], ok: /^2\d\d$/.test(request[2]), ...(tab ? { tab } : {}) });
    else if (fields) { const parsed = readFields(fields[1]); if (parsed.length) details.fields.push(...parsed); else details.notes.push(fields[1]); }
    else if (!details.notes.includes(step)) details.notes.push(step);
  }
  return details;
}
/** “five_hour=null, limits(a,b), plan” → each field and whether it held anything. Empty for “not JSON” and the like. */
export function readFields(text: string): CheckField[] {
  if (/^(?:not JSON|empty|string|number|boolean)$/.test(text.trim())) return [];
  return text.split(/,\s+/).map(part => part.trim()).filter(Boolean).map(part => ({ name: part.replace(/=null$|\(.*$/, ''), filled: !/=null$/.test(part) }));
}
