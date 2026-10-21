import { encode } from 'gpt-tokenizer';
import type { ProviderId } from './selectors';

export type Meter = { provider: ProviderId; tier: 'banner' | 'history' | 'unknown'; confidence: 'high' | 'medium' | 'low'; percent?: number; remainingPercent?: number; remainingTokens?: number; resetAt?: number; feature: string; explanation: string; estimatedReplyCost?: number; nearLimit?: boolean; at?: number };
export type LimitEvent = { at: number; approximateTokens: number };

export function parseReset(text: string, now = Date.now()): number | undefined {
  const relative = text.match(/(?:in|after)\s+((?:\d+\s*(?:days?|hours?|minutes?|d|h|m)(?=\s|\d|[.,;:]|$)\s*)+)/i);
  if (relative) {
    let duration = 0;
    for (const match of relative[1].matchAll(/(\d+)\s*(days?|hours?|minutes?|d|h|m)(?=\s|\d|[.,;:]|$)/gi)) duration += Number(match[1]) * (/^d/i.test(match[2]) ? 86400000 : /^h/i.test(match[2]) ? 3600000 : 60000);
    if (duration) return now + duration;
  }
  const dated = calendarReset(text, now);
  if (dated !== null) return dated;
  const clock = text.match(/(?:reset|try again|refresh)(?:s|es)?\s+(?:at|by)\s+(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!clock) return undefined;
  const date = new Date(now);
  let hour = Number(clock[1]);
  if (clock[3]) hour = hour % 12 + (clock[3].toLowerCase() === 'pm' ? 12 : 0);
  if (hour > 23 || Number(clock[2]) > 59 || (clock[3] && (Number(clock[1]) < 1 || Number(clock[1]) > 12))) return undefined;
  date.setHours(hour, Number(clock[2]), 0, 0);
  if (date.getTime() <= now) date.setDate(date.getDate() + 1);
  return date.getTime();
}

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
function clockHour(hour: number, minute: number, meridiem?: string): number | undefined {
  if (minute > 59 || (meridiem ? hour < 1 || hour > 12 : hour > 23)) return undefined;
  return meridiem ? hour % 12 + (meridiem.toLowerCase() === 'pm' ? 12 : 0) : hour;
}
/** “Resets on 28 Oct at 14:40”, “Resets Oct 28 at 2:40 PM” (Gemini) and “Resets Sun 12:30 AM” (Claude), in local time. null: no such phrase. */
function calendarReset(text: string, now: number): number | undefined | null {
  const day = text.match(/resets?\s+(?:on\s+)?(?:(\d{1,2})\s+([a-z]{3,9})\.?|([a-z]{3,9})\.?\s+(\d{1,2}))(?:,?\s+(\d{4}))?,?\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  const month = day ? months.indexOf((day[2] || day[3]).slice(0, 3).toLowerCase()) : -1;
  if (day && month >= 0) {
    const hour = clockHour(Number(day[6]), Number(day[7]), day[8]);
    if (hour === undefined) return undefined;
    const date = Number(day[1] || day[4]);
    const year = Number(day[5]) || new Date(now).getFullYear();
    let at = new Date(year, month, date, hour, Number(day[7]));
    if (at.getMonth() !== month) return undefined;
    if (!day[5] && at.getTime() <= now) at = new Date(year + 1, month, date, hour, Number(day[7]));
    return at.getTime();
  }
  const weekday = text.match(/resets?\s+(?:on\s+)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?,?\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!weekday) return null;
  const hour = clockHour(Number(weekday[2]), Number(weekday[3]), weekday[4]);
  if (hour === undefined) return undefined;
  const at = new Date(now);
  at.setHours(hour, Number(weekday[3]), 0, 0);
  at.setDate(at.getDate() + (weekdays.indexOf(weekday[1].toLowerCase()) - at.getDay() + 7) % 7);
  if (at.getTime() <= now) at.setDate(at.getDate() + 7);
  return at.getTime();
}

export function estimateMeter(provider: ProviderId, visibleBanner: string, turns: string[], history: LimitEvent[] = [], now = Date.now()): Meter {
  const resetAt = parseReset(visibleBanner, now);
  const knownLimit = /(?:you.ve reached (?:your |the )?(?:usage |message |free )?limit|reached (?:your |the )?(?:usage |message |free )?limit|limit reached|quota exceeded)/i.test(visibleBanner);
  const nearLimit = /(?:approaching|almost|close to).{0,30}(?:limit|quota)/i.test(visibleBanner);
  const feature = provider === 'chatgpt' ? 'visible model or feature limit' : 'chat usage';
  const remaining = visibleBanner.match(/(?:(?<![-\d.])(\d{1,3}(?:\.\d+)?)\s*%\s*(?:of (?:your )?(?:free |message |usage |chat )?(?:quota |allowance )?)?(?:remaining|left)|(?:remaining|left)\s*:?[ ]*(?<![-\d.])(\d{1,3}(?:\.\d+)?)\s*%)/i);
  const remainingPercent = remaining && /\b(free|message|usage|quota|chat)\b/i.test(visibleBanner) ? (Number(remaining[1] || remaining[2]) <= 100 ? Number(remaining[1] || remaining[2]) : undefined) : undefined;
  const used = visibleBanner.match(/\b(?:usage|quota|session|weekly|message)\b.{0,35}?\b(?<![-\d.])(\d{1,3}(?:\.\d+)?)\s*%\s*(?:used|consumed)/i);
  const usedPercent = used && Number(used[1]) <= 100 ? Number(used[1]) : undefined;
  const tokenMatch = /\b(?:free(?:[ -]tier)?|usage|quota)\b.{0,70}(?<![-\d.,])(\d[\d,]*)\s+tokens?\s+(?:remaining|left)\b/i.exec(visibleBanner);
  const tokenValue = tokenMatch ? Number(tokenMatch[1].replaceAll(',', '')) : undefined;
  const remainingTokens = tokenValue !== undefined && Number.isSafeInteger(tokenValue) && tokenValue >= 0 ? tokenValue : undefined;
  if (knownLimit || nearLimit || remainingPercent !== undefined || usedPercent !== undefined || remainingTokens !== undefined) return { provider, tier: 'banner', confidence: 'high', percent: knownLimit ? 100 : remainingPercent !== undefined ? 100 - remainingPercent : usedPercent, remainingPercent: remainingPercent ?? (usedPercent === undefined ? undefined : 100 - usedPercent), remainingTokens, resetAt, feature, nearLimit: nearLimit && !knownLimit, explanation: knownLimit ? 'Visible provider limit notice' : remainingPercent !== undefined || usedPercent !== undefined || remainingTokens !== undefined ? 'Visible provider balance' : 'Visible provider near-limit notice' };
  const recent = history.filter(e => e.at <= now && e.approximateTokens > 0).slice(-12);
  if (provider !== 'chatgpt' && recent.length >= 2) {
    const typical = recent.reduce((sum, e) => sum + e.approximateTokens, 0) / recent.length;
    const spent = turns.reduce((sum, t) => sum + encode(t).length, 0);
    const percent = Math.max(0, Math.min(99, Math.round(spent / Math.max(typical, 1) * 100)));
    return { provider, tier: 'history', confidence: 'low', percent, feature, explanation: 'Current chat compared with local chats that showed a limit notice; this is not the provider allowance', estimatedReplyCost: Math.round((encode(turns.at(-1) || '').length + spent * 0.2) / Math.max(typical, 1) * 100) };
  }
  return { provider, tier: 'unknown', confidence: 'low', feature, explanation: 'No visible quota signal or enough local history' };
}

export function shouldNudge(meter: Meter): boolean { return meter.percent !== undefined && meter.percent >= 70 && meter.percent < 100; }
