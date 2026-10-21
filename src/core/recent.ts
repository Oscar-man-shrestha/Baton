import { briefSchema, goalFromUserText, type Brief } from './brief';

export type RecentCapture = { url: string; title: string; savedAt: number; brief: Brief; variants: string[] };

/** A chat is identified by site and path. Grok adds “?rid=…” after every reply, which made one chat look like many. */
export function chatUrl(value: string): string {
  try { const url = new URL(value); return url.origin + url.pathname; } catch { return value; }
}

export function recentCapturesFromStorage(saved: Record<string, unknown>, limit = 12): RecentCapture[] {
  const captures: RecentCapture[] = [];
  for (const [key, value] of Object.entries(saved)) {
    if (!key.startsWith('savedAt:brief:') || typeof value !== 'number' || !Number.isFinite(value)) continue;
    const briefKey = key.slice('savedAt:'.length);
    const parsed = briefSchema.safeParse(saved[briefKey]);
    if (!parsed.success || !parsed.data.goal.trim()) continue;
    const url = briefKey.slice('brief:'.length);
    let host: string;
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { continue; }
    // Older captures saved a pasted Handoff wrapper as the goal; clean the title without rewriting the saved brief.
    const title = goalFromUserText(parsed.data.goal).replace(/\s+/g, ' ').trim().slice(0, 72) || 'Continued handoff';
    captures.push({ url, title: `${title} · ${host}`, savedAt: value, brief: parsed.data, variants: [url] });
  }
  // Keep the newest copy of each chat; remember the other addresses so deleting removes them all.
  const newest = new Map<string, RecentCapture>();
  for (const capture of captures.sort((a, b) => b.savedAt - a.savedAt)) {
    const same = newest.get(chatUrl(capture.url));
    if (same) same.variants.push(capture.url); else newest.set(chatUrl(capture.url), capture);
  }
  return [...newest.values()].slice(0, limit);
}

export async function listRecentCaptures(limit = 12): Promise<RecentCapture[]> {
  return recentCapturesFromStorage(await chrome.storage.local.get(null), limit);
}
