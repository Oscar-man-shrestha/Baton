import type { ProviderId } from './selectors';
import { parseClaudeUsage, type UsageWindow } from './usage-windows';

// Usage the AI sites send to the browser but don't show: ChatGPT's per-feature allowances (Thinking, deep research,
// uploads, images…) and Codex/Work windows, Claude's session/weekly meter, Gemini's 5-hour/weekly quota.
// Pure parsers only: the responses come from the page itself (usage tap) or from Baton's own refresh (usage-fetch).

export { GEMINI_QUOTA_RPC, kindProvider, usageKindOf, type UsageKind } from './usage-kind';
import { GEMINI_QUOTA_RPC, type UsageKind } from './usage-kind';

const toMs = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const number = Number(value);
  if (Number.isFinite(number)) return number < 1e12 ? number * 1000 : number;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? undefined : parsed;
};
const finite = (value: unknown) => { const number = Number(value); return value !== null && value !== undefined && value !== '' && Number.isFinite(number) ? number : undefined; };
const reading = (provider: ProviderId, feature: string, now: number, extra: Partial<UsageWindow>): UsageWindow => ({ provider, tier: 'banner', confidence: 'high', key: `${provider}:${feature}`, feature, at: now, source: 'provider-response', explanation: `Reported by ${provider === 'chatgpt' ? 'ChatGPT' : provider === 'claude' ? 'Claude' : 'Gemini'} to this browser`, ...extra });

// ChatGPT names its allowances by id; “reason” is the Thinking allowance.
const chatGptNames: Record<string, string> = { reason: 'Thinking', reasoning: 'Thinking', deep_research: 'Deep research', image_gen: 'Image generation', image_generation: 'Image generation', file_upload: 'File uploads', file_uploads: 'File uploads', paste_to_file: 'Paste to file', odyssey: 'Agent', agent: 'Agent', agent_mode: 'Agent', operator: 'Agent', sora: 'Video', video_gen: 'Video', voice: 'Voice', advanced_voice: 'Voice', canvas: 'Canvas' };
export const chatGptFeatureName = (id: string) => chatGptNames[id.toLowerCase()] ?? (id.replace(/[_-]+/g, ' ').trim().replace(/^./, c => c.toUpperCase()) || 'Limit');

/** /backend-api/conversation/init → limits_progress: [{ feature_name, remaining, max_value?, reset_after }]. */
export function parseChatGptFeatures(payload: unknown, now = Date.now()): UsageWindow[] {
  const list = payload && typeof payload === 'object' && Array.isArray((payload as any).limits_progress) ? (payload as any).limits_progress as any[] : [];
  return list.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const remaining = finite(item.remaining);
    if (remaining === undefined || remaining < 0 || !Number.isSafeInteger(remaining)) return [];
    const max = finite(item.max_value ?? item.limit);
    const resetAt = toMs(item.reset_after ?? item.reset_at ?? item.resets_at);
    const feature = chatGptFeatureName(String(item.feature_name || item.name || ''));
    const percent = max && max >= remaining ? Number((((max - remaining) / max) * 100).toFixed(1)) : remaining === 0 ? 100 : undefined;
    return [reading('chatgpt', feature, now, { remainingCount: remaining, ...(percent !== undefined ? { percent, remainingPercent: 100 - percent } : {}), ...(resetAt && resetAt > now ? { resetAt } : {}) })];
  });
}

/** /backend-api/wham/usage → rate_limit.{primary,secondary}_window: Codex/Work, named like the Usage page reads them. */
export function parseChatGptWham(payload: unknown, now = Date.now()): UsageWindow[] {
  const root = payload && typeof payload === 'object' ? payload as any : {};
  const limit = root.rate_limit ?? root.data?.rate_limit ?? root.usage?.rate_limit;
  if (!limit || typeof limit !== 'object') return [];
  return [limit.primary_window, limit.secondary_window].flatMap(win => {
    if (!win || typeof win !== 'object') return [];
    const used = finite(win.used_percent ?? win.utilization ?? win.percent_used);
    if (used === undefined || used < 0 || used > 100) return [];
    const resetAt = toMs(win.reset_at ?? win.resets_at) ?? (finite(win.reset_after_seconds) !== undefined ? now + finite(win.reset_after_seconds)! * 1000 : undefined);
    const seconds = finite(win.limit_window_seconds ?? win.window_seconds);
    const span = seconds ?? (resetAt ? (resetAt - now) / 1000 : undefined);
    const feature = span === undefined ? 'Work limit' : span <= 6 * 3600 ? 'Work 5-hour' : span <= 8 * 86400 ? 'Work weekly' : 'Codex monthly';
    return [reading('chatgpt', feature, now, { percent: used, remainingPercent: 100 - used, ...(resetAt && resetAt > now ? { resetAt } : {}) })];
  });
}

/** Claude's /api/organizations/{id}/usage: five_hour / seven_day utilization (0–100) with resets_at. */
export function parseClaudeUsageResponse(payload: unknown, now = Date.now()): UsageWindow[] {
  return parseClaudeUsage(payload, now).map(win => ({ ...win, source: 'provider-response' as const, explanation: 'Reported by Claude to this browser' }));
}

