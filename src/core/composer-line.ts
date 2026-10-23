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
  return [['Work 5-hour', 'Work 5h'], ['Work weekly', 'Work week']].flatMap(([feature, label]) => {
    const win = windows.find(candidate => candidate.feature === feature && candidate.percent !== undefined);
    if (!win) return [];
    const left = Math.max(0, Math.round(100 - win.percent!));
    const reset = resetCountdown(win.resetAt, now);
    return [{ label, value: `${left}% left`, left, level: level(left), ...(reset ? { note: reset } : {}) }];
  });
}

// The feature allowances worth a place in the bar, with short names; the rest stay in Baton's usage list.
const allowanceLabels: Record<string, string> = { 'Deep research': 'Research', 'Image generation': 'Images', 'File uploads': 'Uploads', Agent: 'Agent', Video: 'Video' };
const countSegment = (win: DisplayWindow, label: string, now: number): Segment => {
  const count = win.remainingCount!;
  const reset = resetCountdown(win.resetAt, now);
  const left = win.percent !== undefined ? Math.max(0, Math.round(100 - win.percent)) : undefined;
  return { label, value: `${count} left`, ...(left !== undefined ? { left } : {}), level: count === 0 ? 'low' : count <= 2 ? 'mid' : 'ok', ...(reset ? { note: reset } : {}) };
};
/**
 * ChatGPT's allowances as the site reports them: Thinking (“Thinking 3 left · 4h 46m”), then the one feature allowance
 * closest to running out (“Research 5 left · 30d 0h”). A ring shows when the maximum is known.
 */
export function countSegments(windows: DisplayWindow[], now = Date.now()): Segment[] {
  const counted = windows.filter(win => win.remainingCount !== undefined && win.source === 'provider-response');
  const thinking = counted.find(win => win.feature === 'Thinking');
  const scarcest = counted.filter(win => allowanceLabels[win.feature]).sort((a, b) => a.remainingCount! - b.remainingCount! || (a.resetAt ?? Infinity) - (b.resetAt ?? Infinity))[0];
  return [...(thinking ? [countSegment(thinking, 'Thinking', now)] : []), ...(scarcest ? [countSegment(scarcest, allowanceLabels[scarcest.feature], now)] : [])];
}
