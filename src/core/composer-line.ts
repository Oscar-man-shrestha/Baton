import type { DisplayWindow } from './usage-estimate';
import { resetCountdown } from './usage-windows';

/** One piece of the usage bar under the composer: “Session ▰▰▱ 63% left · 3h 9m”. */
export type Segment = { label: string; value: string; left?: number; note?: string; level?: 'ok' | 'mid' | 'low' };

/** Features that are not chat (ChatGPT's Codex/Work, credits, banked resets, feature caps) never go under the chat box. */
export const chatFeature = (feature: string) => !/image|file|upload|voice|deep research|work|codex|credit|limit resets|^model$/i.test(feature);
const level = (left: number): Segment['level'] => left < 20 ? 'low' : left < 50 ? 'mid' : 'ok';
const short = (feature: string) => feature.replace(/\s*usage$/i, '').replace(/^chat$/i, 'Chat');

/** The tightest chat windows first, at most two, as “N% left” with their reset. */
export function chatSegments(windows: DisplayWindow[], now = Date.now()): Segment[] {
  // Allowances counted in messages (ChatGPT's Thinking) read as “N left” in countSegments, not as a percentage here.
  return windows.filter(win => chatFeature(win.feature) && win.percent !== undefined && !(win.source === 'provider-response' && win.remainingCount !== undefined))
    .sort((a, b) => b.percent! - a.percent!).slice(0, 2)
    .map(win => {
      const left = Math.max(0, Math.round(100 - win.percent!));
      const estimated = !!win.estimate && win.estimate.perMessage !== undefined && win.estimate.sends > 0;
      const reset = resetCountdown(win.resetAt, now);
      return { label: short(win.feature), value: `${estimated ? '≈' : ''}${left}% left`, left, level: level(left), ...(reset ? { note: reset } : {}) };
    });
}

/**
 * ChatGPT's only published limits: the 5-hour and weekly “Plan limits” shared by Codex, Work, Workspace Agents and
 * ChatGPT for Excel (chat is not included). They go after the chat count, labelled “Work” so no one reads them as chat.
 */
export function workSegments(windows: DisplayWindow[], now = Date.now()): Segment[] {
  // Codex monthly is the one window ChatGPT reports on Free plans.
  return [['Work 5-hour', 'Work 5h'], ['Work weekly', 'Work week'], ['Codex monthly', 'Codex month']].flatMap(([feature, label]) => {
    const win = windows.find(candidate => candidate.feature === feature && candidate.percent !== undefined);
    if (!win) return [];
    const left = Math.max(0, Math.round(100 - win.percent!));
    const reset = resetCountdown(win.resetAt, now);
    return [{ label, value: `${left}% left`, left, level: level(left), ...(reset ? { note: reset } : {}) }];
  });
}

// The feature allowances worth a place in the bar, with short names; the rest stay in Baton's usage list.
// Short names for the bar; any other allowance ChatGPT reports shows by its first word.
const allowanceLabels: Record<string, string> = { 'Deep research': 'Research', 'Image generation': 'Images', 'File uploads': 'Uploads', 'Paste text to file': 'Paste', 'Paste to file': 'Paste', Agent: 'Agent', Video: 'Video' };
const allowanceLabel = (feature: string) => allowanceLabels[feature] ?? feature.split(' ')[0];
const countSegment = (win: DisplayWindow, label: string, now: number): Segment => {
  const count = win.remainingCount!;
  const reset = resetCountdown(win.resetAt, now);
  const left = win.percent !== undefined ? Math.max(0, Math.round(100 - win.percent)) : undefined;
  return { label, value: `${count} left`, ...(left !== undefined ? { left } : {}), level: count === 0 ? 'low' : count <= 2 ? 'mid' : 'ok', ...(reset ? { note: reset } : {}) };
};
/**
 * ChatGPT's allowances as the site reports them: Thinking (“Thinking 3 left · 4h 46m”), then whichever other allowance
 * is closest to running out (“Paste 3 left · 1d 0h”). A ring shows when the maximum is known.
 */
/**
 * Grok's and Perplexity's own counts (“Grok 4 7 left”, “Pro search 3 left”): the two closest to running out, in the
 * service's own words. ChatGPT's counts go through countSegments, which also places its Thinking allowance first.
 */
export function serviceCountSegments(windows: DisplayWindow[], now = Date.now()): Segment[] {
  return windows.filter(win => win.remainingCount !== undefined && win.source === 'provider-response')
    .sort((a, b) => a.remainingCount! - b.remainingCount! || a.feature.localeCompare(b.feature)).slice(0, 2)
    .map(win => countSegment(win, win.feature, now));
}
export function countSegments(windows: DisplayWindow[], now = Date.now()): Segment[] {
  const counted = windows.filter(win => win.remainingCount !== undefined && win.source === 'provider-response');
  const thinking = counted.find(win => win.feature === 'Thinking');
  const scarcest = counted.filter(win => win.feature !== 'Thinking').sort((a, b) => a.remainingCount! - b.remainingCount! || (a.resetAt ?? Infinity) - (b.resetAt ?? Infinity))[0];
  return [...(thinking ? [countSegment(thinking, 'Thinking', now)] : []), ...(scarcest ? [countSegment(scarcest, allowanceLabel(scarcest.feature), now)] : [])];
}
