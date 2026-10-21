import type { ProviderId } from './selectors';
import { providerIds } from './selectors';
import type { Meter } from './limits';
import { activeWindows, isCurrentReading, resetCountdown, type UsageWindow } from './usage-windows';

export const providerNames: Record<ProviderId, string> = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', deepseek: 'DeepSeek', grok: 'Grok', perplexity: 'Perplexity' };
export const newChatUrls: Record<ProviderId, string> = { chatgpt: 'https://chatgpt.com/', claude: 'https://claude.ai/new', gemini: 'https://gemini.google.com/app', deepseek: 'https://chat.deepseek.com/', grok: 'https://grok.com/', perplexity: 'https://www.perplexity.ai/' };

/** DeepSeek, Grok and Perplexity stay off until the user enables them, as in the destination list. */
export function providerEnabled(id: ProviderId, enabled: Record<string, boolean | undefined> = {}): boolean {
  return enabled[id] === false ? false : enabled[id] === true || !['deepseek', 'grok', 'perplexity'].includes(id);
}

// Feature caps, Codex/Work allowances and credits leave ordinary chat usable, so they never decide whether a service is out.
const chatReading = (feature: string) => !/image|file|upload|voice|deep research|work|codex|credit|limit resets|^model$/i.test(feature);
function readings(saved: Record<string, unknown>, id: ProviderId, now: number): Meter[] {
  const windows = activeWindows((saved[`usageWindows:${id}`] || []) as UsageWindow[], now).filter(win => chatReading(win.feature));
  const meter = saved[`meter:${id}`] as Meter | undefined;
  // A “limit reached” notice is kept alongside per-window readings unless it repeats one of them.
  const notice = isCurrentReading(meter, now) && chatReading(meter.feature) && (meter.percent !== undefined || meter.remainingPercent !== undefined) && !windows.some(win => win.feature === meter.feature) ? [meter] : [];
  return [...windows, ...notice];
}

export type LimitState = { provider: ProviderId; feature: string; resetAt?: number };
/** A limit counts only when the service itself showed it within the last hour. */
export function reachedLimit(saved: Record<string, unknown>, id: ProviderId, now = Date.now()): LimitState | undefined {
  const hit = readings(saved, id, now).filter(reading => reading.percent === 100);
  if (!hit.length) return;
  const resets = hit.map(reading => reading.resetAt).filter((at): at is number => !!at && at > now);
  // The window that frees up last decides when this service is usable again.
  return { provider: id, feature: hit.map(reading => reading.feature).join(' and '), ...(resets.length === hit.length ? { resetAt: Math.max(...resets) } : {}) };
}

export type RescueOption = { provider: ProviderId; status: 'room' | 'unknown' | 'limited'; remainingPercent?: number; resetAt?: number; detail: string };
/** Other services ranked by fresh readings: room left first, then no reading, then limited (soonest reset first). Unknown stays unknown. */
export function rescueOptions(source: ProviderId, saved: Record<string, unknown>, enabled: Record<string, boolean | undefined> = {}, now = Date.now()): RescueOption[] {
  const options = providerIds.filter(id => id !== source && providerEnabled(id, enabled)).map((id): RescueOption => {
    const limit = reachedLimit(saved, id, now);
    if (limit) return { provider: id, status: 'limited', ...(limit.resetAt ? { resetAt: limit.resetAt } : {}), detail: `limit reached${limit.resetAt ? ` · resets in ${resetCountdown(limit.resetAt, now)}` : ''}` };
    const left = readings(saved, id, now).map(reading => reading.remainingPercent ?? (reading.percent === undefined ? undefined : 100 - reading.percent)).filter((value): value is number => value !== undefined);
    if (!left.length) return { provider: id, status: 'unknown', detail: 'no limit shown' };
    const remainingPercent = Math.min(...left);
    return { provider: id, status: 'room', remainingPercent, detail: `${Number(remainingPercent.toFixed(1))}% left` };
  });
  const order = { room: 0, unknown: 1, limited: 2 };
  return options.sort((a, b) => order[a.status] - order[b.status] || (b.remainingPercent ?? 0) - (a.remainingPercent ?? 0) || (a.resetAt ?? Infinity) - (b.resetAt ?? Infinity));
}

export type AccountSwitch = { url?: string; steps: string };
/** Only the service's own account screens. Handoff never signs anyone out or in. */
export function accountSwitch(id: ProviderId): AccountSwitch {
  if (id === 'gemini') return { url: 'https://accounts.google.com/AccountChooser?continue=https%3A%2F%2Fgemini.google.com%2Fapp', steps: 'Pick another Google account in Google’s chooser, then paste your project into the new chat.' };
  const menu = id === 'claude' ? 'your name at the bottom left → Log out' : id === 'chatgpt' ? 'your profile picture → Log out' : 'the account menu → Log out';
  return { steps: `${providerNames[id]} has no account switcher. Use ${menu}, sign in with the other account, then paste your project.` };
}