/** Google batchexecute: “)]}'” then length-prefixed JSON lines of [["wrb.fr", rpc, "<json>", …]]. */
export function geminiQuotaRows(text: string): unknown[][] {
  const rows: unknown[][] = [];
  for (const line of String(text).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('[')) continue;
    let envelopes: unknown; try { envelopes = JSON.parse(trimmed); } catch { continue; }
    if (!Array.isArray(envelopes)) continue;
    for (const envelope of envelopes) {
      if (!Array.isArray(envelope) || envelope[0] !== 'wrb.fr' || envelope[1] !== GEMINI_QUOTA_RPC || typeof envelope[2] !== 'string') continue;
      let data: unknown; try { data = JSON.parse(envelope[2]); } catch { continue; }
      if (Array.isArray(data) && Array.isArray(data[0])) rows.push(...(data[0] as unknown[]).filter((row): row is unknown[] => Array.isArray(row)));
    }
  }
  return rows;
}

/**
 * Gemini quota rows: [[mode, action, …], unit, percentUsed, [resetEpochSec, nanos], remaining, limit]. Action 2 is the
 * compute meter Gemini's own badge shows, once per window; the nearer reset is the 5-hour one, the further the weekly.
 */
export function parseGeminiQuota(text: string, now = Date.now()): UsageWindow[] {
  const compute = geminiQuotaRows(text).flatMap(row => {
    const context = Array.isArray(row[0]) ? row[0] : [];
    if (finite(context[1]) !== 2) return [];
    const used = finite(row[2]);
    const reset = Array.isArray(row[3]) && typeof row[3][0] === 'number' ? row[3][0] * 1000 + Math.round((Number(row[3][1]) || 0) / 1e6) : undefined;
    if (used === undefined || used < 0 || used > 100) return [];
    return [{ unit: row[1], used, reset }];
  });
  const byUnit = new Map(compute.map(row => [row.unit, row]));
  const list = [...byUnit.values()].sort((a, b) => (a.reset ?? 0) - (b.reset ?? 0));
  const labelled = list.length >= 2 ? [['Session', list[0]], ['Weekly', list[list.length - 1]]] as const
    : list.length === 1 ? [[list[0].reset && list[0].reset - now > 6 * 3600000 ? 'Weekly' : 'Session', list[0]]] as const : [];
  return labelled.map(([feature, row]) => reading('gemini', feature, now, { percent: row.used, remainingPercent: 100 - row.used, ...(row.reset && row.reset > now ? { resetAt: row.reset } : {}) }));
}

/** One parser per kind; bodies are text as the site sent them. */
/**
 * Grok's /rest/rate-limits for one model: { windowSizeSeconds, remainingQueries, totalQueries, waitTimeSeconds? }.
 * Baton asks for each model and keeps the model name with the answer: { model, data }.
 */
export function parseGrokRateLimits(payload: unknown, now = Date.now()): UsageWindow[] {
  const root = payload && typeof payload === 'object' ? payload as any : {};
  const data = root.data ?? root;
  const remaining = finite(data?.remainingQueries), total = finite(data?.totalQueries);
  if (remaining === undefined || total === undefined || total <= 0 || remaining < 0 || remaining > total) return [];
  const model = String(root.model || 'grok').replace(/^grok-?/i, '').replace(/-auto$/i, '');
  const wait = finite(data.waitTimeSeconds);
  const percent = Number((((total - remaining) / total) * 100).toFixed(1));
  return [reading('grok', `Grok ${model || ''}`.trim(), now, { remainingCount: remaining, percent, remainingPercent: 100 - percent, ...(wait && wait > 0 ? { resetAt: now + wait * 1000 } : {}) })];
}

/** Perplexity's /rest/rate-limit/status: free questions and each mode's remaining uses (only what the plan has). */
export function parsePerplexityRateLimit(payload: unknown, now = Date.now()): UsageWindow[] {
  const root = payload && typeof payload === 'object' ? payload as any : {};
  const names: Record<string, string> = { pro_search: 'Pro search', research: 'Research', labs: 'Labs', agentic_research: 'Deep research' };
  const out: UsageWindow[] = [];
  const add = (feature: string, entry: any) => {
    const remaining = finite(entry?.remaining_detail?.remaining ?? entry?.remaining);
    if (remaining === undefined || remaining < 0 || !Number.isSafeInteger(remaining)) return;
    // A mode the plan doesn't include (unavailable with none left) isn't a limit to show.
    if (entry?.available === false && remaining === 0) return;
    out.push(reading('perplexity', feature, now, { remainingCount: remaining, ...(remaining === 0 ? { percent: 100, remainingPercent: 0 } : {}) }));
  };
  if (root.free_queries) add('Free questions', root.free_queries);
  for (const [key, entry] of Object.entries(root.modes || {})) add(names[key] || key.replace(/_/g, ' '), entry);
  // The older shape (/rest/rate-limit/all): remaining_pro, remaining_research, …
  if (!root.modes) for (const [key, label] of [['remaining_pro', 'Pro search'], ['remaining_research', 'Research'], ['remaining_labs', 'Labs']] as const) if (finite(root[key])) add(label, { remaining: root[key], available: root[key] > 0 });
  return out;
}

export function parseUsageResponse(kind: UsageKind, text: string, now = Date.now()): UsageWindow[] {
  if (kind === 'gemini-quota') return parseGeminiQuota(text, now);
  if (kind === 'grok-rate-limits' || kind === 'perplexity-rate-limit') { let json: unknown; try { json = JSON.parse(text); } catch { return []; } return kind === 'grok-rate-limits' ? parseGrokRateLimits(json, now) : parsePerplexityRateLimit(json, now); }
  let json: unknown; try { json = JSON.parse(text); } catch { return []; }
  return kind === 'chatgpt-features' ? parseChatGptFeatures(json, now) : kind === 'chatgpt-wham' ? parseChatGptWham(json, now) : parseClaudeUsageResponse(json, now);
}
