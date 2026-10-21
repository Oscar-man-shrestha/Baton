import { briefSchema, type Brief } from './brief';

export type RecentCapture = { url: string; title: string; savedAt: number; brief: Brief };

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
    const title = parsed.data.goal.replace(/\s+/g, ' ').trim().slice(0, 72);
    captures.push({ url, title: `${title} · ${host}`, savedAt: value, brief: parsed.data });
  }
  return captures.sort((a, b) => b.savedAt - a.savedAt).slice(0, limit);
}

export async function listRecentCaptures(limit = 12): Promise<RecentCapture[]> {
  return recentCapturesFromStorage(await chrome.storage.local.get(null), limit);
}
