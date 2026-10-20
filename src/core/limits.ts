import { encode } from 'gpt-tokenizer';
import type { ProviderId } from './selectors';

export type Meter = { provider: ProviderId; tier: 'banner' | 'history' | 'unknown'; confidence: 'high' | 'medium' | 'low'; percent?: number; resetAt?: number; feature: string; explanation: string; estimatedReplyCost?: number };
export type LimitEvent = { at: number; approximateTokens: number };

export function parseReset(text: string, now = Date.now()): number | undefined {
  const relative = text.match(/(?:in|after)\s+(\d+)\s*(minute|hour)s?/i);
  if (relative) return now + Number(relative[1]) * (relative[2].toLowerCase().startsWith('hour') ? 3600000 : 60000);
  const clock = text.match(/(?:reset|try again|refresh)(?:s|es)?\s+(?:at|by)\s+(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!clock) return undefined;
  const date = new Date(now);
  let hour = Number(clock[1]);
  if (clock[3]) hour = hour % 12 + (clock[3].toLowerCase() === 'pm' ? 12 : 0);
  date.setHours(hour, Number(clock[2]), 0, 0);
  if (date.getTime() <= now) date.setDate(date.getDate() + 1);
  return date.getTime();
}

export function estimateMeter(provider: ProviderId, visibleBanner: string, turns: string[], history: LimitEvent[] = [], now = Date.now()): Meter {
  const resetAt = parseReset(visibleBanner, now);
  const knownLimit = /(?:you.ve reached|usage limit|quota exceeded|try again|limit reached)/i.test(visibleBanner);
  const nearLimit = /(?:approaching|almost|close to).{0,30}(?:limit|quota)/i.test(visibleBanner);
  const feature = provider === 'chatgpt' ? 'feature quota (text chat is generally unlimited)' : 'chat usage';
  if (knownLimit || nearLimit) return { provider, tier: 'banner', confidence: 'high', percent: knownLimit ? 100 : undefined, resetAt, feature, explanation: knownLimit ? 'Visible provider limit notice' : 'Visible provider near-limit notice' };
  const windowHours = provider === 'claude' || provider === 'gemini' ? 5 : undefined;
  const recent = history.filter(e => !windowHours || now - e.at < windowHours * 3600000);
  if (provider !== 'chatgpt' && recent.length >= 2) {
    const typical = recent.reduce((sum, e) => sum + e.approximateTokens, 0) / recent.length;
    const spent = turns.reduce((sum, t) => sum + encode(t).length, 0);
    const percent = Math.max(0, Math.min(99, Math.round(spent / Math.max(typical, 1) * 100)));
    return { provider, tier: 'history', confidence: 'low', percent, feature, explanation: 'Calibrated from local limit events; provider allowance may change', estimatedReplyCost: Math.round((encode(turns.at(-1) || '').length + spent * 0.2) / Math.max(typical, 1) * 100) };
  }
  return { provider, tier: 'unknown', confidence: 'low', feature, explanation: 'No visible quota signal or enough local history' };
}

export function shouldNudge(meter: Meter): boolean { return meter.percent !== undefined && meter.percent >= 70 && meter.percent < 100; }
