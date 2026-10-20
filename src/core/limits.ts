import { encode } from 'gpt-tokenizer';
import type { ProviderId } from './selectors';

export type Meter = { provider: ProviderId; tier: 'banner' | 'history' | 'unknown'; confidence: 'high' | 'medium' | 'low'; percent?: number; remainingPercent?: number; remainingTokens?: number; resetAt?: number; feature: string; explanation: string; estimatedReplyCost?: number };
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
  const knownLimit = /(?:you.ve reached (?:your |the )?(?:usage |message |free )?limit|reached (?:your |the )?(?:usage |message |free )?limit|limit reached|quota exceeded|try again (?:in|after))/i.test(visibleBanner);
  const nearLimit = /(?:approaching|almost|close to).{0,30}(?:limit|quota)/i.test(visibleBanner);
  const feature = provider === 'chatgpt' ? 'feature quota (text chat is generally unlimited)' : 'chat usage';
  const remaining = visibleBanner.match(/(?:(\d{1,3})\s*%\s*(?:of (?:your )?(?:free |message |usage |chat )?(?:quota |allowance )?)?(?:remaining|left)|(?:remaining|left)\s*:?[ ]*(\d{1,3})\s*%)/i);
  const remainingPercent = remaining && /\b(free|message|usage|quota|chat)\b/i.test(visibleBanner) ? Math.min(100, Number(remaining[1] || remaining[2])) : undefined;
  const tokenMatch = /\b(?:free(?:[ -]tier)?|usage|quota)\b.{0,70}\b(\d[\d,]*)\s+tokens?\s+(?:remaining|left)\b/i.exec(visibleBanner);
  const remainingTokens = tokenMatch ? Number(tokenMatch[1].replaceAll(',', '')) : undefined;
  if (knownLimit || nearLimit || remainingPercent !== undefined || remainingTokens !== undefined) return { provider, tier: 'banner', confidence: 'high', percent: knownLimit ? 100 : remainingPercent !== undefined ? 100 - remainingPercent : undefined, remainingPercent, remainingTokens, resetAt, feature, explanation: knownLimit ? 'Visible provider limit notice' : remainingPercent !== undefined || remainingTokens !== undefined ? 'Visible provider balance' : 'Visible provider near-limit notice' };
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
