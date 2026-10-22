import type { ProviderId } from './selectors';
import type { StatedLimit } from './limits';
import { displayWindows, estimable, type UsageHistory } from './usage-estimate';
import { messageSummary, type LimitHit } from './message-counts';
import { resetCountdown, type UsageWindow } from './usage-windows';

/** One “lane” per service on the dashboard: how much is left, from the best source available. */
export type Lane = { provider: ProviderId; left?: number; value: string; detail: string; source: 'service' | 'estimate' | 'counted' | 'none' };

export function laneFor(saved: Record<string, unknown>, provider: ProviderId, now = Date.now()): Lane {
  const shown = displayWindows((saved[`usageWindows:${provider}`] || []) as UsageWindow[], (saved[`usageHistory:${provider}`] || {}) as UsageHistory, (saved[`usageSends:${provider}`] || []) as number[], now);
  // Feature caps, Codex/Work, credits and banked resets are extras; chat windows decide the lane.
  const chat = shown.filter(win => estimable(win) && win.percent !== undefined).sort((a, b) => b.percent! - a.percent!);
  const extras = shown.filter(win => !estimable(win)).map(win => win.percent !== undefined ? `${win.feature} ${Number((100 - win.percent).toFixed(1))}% left` : win.remainingCount !== undefined ? `${win.feature} ${win.remainingCount.toLocaleString()} left` : '').filter(Boolean);
  const counted = messageSummary(provider, (saved[`usageSends:${provider}`] || []) as number[], (saved[`limitHits:${provider}`] || []) as LimitHit[], now, saved[`statedLimit:${provider}`] as StatedLimit | undefined);
  const withExtras = (text: string) => [text, ...extras].filter(Boolean).join(' · ');
  if (chat.length) {
    const tight = chat[0];
    const left = Math.max(0, 100 - tight.percent!);
    const estimated = !!tight.estimate && tight.estimate.perMessage !== undefined && tight.estimate.sends > 0;
    const reset = resetCountdown(tight.resetAt, now);
    return { provider, left, value: `${estimated ? '≈' : ''}${Number(left.toFixed(1))}% left`, detail: withExtras(`${tight.feature}${reset ? ` · resets in ${reset}` : ''}`), source: estimated ? 'estimate' : 'service' };
  }
  if (counted.learnedLimit && counted.left !== undefined) return { provider, left: counted.left / counted.learnedLimit * 100, value: `≈${counted.left} left`, detail: withExtras(counted.text), source: 'counted' };
  const sends = (saved[`usageSends:${provider}`] || []) as number[];
  if (counted.count || sends.some(at => now - at < WEEK)) return { provider, value: `${counted.count} sent`, detail: withExtras(`${counted.text} · counted by Baton`), source: 'counted' };
  // The service shows extras (ChatGPT Work, credits) but no chat limit: say so rather than a bare dash.
  if (extras.length) return { provider, value: 'No limit shown', detail: withExtras('Chat: no limit shown'), source: 'none' };
  return { provider, value: '—', detail: 'No usage shown yet', source: 'none' };
}

const WEEK = 7 * 86400000;
/** A service the user is actually using: a reading or a sent message within the last 7 days. */
export function laneInUse(saved: Record<string, unknown>, provider: ProviderId, now = Date.now()): boolean {
  const readings = (saved[`usageWindows:${provider}`] || []) as UsageWindow[];
  const sends = (saved[`usageSends:${provider}`] || []) as number[];
  return readings.some(win => typeof win.at === 'number' && now - win.at < WEEK) || sends.some(at => now - at < WEEK);
}
