import { z } from 'zod';
import bundled from '../../rankings.json';
import { providerIds, type ProviderId } from './selectors';
import { rescueOptions, type RescueOption } from './rescue';

/** What the prompt is about, guessed on this device from its words. Nothing is sent anywhere. */
export const topics = ['code', 'research', 'news', 'writing', 'math', 'image', 'general'] as const;
export type Topic = typeof topics[number];

export const topicNames: Record<Topic, string> = { code: 'Code', research: 'Research', news: 'Current events', writing: 'Writing', math: 'Maths & reasoning', image: 'Images', general: 'General' };

const signals: Record<Exclude<Topic, 'general'>, RegExp[]> = {
  code: [/```/, /\b(code|coding|bug|debug|error|stack ?trace|exception|function|class|method|compile|refactor|typescript|javascript|python|java|rust|golang|c\+\+|sql|regex|api|endpoint|react|vue|node|npm|git|docker|kubernetes|deploy|script|unit test|lint)\b/i, /\b(const|let|def|import|return)\s+\w/, /[{};]\s*$/m, /\w+\(\)/],
  research: [/\b(research|sources?|cite|citations?|references?|papers?|stud(y|ies)|literature|evidence|compare|comparison|pros and cons|review of|in[- ]depth|deep dive|analy[sz]e|survey|statistics|data on)\b/i],
  news: [/\b(latest|today|this week|yesterday|news|current(ly)?|recent(ly)?|right now|price of|stock|weather|score|election|released?|launch(ed)?|trending|20(2[5-9]|3\d))\b/i],
  writing: [/\b(write|rewrite|draft|essay|email|letter|cover letter|blog|article|story|poem|tone|proofread|edit my|summari[sz]e|paraphrase|caption|script for|speech|resume|cv)\b/i],
  math: [/\b(math|maths|calculate|equation|solve|proof|prove|integral|derivative|probability|algebra|geometry|logic puzzle|optimi[sz]e)\b/i, /\d+\s*[-+*/^=]\s*\d+/],
  image: [/\b(image|picture|photo|draw|drawing|illustration|logo|icon|render|generate an? (image|picture)|wallpaper|art of|sketch)\b/i]
};

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const count = (text: string, pattern: RegExp) => (text.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)) || []).length;

/** Extra keywords from the rankings file (new frameworks, model features) add to the built-in signals. */
export function promptTopic(text: string, rankings: Rankings = bundledRankings): Topic {
  const sample = text.slice(-4000);
  let best: Topic = 'general'; let bestScore = 0;
  for (const topic of topics) {
    if (topic === 'general') continue;
    const extra = (rankings.keywords[topic] || []).map(word => new RegExp(`\\b${escape(word)}\\b`, 'i'));
    const score = [...signals[topic], ...extra].reduce((sum, pattern) => sum + count(sample, pattern), 0);
    if (score > bestScore) { best = topic; bestScore = score; }
  }
  return best;
}

// The rankings file: the copy bundled with this version, replaced by a newer one from GitHub when available.
const providerList = z.array(z.string().max(32)).max(24);
export const rankingsSchema = z.object({
  version: z.number().int().min(1),
  updated: z.string().max(32),
  bestFor: z.record(z.string(), providerList),
  reasons: z.record(z.string(), z.record(z.string(), z.string().max(60))).default({}),
  keywords: z.record(z.string(), z.array(z.string().min(2).max(40)).max(80)).default({})
});
export type Rankings = { version: number; updated: string; bestFor: Record<Topic, ProviderId[]>; reasons: Partial<Record<Topic, Partial<Record<ProviderId, string>>>>; keywords: Partial<Record<Topic, string[]>> };

const known = (ids: string[]) => ids.filter((id): id is ProviderId => (providerIds as readonly string[]).includes(id));
/** Every supported service exactly once: the listed order first, then any missing ones in the fallback order. */
const complete = (ids: string[], fallback: ProviderId[]) => { const listed = [...new Set(known(ids))]; return [...listed, ...fallback.filter(id => !listed.includes(id))]; };

/** Validates a rankings file. Services this version doesn't support are ignored; missing topics and services fall back. */
export function parseRankings(input: unknown, fallback?: Rankings): Rankings | undefined {
  const parsed = rankingsSchema.safeParse(input);
  if (!parsed.success) return;
  const data = parsed.data;
  const base = fallback?.bestFor;
  const bestFor = Object.fromEntries(topics.map(topic => [topic, complete(data.bestFor[topic] || base?.[topic] || [], base?.[topic] || [...providerIds])])) as Record<Topic, ProviderId[]>;
  const pick = <T>(record: Record<string, T>) => Object.fromEntries(topics.filter(topic => record[topic]).map(topic => [topic, record[topic]]));
  const reasons = Object.fromEntries(Object.entries(pick(data.reasons)).map(([topic, byProvider]) => [topic, Object.fromEntries(Object.entries(byProvider).filter(([id]) => known([id]).length))]));
  return { version: data.version, updated: data.updated, bestFor, reasons, keywords: pick(data.keywords) };
}
export const bundledRankings = parseRankings(bundled)!;

export const RANKINGS_URL = 'https://raw.githubusercontent.com/Oscar-man-shrestha/handoff/main/rankings.json';
export type SavedRankings = { data: unknown; fetchedAt: number };
/** The online list when it is valid and not older than the bundled one; otherwise the bundled list. */
export function activeRankings(saved: unknown): { rankings: Rankings; online: boolean; fetchedAt?: number } {
  const stored = saved as SavedRankings | undefined;
  const online = stored?.data ? parseRankings(stored.data, bundledRankings) : undefined;
  return online && online.version >= bundledRankings.version ? { rankings: online, online: true, fetchedAt: stored!.fetchedAt } : { rankings: bundledRankings, online: false };
}

/** Choices the user made per topic: +1 for each pass or 👍, −1 for 👎. Kept small and on this device. */
export type TaskPicks = Partial<Record<Topic, Partial<Record<ProviderId, number>>>>;
export function addPick(picks: TaskPicks | undefined, topic: Topic, provider: ProviderId, delta = 1): TaskPicks {
  const next: TaskPicks = { ...(picks || {}) };
  const row = { ...(next[topic] || {}) };
  row[provider] = Math.max(-10, Math.min(10, (row[provider] || 0) + delta));
  next[topic] = row;
  return next;
}

export type UserOrder = Partial<Record<Topic, ProviderId[]>>;
/**
 * The order for a topic: the user's own order when they set one in Settings; otherwise the rankings list,
 * nudged by their picks (each pick moves a service about ¾ of a place, at most 3 places).
 */
export function topicOrder(topic: Topic, rankings: Rankings = bundledRankings, userOrder?: UserOrder, picks?: TaskPicks): ProviderId[] {
  const base = rankings.bestFor[topic];
  const own = userOrder?.[topic];
  if (own?.length) return complete(own, base);
  const score = (id: ProviderId) => base.indexOf(id) - Math.max(-3, Math.min(3, (picks?.[topic]?.[id] || 0) * 0.75));
  return [...base].sort((a, b) => score(a) - score(b));
}

/**
 * Rank by fit for the task, but usage still matters: limited services stay last, and one nearly out
 * (under 15% left) drops below services with room.
 */
export function rankForTopic(options: RescueOption[], order: ProviderId[]): RescueOption[] {
  const tier = (option: RescueOption) => option.status === 'limited' ? 2 : option.status === 'room' && (option.remainingPercent ?? 100) < 15 ? 1 : 0;
  return [...options].sort((a, b) => tier(a) - tier(b) || order.indexOf(a.provider) - order.indexOf(b.provider) || (a.resetAt ?? Infinity) - (b.resetAt ?? Infinity));
}

/** Storage keys a suggestion needs: usage for every service, enabled services, and the rankings, order and picks. */
export const suggestionKeys = () => [...providerIds.flatMap(p => [`usageWindows:${p}`, `meter:${p}`, `usageSends:${p}`, `limitHits:${p}`, `statedLimit:${p}`]), 'enabledProviders', 'rankingsRemote', 'rankingsUser', 'taskPicks'];

/** One call for the Baton menu and the popup: topic, ranked options, and a short reason per service. */
export function suggest(text: string, source: ProviderId, saved: Record<string, unknown>, now = Date.now()) {
  const { rankings } = activeRankings(saved.rankingsRemote);
  const topic = promptTopic(text, rankings);
  const order = topicOrder(topic, rankings, saved.rankingsUser as UserOrder | undefined, saved.taskPicks as TaskPicks | undefined);
  const options = rankForTopic(rescueOptions(source, saved, (saved.enabledProviders || {}) as Record<string, boolean>, now), order);
  return { topic, options, reason: (provider: ProviderId) => rankings.reasons[topic]?.[provider] };
}

/**
 * Downloads the public rankings file (a plain GET with no cookies and nothing about the user) and returns it to
 * store, or undefined when it is missing, too large, invalid or older than the bundled list.
 */
export async function fetchRankings(fetcher: typeof fetch = fetch, now = Date.now()): Promise<SavedRankings | undefined> {
  const response = await fetcher(RANKINGS_URL, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(10000) });
  if (!response.ok) return;
  const text = await response.text();
  if (text.length > 50000) return;
  const data = JSON.parse(text) as unknown;
  const parsed = parseRankings(data, bundledRankings);
  return parsed && parsed.version >= bundledRankings.version ? { data, fetchedAt: now } : undefined;
}
