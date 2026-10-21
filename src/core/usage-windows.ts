import type { ProviderId } from './selectors';
import { estimateMeter, parseReset, type Meter } from './limits';

export type UsageWindow = Meter & { key: string; remainingCount?: number; source: 'provider-page' | 'provider-response'; evidenceKey?: string };
export function isClaudeUsageUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'claude.ai' && (/^\/settings\/usage\/?$/.test(url.pathname) || /^#\/?settings\/usage\/?$/.test(url.hash));
  } catch { return false; }
}
export function isGeminiUsageUrl(value: string | undefined): boolean {
  if (!value) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'gemini.google.com' && /^\/usage\/?$/.test(url.pathname); } catch { return false; }
}
/** The service's own usage screen, where it shows official figures. */
export function usagePageUrl(provider: ProviderId): string | undefined {
  return provider === 'claude' ? 'https://claude.ai/settings/usage' : provider === 'gemini' ? 'https://gemini.google.com/usage' : undefined;
}
export function isUsagePageUrl(provider: ProviderId, value: string | undefined): boolean {
  return provider === 'claude' ? isClaudeUsageUrl(value) : provider === 'gemini' && isGeminiUsageUrl(value);
}
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
  if (provider === 'gemini' && isGeminiUsageUrl(doc.location.href)) return readGeminiUsage(doc, now, { excluded, visible, textOf });
  const rowLabels = new Map<Element, string>();
  const candidates = Array.from(doc.querySelectorAll('progress,[role="progressbar"],[role="alert"],[aria-live="assertive"],[data-testid*="usage" i],[data-testid*="limit" i]'));
  const claudeUsagePage = provider === 'claude' && isClaudeUsageUrl(doc.location.href);
  if (claudeUsagePage) {
    // Claude's settings page also uses plain text rows, without semantic progressbars.
    // Start from an exact feature label and stop at the smallest numeric row.
    for (const heading of Array.from(doc.querySelectorAll('h2,h3,h4,p,span,div'))) {
      const title = textOf(heading);
      if (!/^(?:current session|weekly limits|all models|sonnet only|opus only|session usage|weekly usage)$/i.test(title)) continue;
      if (excluded(heading) || !visible(heading)) continue;
      for (let row = heading.parentElement, depth = 0; row && depth < 5 && !row.matches('main,body'); row = row.parentElement, depth++) {
        const text = textOf(row);
        // Never combine two quota windows into one reading.
        const features = text.match(/current session|session usage|weekly limits|all models|sonnet only|opus only|weekly usage/gi) || [];
        if (new Set(features.map(feature => feature.toLowerCase())).size > 1) break;
        if (/\d+(?:\.\d+)?\s*%\s*(?:used|remaining|left)|(?:used|remaining|left)\s*:?\s*\d+(?:\.\d+)?\s*%/i.test(text) || row.querySelector('[role="progressbar"],progress')) {
          const feature = /session/i.test(title) ? 'Session usage' : /sonnet/i.test(title) ? 'Sonnet weekly usage' : /opus/i.test(title) ? 'Opus weekly usage' : 'Weekly usage';
          rowLabels.set(row, feature); candidates.push(row); break;
        }
      }
    }
  }
  for (const node of candidates) {
    if (excluded(node) || !visible(node) || candidates.some(other => other !== node && node.contains(other))) continue;
    let label = node.getAttribute('aria-label') || rowLabels.get(node) || '';
    if (!label && claudeUsagePage) {
      for (let scope: Element | null = node.parentElement, depth = 0; scope && depth < 4 && !scope.matches('main,body'); scope = scope.parentElement, depth++) {
        const text = scope.textContent || '';
        const session = /current session|session usage|5.hour session/i.test(text);
        const weekly = /weekly|all models|sonnet only|opus only/i.test(text);
        if (session !== weekly) { label = session ? 'Session usage' : /sonnet only/i.test(text) ? 'Sonnet weekly usage' : /opus only/i.test(text) ? 'Opus weekly usage' : 'Weekly usage'; break; }
      }
    }
    let text = `${label} ${textOf(node)}`.replace(/\s+/g, ' ').trim().slice(0, 500);
    if ((node.getAttribute('role') === 'progressbar' || node.tagName === 'PROGRESS') && /usage|quota|session|weekly/i.test(label) && (!node.hasAttribute('aria-valuemax') || node.getAttribute('aria-valuemax') === '100')) {
      const value = Number(node.getAttribute('aria-valuenow') ?? node.getAttribute('value'));
      const nativeMax = node.tagName === 'PROGRESS' ? Number(node.getAttribute('max') || '1') : 100;
      if ((node.hasAttribute('aria-valuenow') || node.hasAttribute('value')) && nativeMax === 100 && Number.isFinite(value) && value >= 0 && value <= 100) {
        let context = node;
        for (let scope = node.parentElement, depth = 0; scope && depth < 3 && !scope.matches('main,body') && scope.querySelectorAll('[role="progressbar"],progress').length === 1 && !turnNodes.some(turn => scope!.contains(turn)); scope = scope.parentElement, depth++) context = scope;
        text = `${label} ${value}% used ${textOf(context)}`.slice(0, 500);
      }
    }
    if (rowLabels.has(node)) {
      const balance = text.match(/(?<![-\d.])\d+(?:\.\d+)?\s*%\s*(?:used|remaining|left)/i);
      if (balance) text = `${label} ${balance[0]} ${text}`;
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

// Gemini's Usage limits page (since May 2026): “Current usage” is the 5-hour window, “Weekly limit” the weekly one.
// Each window is read from the widest box holding only its own label, so the reset line below the bar is included.
function readGeminiUsage(doc: Document, now: number, page: { excluded: (node: Element) => boolean; visible: (node: Element) => boolean; textOf: (node: Element) => string }): UsageWindow[] {
  const windows: UsageWindow[] = [];
  for (const heading of Array.from(doc.querySelectorAll('h1,h2,h3,h4,p,span,div'))) {
    const title = page.textOf(heading);
    const feature = /^current usage\b/i.test(title) ? 'Session' : /^weekly limit\b/i.test(title) ? 'Weekly' : '';
    const key = `gemini:${feature}`;
    if (!feature || title.length > 40 || windows.some(win => win.key === key) || page.excluded(heading) || !page.visible(heading)) continue;
    let card: Element | undefined;
    for (let scope = heading.parentElement, depth = 0; scope && depth < 6 && !scope.matches('main,body'); scope = scope.parentElement, depth++) {
      const text = page.textOf(scope);
      if (new Set((text.match(/current usage|weekly limit/gi) || []).map(label => label.toLowerCase())).size > 1) break;
      if (/\d\s*%\s*used/i.test(text)) card = scope;
    }
    if (!card) continue;
    const text = page.textOf(card).slice(0, 500);
    const percent = Number(text.match(/(?<![-\d.])(\d{1,3}(?:\.\d+)?)\s*%\s*used/i)?.[1]);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) continue;
    const resetAt = parseReset(text, now);
    windows.push({ provider: 'gemini', tier: 'banner', confidence: 'high', key, feature, percent, remainingPercent: 100 - percent, ...(resetAt ? { resetAt } : {}), at: now, source: 'provider-page', evidenceKey: evidenceKey(text), explanation: 'Shown on Gemini’s Usage limits page' });
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
