import type { ProviderId } from './selectors';
import type { StatedLimit } from './limits';

const names: Record<ProviderId, string> = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', deepseek: 'DeepSeek', grok: 'Grok', perplexity: 'Perplexity' };

/**
 * Rolling windows used for counting. Claude, Gemini and ChatGPT use 5-hour sessions. Grok's free limit is reported
 * per 2 hours; DeepSeek and Perplexity publish nothing, so they count per day.
 */
export const countWindowHours: Record<ProviderId, number> = { chatgpt: 5, claude: 5, gemini: 5, deepseek: 24, grok: 2, perplexity: 24 };
export type LimitHit = { at: number; count: number };

const inWindow = (sends: number[], provider: ProviderId, at: number, hours = countWindowHours[provider]) => sends.filter(time => time <= at && at - time < hours * 3600000).length;
const span = (hours: number) => hours < 1 ? `${Math.round(hours * 60)} min` : `${Number(hours.toFixed(1))} h`;

/** Notes how many messages were sent in the window when the service showed its limit (at most once per hour). */
export function recordLimitHit(hits: LimitHit[], sends: number[], provider: ProviderId, at: number, stated?: StatedLimit): LimitHit[] {
  if (hits.some(hit => at - hit.at < 3600000)) return hits;
  return [...hits, { at, count: inWindow(sends, provider, at, stated?.hours) }].slice(-10);
}

export type MessageSummary = { count: number; hours: number; learnedLimit?: number; left?: number; text: string };
/**
 * “4 of 20 msgs in last 2 h · ≈16 left (limit stated by Grok)” when the service stated its limit, else
 * “12 msgs in last 2 h · limit hit after ~20 last time · ≈8 left (learned)”; without either, only the count.
 */
export function messageSummary(provider: ProviderId, sends: number[], hits: LimitHit[], now = Date.now(), stated?: StatedLimit): MessageSummary {
  const hours = stated?.hours ?? countWindowHours[provider];
  const count = inWindow(sends, provider, now, hours);
  if (stated) {
    const left = Math.max(0, stated.count - count);
    return { count, hours, learnedLimit: stated.count, left, text: `${count} of ${stated.count} msgs in last ${span(hours)} · ≈${left} left (limit stated by ${names[provider]})` };
  }
  const seen = hits.filter(hit => hit.count > 0).slice(-3).map(hit => hit.count).sort((a, b) => a - b);
  const learnedLimit = seen.length ? seen[Math.floor(seen.length / 2)] : undefined;
  const left = learnedLimit !== undefined ? Math.max(0, learnedLimit - count) : undefined;
  const base = `${count} msg${count === 1 ? '' : 's'} in last ${span(hours)}`;
  const text = learnedLimit !== undefined ? `${base} · limit hit after ~${learnedLimit} last time · ≈${left} left (learned)` : base;
  return { count, hours, ...(learnedLimit !== undefined ? { learnedLimit, left } : {}), text };
}
