import { z } from 'zod';
import bundled from '../../rankings.json';
import { providerIds, type ProviderId } from './selectors';
import { rescueOptions, type RescueOption } from './rescue';

/** What the prompt is about, guessed on this device from its words. Nothing is sent anywhere. */
export const topics = ['code', 'research', 'news', 'writing', 'math', 'image', 'general'] as const;
export type Topic = typeof topics[number];

export const topicNames: Record<Topic, string> = { code: 'Code', research: 'Research', news: 'Current events', writing: 'Writing', math: 'Maths & reasoning', image: 'Images', general: 'General' };

// Weighted cues per topic. Strong cues (a code block, a stack trace, “generate an image of…”) outweigh words that
// several topics share (“write”, “latest”, “compare”). Measured against tests/fixtures/topic-prompts.json.
type Cue = [pattern: RegExp, weight: number];
const cues: Record<Exclude<Topic, 'general'>, Cue[]> = {
  code: [
    [/```/, 5],
    [/\b\w*(Error|Exception)\b(?=[:\s]|$)/, 3],
    [/\.(js|jsx|ts|tsx|py|java|rb|go|rs|cpp|cs|php|html|css|json|ya?ml|sh|sql)\b/, 3],
    [/\b(def|const|let|var|import|return|async|await|class|function)\s+\w+/, 3],
    [/\bO\([^)]*n[^)]*\)/, 3],
    [/\b(write|generate|create|build)\s+(?:(?:a|an|some|the|me)\s+)*(?:\w+\s+)?(code|script|function|program|class|regex|query|tests?|command|component|api|app|extension|website)\b/i, 3],
    [/\b(make|build|create|code|develop)\s+(?:(?:a|an|my|the)\s+)?(?:\w+\s+)?(bot|app|website|game|extension|plugin|api|login page|signup page|dashboard|backend|server|database)\b/i, 3],
    [/\b(unauthorized|not found|internal server error|bad request|cors)\b|\b[45]\d\d\b[^.\n]{0,20}\b(error|status)\b/i, 2],
    [/\b(python|javascript|typescript|java|kotlin|swift|rust|golang|c\+\+|c#|php|ruby|sql|html|css|tailwind|react|next\.js|vue|svelte|angular|node(\.js)?|npm|vite|django|flask|spring|docker|kubernetes|git|github|bash|shell|regex|api|json|eslint|prettier|vercel|aws|linux|chrome extension|webpack|postgres|mongodb|pip|npm|yarn|terminal|command line|linked list|binary tree|hash ?map|recursion|data structures?|stack overflow|localhost|useState|useEffect|js|ts|py|closures?|promises?|callbacks?|props|segmentation fault|compiler|runtime|null pointer|undefined is not|big o|firebase|supabase|login|signup|auth(entication)?|bot|android|ios|flutter|nosql|backend)\b/i, 2],
    [/\b(code|coding|program(ming)?|script|function|class|method|variable|bug|debug|compile|refactor|deploy|unit tests?|loop|array|algorithm|database|query|endpoint|frontend|backend|component|repo|commit|branch|landing page|website|app|framework|library|div|controller|server|optimi[sz]e|install(ing|ed)?|package|dependenc(y|ies)|merge|branch(es)?|pull request|permission denied|build fails?|crash(es|ing)?)\b/i, 1.5],
    [/=>|\w+\(\)|[{};]\s*$|\b[a-z]+_[a-z_]+\b|\b[a-z]+[A-Z]\w+/m, 1]
  ],
  math: [
    [/\b(solve|equation|derivative|integral|integrate|differentiate|prove|proof|theorem|probability|algebra|geometry|calculus|matrix|eigenvalues?|logarithm|factorial|permutations?|combinations?|percent(age)?|compound interest|area|volume|perimeter|radius|average|mean|median|how many ways|logic puzzle|calculate|compute|standard deviation|variance|simplify|fraction|ratio|discount|original price|tip on)\b/i, 2],
    [/\d+(\.\d+)?\s*%/, 1.5],
    [/\d+\s*(times|plus|minus|divided by|multiplied by)\s*\d+|\b(find|solve for)\s+[a-z]\b|\b\d+[a-z]\s*[-+=]/i, 2],
    [/\b(power of|squared|cubed|square root|cube root|times table)\b|\bhow many \w+ (are )?in an?\b/i, 2],
    [/\bconvert\s+\d+|\b(fahrenheit|celsius|kilometers?|miles|pounds|kilograms?|inches|centimeters?)\b/i, 1.5],
    [/\d+\s*[-+*/^=×÷]\s*\d+|\b[a-z]\^\d|\d+\s*%\s*of\b|\bdx\b|sqrt|√/i, 2],
    [/\b(how (much|many|long|far)|when does)\b[^?]*\d/i, 1.5],
    [/\bkm\/h|\bmph\b/i, 1]
  ],
  image: [
    [/\b(generate|create|make|draw|design|render|paint|sketch)\b[^.?!\n]{0,40}\b(image|picture|photo|logo|icon|wallpaper|illustration|portrait|cartoon|sticker|poster|art|drawing|diagram|banner|avatar|anime|watercolou?r|painting|pixel art|3d render|scene|meme|gif)\b/i, 4],
    [/\b(draw|sketch|illustration|logo|wallpaper|portrait|cartoon|sticker|photo ?realistic|4k|anime style|in the style of|watercolou?r|pixel art|oil painting|poster|banner|avatar|thumbnail)\b/i, 1.5],
    // Asking about a picture you already have is not making one.
    [/\b(this|the|my|attached|uploaded)\s+(image|photo|picture|screenshot)\b/i, -2]
  ],
  research: [
    [/\b(research|sources?|cite|citations?|references?|peer[- ]reviewed|papers?|studies|a study|study (shows|found)|literature( review)?|evidence|scientific|consensus|market size|in[- ]depth|deep dive|statistics|data on|according to)\b/i, 2],
    [/\b(compare[ds]?|comparing|comparison|vs\.?|versus|pros and cons|which is better|best \w+ for|reviews?|analy[sz]e|analysis|causes?|effects? of|impact of|history of|benefits of|backed by|science|origins? of)\b/i, 1.5]
  ],
  news: [
    [/\b(this (week|morning|month)|right now|current(ly)?|latest|recent(ly)?|breaking|news|updates?|trending|live)\b/i, 1.5],
    // Time words alone are weak: “dinner tonight” is not news.
    [/\b(today|tonight|yesterday|tomorrow)\b/i, 1],
    [/\b(stock market|prices?|bitcoin|weather|forecast|score|match|won|leading|standings|results|election|launch(ed)?|released?|announce(d|ment)?|strike|protest|earnings|interest rates|the fed|index|stocks?|shares|nasdaq|sensex|dow jones|happening (now|in)|what is happening|what happened|game|fixture|exchange rate|dollar to|usd to|currency)\b/i, 1.5],
    [/\b(new|current)\s+(prime minister|president|ceo|pm|minister|leader|coach)\b|\bwho is the (prime minister|president|ceo)\b/i, 2],
    [/\b(saying on|posts? on|tweets?)\b.*\b(x|twitter)\b|\bon (x|twitter)\b/i, 2]
  ],
  writing: [
    [/\b(rewrite|re-write|proofread|paraphrase|reword|polish|edit (my|this)|grammar|tone|draft|essay|email|letter|cover letter|story|poem|lyrics|speech|caption|blog( post)?|article|post|bio|resume|cv|product description|slogan|translate|summari[sz]e|bullet points|paragraph|sentence|more professional|note|toast|shorten|condense|expand|message|reply|invitation|introduction|flow|wording|spelling|rephrase|rap|song|application|sound (smarter|better|cool|natural|professional)|(correct|fix|check) my (english|grammar|spelling|writing))\b/i, 2],
    [/\bwrite\b/i, 1],
    [/\bwrite\s+(a|an|me a|my)\b/i, 1]
  ]
};
// On a tie, the more specific topic wins.
const priority: Exclude<Topic, 'general'>[] = ['code', 'image', 'math', 'research', 'news', 'writing'];

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hits = (text: string, pattern: RegExp) => Math.min(4, (text.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)) || []).length);

/** Score per topic; extra keywords from the rankings file (new frameworks, model features) count as strong words. */
export function topicScores(text: string, rankings: Rankings = bundledRankings): Record<Exclude<Topic, 'general'>, number> {
  const sample = text.slice(-4000);
  return Object.fromEntries(priority.map(topic => {
    const extra: Cue[] = (rankings.keywords[topic] || []).map(word => [new RegExp(`\\b${escape(word)}\\b`, 'i'), 2]);
    return [topic, [...cues[topic], ...extra].reduce((sum, [pattern, weight]) => sum + hits(sample, pattern) * weight, 0)];
  })) as Record<Exclude<Topic, 'general'>, number>;
}

/** The best-scoring topic, or “general” when nothing scores at least one clear cue's worth. */
export function promptTopic(text: string, rankings: Rankings = bundledRankings): Topic {
  const scores = topicScores(text, rankings);
  const best = priority.reduce((top, topic) => scores[topic] > scores[top] ? topic : top, priority[0]);
  return scores[best] >= 1.5 ? best : 'general';
}

export type ModelGuess = { label: string; confidence: number };
/**
 * Keywords decide when they are sure (they rarely pick a wrong topic). Otherwise the on-device model decides when it
 * is at least 40% sure, and anything less is “general”. Fixed before measuring; see tests/task-fit.test.ts.
 */
export function combineTopic(cue: Topic, model?: ModelGuess): Topic {
  if (cue !== 'general') return cue;
  if (model && model.confidence >= 0.4 && (topics as readonly string[]).includes(model.label)) return model.label as Topic;
  return 'general';
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
export function suggest(text: string, source: ProviderId, saved: Record<string, unknown>, now = Date.now(), chosen?: Topic, model?: ModelGuess) {
  const { rankings } = activeRankings(saved.rankingsRemote);
  const topic = chosen || combineTopic(promptTopic(text, rankings), model);
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
