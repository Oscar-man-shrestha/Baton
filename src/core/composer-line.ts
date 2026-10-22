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
  return windows.filter(win => chatFeature(win.feature) && win.percent !== undefined)
    .sort((a, b) => b.percent! - a.percent!).slice(0, 2)
    .map(win => {
      const left = Math.max(0, Math.round(100 - win.percent!));
      const estimated = !!win.estimate && win.estimate.perMessage !== undefined && win.estimate.sends > 0;
      const reset = resetCountdown(win.resetAt, now);
      return { label: short(win.feature), value: `${estimated ? '≈' : ''}${left}% left`, left, level: level(left), ...(reset ? { note: reset } : {}) };
    });
}
