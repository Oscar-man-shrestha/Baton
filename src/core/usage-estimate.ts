import { activeWindows, isCurrentReading, resetCountdown, type UsageWindow } from './usage-windows';

/** One official reading kept for calibration. */
export type Calibration = { at: number; percent: number; resetAt?: number };
export type UsageHistory = Record<string, Calibration[]>;
export type DisplayWindow = UsageWindow & { estimate?: { from: number; fromAt: number; sends: number; perMessage?: number } };

// Only windows that chat messages draw from. ChatGPT's Work/Codex pool, credits and feature caps are not.
export const estimable = (win: Pick<UsageWindow, 'feature' | 'percent'>) => win.percent !== undefined && !/image|file|upload|voice|deep research|work|codex|credit|reset|^model$/i.test(win.feature);
const MAX_AGE = 6 * 3600000;
const sameWindow = (a: Calibration, b: Calibration) => (a.resetAt === undefined && b.resetAt === undefined) || (a.resetAt !== undefined && b.resetAt !== undefined && Math.abs(a.resetAt - b.resetAt) < 20 * 60000);

/** Adds official readings to the calibration history (newest 20 per window). */
export function recordReadings(history: UsageHistory, windows: UsageWindow[]): UsageHistory {
  const next: UsageHistory = { ...history };
  for (const win of windows) {
    if (!estimable(win) || win.at === undefined) continue;
    const list = (next[win.key] || []).filter(entry => entry.at !== win.at);
    next[win.key] = [...list, { at: win.at, percent: win.percent!, ...(win.resetAt ? { resetAt: win.resetAt } : {}) }].sort((a, b) => a.at - b.at).slice(-20);
  }
  return next;
}

/** Median percent per sent message, from consecutive readings in the same window with messages between them. */
export function perMessageCost(readings: Calibration[], sends: number[]): number | undefined {
  const costs: number[] = [];
  for (let i = 1; i < readings.length; i++) {
    const [a, b] = [readings[i - 1], readings[i]];
    const between = sends.filter(at => at > a.at && at <= b.at).length;
    if (!between || !sameWindow(a, b) || b.percent < a.percent) continue;
    costs.push((b.percent - a.percent) / between);
  }
  if (!costs.length) return undefined;
  const recent = costs.slice(-5).sort((x, y) => x - y);
  return recent[Math.floor(recent.length / 2)];
}

/**
 * What to show for a service right now: current official readings, and for windows chat draws from,
 * the last official reading moved forward by messages sent since. Estimates end when the window resets.
 */
export function displayWindows(windows: UsageWindow[], history: UsageHistory, sends: number[], now = Date.now()): DisplayWindow[] {
  const current = activeWindows(windows, now);
  const shown: DisplayWindow[] = current.filter(win => !estimable(win));
  const keys = new Set([...current.filter(estimable).map(win => win.key), ...Object.keys(history)]);
  for (const key of keys) {
    const readings = (history[key] || []).filter(entry => entry.at <= now);
    const official = current.find(win => win.key === key);
    const last = readings.at(-1);
    const base = official && (!last || official.at! >= last.at) ? official : undefined;
    const from = base ? { at: base.at!, percent: base.percent!, resetAt: base.resetAt } : last;
    if (!from || now - from.at > MAX_AGE || (from.resetAt !== undefined && from.resetAt <= now)) continue;
    const template = base || windows.find(win => win.key === key);
    if (!template) continue;
    const count = sends.filter(at => at > from.at && at <= now).length;
    const cost = perMessageCost(readings, sends);
    const percent = Math.min(100, from.percent + (cost ?? 0) * count);
    shown.push({ ...template, percent, remainingPercent: 100 - percent, at: from.at, ...(from.resetAt ? { resetAt: from.resetAt } : {}),
      ...(count || !base ? { estimate: { from: from.percent, fromAt: from.at, sends: count, ...(cost !== undefined ? { perMessage: cost } : {}) } } : {}) });
  }
  return shown;
}

/** “Session ≈47% used · est. · 3 msgs since 41% at 01:08 · resets in 2h 10m”; official readings keep the usual wording. */
export function displayLabel(win: DisplayWindow, now = Date.now()): string {
  if (!win.estimate) return '';
  const reset = resetCountdown(win.resetAt, now);
  const time = new Date(win.estimate.fromAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const since = `${win.estimate.sends} msg${win.estimate.sends === 1 ? '' : 's'} since ${Number(win.estimate.from.toFixed(1))}% at ${time}`;
  const value = win.estimate.perMessage !== undefined && win.estimate.sends ? `≈${Math.round(win.percent!)}% used · est.` : `${Number(win.estimate.from.toFixed(1))}% used at ${time}`;
  return `${win.feature} ${value}${win.estimate.sends ? ` · ${since}` : ''}${reset ? ` · resets in ${reset}` : ''}`;
}

/** Keeps the official/estimated distinction for readers like badges and alerts. */
export const isOfficial = (win: DisplayWindow) => !win.estimate && isCurrentReading(win);
