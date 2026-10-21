import type { Meter } from './limits';

export type UsageAlert = { key: string; title: string; message: string };

// A numeric warning is eligible only when the service displayed the number.
export function usageAlert(meter: Meter, delivered: readonly string[], now = Date.now()): UsageAlert | undefined {
  if (meter.tier !== 'banner' || meter.confidence !== 'high') return;
  const window = meter.resetAt && meter.resetAt > now ? String(Math.round(meter.resetAt / 900000)) : `day-${Math.floor(now / 86400000)}`;
  const level = meter.percent === 100 ? 'reached' : meter.percent !== undefined && meter.percent >= 95 ? '95' : meter.percent !== undefined && meter.percent >= 80 ? '80' : meter.nearLimit ? 'near' : undefined;
  if (!level) return;
  const key = `${meter.provider}:${meter.feature}:${window}:${level}`;
  // Relative countdowns are rounded by sites, so their computed reset can drift.
  const prefix = `${meter.provider}:${meter.feature}:`;
  if (delivered.some(previous => {
    if (previous === key) return true;
    if (!previous.startsWith(prefix) || !previous.endsWith(`:${level}`)) return false;
    const oldWindow = previous.slice(prefix.length, -level.length - 1);
    return /^\d+$/.test(window) && /^\d+$/.test(oldWindow) && Math.abs(Number(window) - Number(oldWindow)) <= 16;
  })) return;
  const name = meter.provider === 'chatgpt' ? 'ChatGPT' : meter.provider === 'deepseek' ? 'DeepSeek' : meter.provider[0].toUpperCase() + meter.provider.slice(1);
  const detail = level === 'reached' ? 'The service reports a limit.' : level === 'near' ? 'The service reports you are close to a limit.' : `The service shows ${meter.percent}% used for this limit.`;
  return { key, title: `${name} usage alert`, message: `${detail}${meter.resetAt ? ` Resets around ${new Date(meter.resetAt).toLocaleString()}.` : ''}` };
}

export function meterSummary(meter?: Meter, now = Date.now()): string {
  if (!meter || meter.tier !== 'banner' || !meter.at || now - meter.at > 3600000 || (meter.resetAt !== undefined && meter.resetAt <= now)) return 'No recent service limit signal';
  const status = meter.percent === 100 ? 'Limit reached' : meter.remainingPercent !== undefined ? `${meter.remainingPercent}% left` : meter.remainingTokens !== undefined ? `${meter.remainingTokens.toLocaleString()} tokens left` : meter.nearLimit ? 'Near limit' : 'Balance unknown';
  return `${status}, ${now - meter.at > 300000 ? `last shown ${new Date(meter.at).toLocaleTimeString()}` : 'shown by service'}${meter.resetAt && meter.resetAt > now ? ` · resets ${new Date(meter.resetAt).toLocaleString()}` : ''}`;
}
