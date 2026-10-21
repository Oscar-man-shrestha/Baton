import type { ProviderId } from './selectors';
import { estimateMeter, type Meter } from './limits';

export type UsageWindow = Meter & { key: string; remainingCount?: number; source: 'provider-page' | 'provider-response'; evidenceKey?: string };
export function isCurrentReading(meter: Meter | undefined, now = Date.now()): meter is Meter & { at: number } {
  if (!meter || meter.tier !== 'banner' || meter.confidence !== 'high' || typeof meter.at !== 'number' || !Number.isFinite(meter.at) || meter.at > now || now - meter.at >= 3600000) return false;
  for (const value of [meter.percent, meter.remainingPercent]) if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100)) return false;
  if (meter.remainingTokens !== undefined && (!Number.isSafeInteger(meter.remainingTokens) || meter.remainingTokens < 0)) return false;
  if (meter.resetAt !== undefined && (!Number.isFinite(meter.resetAt) || meter.resetAt <= now)) return false;
  return true;
}
export function activeWindows(windows: UsageWindow[], now = Date.now()): UsageWindow[] {
  return Array.isArray(windows) ? windows.filter(win => isCurrentReading(win, now)) : [];
}
function evidenceKey(text: string): string {
  // Persist an equality fingerprint rather than the surrounding provider-page text.
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
export function mergeUsageWindows(previous: UsageWindow[], incoming: UsageWindow[], now = Date.now()): UsageWindow[] {
  const old = Array.isArray(previous) ? previous : [];
  const merged = new Map(activeWindows(old, now).map(win => [win.key, win]));
  for (const win of incoming) {
    const prior = old.find(candidate => candidate.key === win.key);
    // An unchanged relative reset label is the same observation, not a new window.
    const next = prior?.evidenceKey && prior.evidenceKey === win.evidenceKey && prior.resetAt !== undefined
      ? { ...win, resetAt: prior.resetAt } : win;
    if (isCurrentReading(next, now) || (next.evidenceKey && next.resetAt !== undefined && Number.isFinite(next.resetAt) && next.resetAt <= now)) merged.set(win.key, next); else merged.delete(win.key);
  }
  return [...merged.values()];
}
export function resetCountdown(resetAt?: number, now = Date.now()): string {
  if (!resetAt || resetAt <= now) return '';
  const minutes = Math.ceil((resetAt - now) / 60000);
  return minutes >= 1440 ? `${Math.floor(minutes / 1440)}d ${Math.floor(minutes % 1440 / 60)}h` : minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}
export function windowLabel(win: UsageWindow, now = Date.now()): string {
  const value = win.percent !== undefined ? `${Number(win.percent.toFixed(2))}% used` : win.remainingCount !== undefined ? `${win.remainingCount} left` : win.remainingTokens !== undefined ? `${win.remainingTokens} tokens left` : 'Balance unknown';
  const reset = resetCountdown(win.resetAt, now);
  return `${win.feature} ${value}${reset ? ` · resets in ${reset}` : ''}${win.at && now - win.at > 300000 ? ' · last seen' : ''}`;
}

// Page readings require semantic service elements outside messages and other extensions.
// Plain numbers in chat text, sidebar widgets, and an absent percentage are never quotas.
export function readUsageWindows(doc: Document, provider: ProviderId, turnNodes: Element[], now = Date.now()): UsageWindow[] {
  const windows: UsageWindow[] = [];
  const excluded = (node: Element) => turnNodes.some(turn => turn.contains(node)) || !!node.closest('nav,aside,[role="navigation"],[contenteditable="true"],textarea,[id*="handoff"],[id*="capsule"],[id*="usage-monitor"],[class*="usage-monitor"],[data-extension]');
  const visible = (node: Element) => {
    for (let element: Element | null = node; element; element = element.parentElement) {
      const style = doc.defaultView?.getComputedStyle(element);
      if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true' || style?.display === 'none' || style?.visibility === 'hidden' || style?.opacity === '0') return false;
    }
    return true;
  };
  const textOf = (node: Element) => ((node as HTMLElement).innerText || Array.from(node.childNodes).map(child => child.textContent || '').join(' ')).replace(/\s+/g, ' ').trim();
  const candidates = Array.from(doc.querySelectorAll('[role="progressbar"],[role="alert"],[aria-live="assertive"],[data-testid*="usage" i],[data-testid*="limit" i]'));
  if (provider === 'claude' && /^\/settings\/usage\/?$/.test(doc.location.pathname)) {
    for (const heading of Array.from(doc.querySelectorAll('main h2,main h3,main h4,main p'))) {
      if (/^(?:current session|weekly limits|all models|sonnet only|opus only|session usage|weekly usage)/i.test(heading.textContent?.trim() || '')) candidates.push(heading.parentElement || heading);
    }
  }
  for (const node of candidates) {
    if (excluded(node) || !visible(node) || candidates.some(other => other !== node && node.contains(other))) continue;
    let label = node.getAttribute('aria-label') || '';
    if (!label && provider === 'claude' && /^\/settings\/usage\/?$/.test(doc.location.pathname)) {
      for (let scope: Element | null = node.parentElement, depth = 0; scope && depth < 4 && !scope.matches('main,body'); scope = scope.parentElement, depth++) {
        const text = scope.textContent || '';
        const session = /current session|session usage|5.hour session/i.test(text);
        const weekly = /weekly|all models|sonnet only|opus only/i.test(text);
        if (session !== weekly) { label = session ? 'Session usage' : /sonnet only/i.test(text) ? 'Sonnet weekly usage' : /opus only/i.test(text) ? 'Opus weekly usage' : 'Weekly usage'; break; }
      }
    }
    let text = `${label} ${textOf(node)}`.replace(/\s+/g, ' ').trim().slice(0, 500);
    if (node.getAttribute('role') === 'progressbar' && /usage|quota|session|weekly/i.test(label) && (!node.hasAttribute('aria-valuemax') || node.getAttribute('aria-valuemax') === '100')) {
      const value = Number(node.getAttribute('aria-valuenow'));
      if (node.hasAttribute('aria-valuenow') && Number.isFinite(value) && value >= 0 && value <= 100) {
        let context = node;
        for (let scope = node.parentElement, depth = 0; scope && depth < 3 && !scope.matches('main,body') && scope.querySelectorAll('[role="progressbar"]').length === 1 && !turnNodes.some(turn => scope!.contains(turn)); scope = scope.parentElement, depth++) context = scope;
        text = `${label} ${value}% used ${textOf(context)}`.slice(0, 500);
      }
    }
    const meter = estimateMeter(provider, text, [], [], now);
    const count = text.match(/(?:deep research|image(?: generation)?|file upload|messages?)\s*:?\s*(\d+)\s+(?:remaining|left)/i);
    if (meter.tier !== 'banner' && !count) continue;
    const featureText = /weekly|session|deep research|image|file upload/i.test(label) ? label : text;
    const feature = /sonnet/i.test(featureText) ? 'Sonnet weekly' : /opus/i.test(featureText) ? 'Opus weekly' : /weekly|7.day/i.test(featureText) ? 'Weekly' : /session|5.hour/i.test(featureText) ? 'Session' : /deep research/i.test(featureText) ? 'Deep research' : /image/i.test(featureText) ? 'Images' : /file upload/i.test(featureText) ? 'File uploads' : 'Chat';
    const key = `${provider}:${feature}`;
    if (windows.some(win => win.key === key)) continue;
    windows.push({ ...meter, tier: 'banner', confidence: 'high', key, feature, at: now, source: 'provider-page', evidenceKey: evidenceKey(text), ...(count ? { remainingCount: Number(count[1]) } : {}) });
  }
  return windows;
}

// Experimental parser only. No network request, session token, or interception is shipped.
// Claude API fields use percent; completion message_limit fields use fractions.
export function parseClaudeUsage(payload: unknown, at = Date.now()): UsageWindow[] {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as Record<string, any>;
  const data = root.message_limit?.windows;
  const entries = data ? [['Session', data['5h'], true], ['Weekly', data['7d'], true]] as const
    : [['Session', root.five_hour, false], ['Weekly', root.seven_day, false], ['Sonnet weekly', root.seven_day_sonnet, false], ['Opus weekly', root.seven_day_opus, false]] as const;
  return entries.flatMap(([feature, value, fraction]) => {
    if (!value || typeof value.utilization !== 'number' || !Number.isFinite(value.utilization)) return [];
    const percent = value.status === 'exceeded_limit' ? 100 : value.utilization * (fraction ? 100 : 1);
    if (percent < 0 || percent > 100) return [];
    const rawReset = value.resets_at;
    const resetAt = typeof rawReset === 'number' && rawReset > 0 ? rawReset * 1000 : typeof rawReset === 'string' ? Date.parse(rawReset) : undefined;
    return [{ provider: 'claude' as const, tier: 'banner' as const, confidence: 'high' as const, key: `claude:${feature}`, feature, percent, remainingPercent: 100 - percent, at, ...(resetAt && Number.isFinite(resetAt) ? { resetAt } : {}), explanation: 'Claude numeric usage metadata', source: 'provider-response' as const }];
  });
}
