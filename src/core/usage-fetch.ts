import type { ProviderId } from './selectors';
import { GEMINI_QUOTA_RPC, parseUsageResponse, type UsageKind } from './usage-api';
import type { UsageWindow } from './usage-windows';

// Baton's own usage refresh, so the bar stays current without a page load. It asks each site for the same usage the
// site's own pages fetch, with the user's existing sign-in: in an open tab of that AI when there is one (an ordinary
// request from the page), else from the background for ChatGPT and Claude. ChatGPT's short-lived access token is
// read for the call and kept nowhere. Only usage addresses are requested; no chat content is read or sent.

export const apiProviders: ProviderId[] = ['chatgpt', 'claude', 'gemini'];
type Body = { kind: UsageKind; text: string };
/** What the last check did, for Baton's usage panel: which way it went and what each address answered. */
export type UsageCheck = { at: number; route: 'tab' | 'background' | 'none'; steps: string[]; readings: number };

// Runs inside the AI's page (chrome.scripting, MAIN world): self-contained, returns the raw bodies and the answers.
async function fetchInPage(provider: string, geminiRpc: string): Promise<{ bodies: Body[]; steps: string[] }> {
  const out: Body[] = [];
  const steps: string[] = [];
  const call = async (name: string, request: Promise<Response>) => {
    try { const response = await request; steps.push(`${name} ${response.status}`); return response.ok ? response : undefined; } catch { steps.push(`${name} failed`); return undefined; }
  };
  const text = async (response: Response | undefined) => (response ? response.text().catch(() => '') : '');
  if (provider === 'chatgpt') {
    const session = await (await call('session', fetch('/api/auth/session', { credentials: 'include', headers: { accept: 'application/json' } })))?.json().catch(() => null);
    const token = session && session.accessToken;
    if (!token) { steps.push('signed out'); return { bodies: out, steps }; }
    const headers = { authorization: `Bearer ${token}`, accept: 'application/json' };
    out.push({ kind: 'chatgpt-wham', text: await text(await call('wham', fetch('/backend-api/wham/usage', { credentials: 'include', headers }))) });
    out.push({ kind: 'chatgpt-features', text: await text(await call('init', fetch('/backend-api/conversation/init', { method: 'POST', credentials: 'include', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ gizmo_id: null, requested_default_model: null, conversation_id: null, timezone_offset_min: new Date().getTimezoneOffset() }) }))) });
  } else if (provider === 'claude') {
    const orgs = await (await call('organizations', fetch('/api/organizations', { credentials: 'include', headers: { accept: 'application/json' } })))?.json().catch(() => []);
    const org = Array.isArray(orgs) ? orgs.find((o: any) => Array.isArray(o?.capabilities) && o.capabilities.includes('chat')) || orgs[0] : undefined;
    const id = org && (org.uuid || org.id);
    if (!id) { steps.push('no organization'); return { bodies: out, steps }; }
    out.push({ kind: 'claude-usage', text: await text(await call('usage', fetch(`/api/organizations/${encodeURIComponent(id)}/usage`, { credentials: 'include', headers: { accept: 'application/json' } }))) });
  } else if (provider === 'gemini') {
    const wiz = (window as any).WIZ_global_data || {};
    if (!wiz.SNlM0e) { steps.push('signed out'); return { bodies: out, steps }; }
    const prefix = (location.pathname.match(/^\/u\/\d+(?=\/|$)/) || [''])[0];
    const query = new URLSearchParams({ rpcids: geminiRpc, 'source-path': '/app', bl: wiz.cfb2h || '', 'f.sid': wiz.FdrFJe || '', hl: document.documentElement.lang || 'en', _reqid: String(Math.floor(Math.random() * 900000) + 100000), rt: 'c' });
    const body = new URLSearchParams({ 'f.req': JSON.stringify([[[geminiRpc, JSON.stringify([[[1, 2]]]), null, 'generic']]]), at: wiz.SNlM0e });
    out.push({ kind: 'gemini-quota', text: await text(await call('quota', fetch(`${prefix}/_/BardChatUi/data/batchexecute?${query}`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', 'x-same-domain': '1' }, body }))) });
  }
  return { bodies: out, steps };
}

/** “five_hour(utilization,resets_at), seven_day(…)”: names only, two levels deep, for the usage panel's check line. */
export function fieldNames(text: string): string {
  let json: unknown; try { json = JSON.parse(text); } catch { return 'not JSON'; }
  if (!json || typeof json !== 'object') return typeof json;
  const keys = (value: object) => Object.keys(value).slice(0, 12);
  return keys(json).map(key => { const inner = (json as any)[key]; return inner && typeof inner === 'object' && !Array.isArray(inner) ? `${key}(${keys(inner).join(',')})` : inner === null ? `${key}=null` : key; }).join(', ').slice(0, 300) || 'empty';
}

const origins: Record<string, string> = { chatgpt: 'https://chatgpt.com', claude: 'https://claude.ai', gemini: 'https://gemini.google.com' };

/** Reads usage for one AI: the parsed readings (empty when signed out or nothing came back) and what happened. */
export async function fetchUsage(provider: ProviderId, now = Date.now()): Promise<{ readings: UsageWindow[]; check: UsageCheck }> {
  const check: UsageCheck = { at: now, route: 'none', steps: [], readings: 0 };
  if (!apiProviders.includes(provider)) return { readings: [], check };
  // Any loaded tab of that AI will do, even one still finishing (the refresh fires as a chat page opens).
  const tabs = await chrome.tabs.query({ url: `${origins[provider]}/*` }).catch(() => [] as chrome.tabs.Tab[]);
  let bodies: Body[] = [];
  for (const tab of tabs.filter(tab => tab.id !== undefined && !tab.discarded).slice(0, 2)) {
    check.route = 'tab';
    try {
      const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id! }, world: 'MAIN', func: fetchInPage, args: [provider, GEMINI_QUOTA_RPC] });
      const answer = result?.result as { bodies: Body[]; steps: string[] } | undefined;
      bodies = answer?.bodies || [];
      check.steps = answer?.steps || ['no answer from tab'];
    } catch (error) { bodies = []; check.steps = [`tab script failed: ${error instanceof Error ? error.message : String(error)}`.slice(0, 120)]; }
    if (bodies.some(body => body.text)) break;
  }
  // No open tab (or it couldn't answer): ChatGPT and Claude also answer the background with the browser's sign-in.
  if (!bodies.some(body => body.text) && provider !== 'gemini') {
    const tabSteps = check.steps;
    const answer = await fetchFromBackground(provider);
    bodies = answer.bodies;
    check.route = 'background';
    check.steps = [...tabSteps.map(step => `tab: ${step}`), ...answer.steps];
  }
  const readings = bodies.flatMap(body => {
    if (!body.text) return [];
    const parsed = parseUsageResponse(body.kind, body.text, now);
    // An answer Baton couldn't read: note its field names (never values) so the panel shows what the service sent.
    if (!parsed.length) check.steps.push(`${body.kind} fields: ${fieldNames(body.text)}`);
    return parsed;
  });
  check.readings = readings.length;
  return { readings, check };
}

async function fetchFromBackground(provider: ProviderId): Promise<{ bodies: Body[]; steps: string[] }> {
  const base = origins[provider];
  const steps: string[] = [];
  const get = async (name: string, path: string, init: RequestInit = {}) => {
    try {
      const response = await fetch(base + path, { credentials: 'include', cache: 'no-store', ...init, headers: { accept: 'application/json', ...(init.headers || {}) } });
      steps.push(`${name} ${response.status}`);
      return response.ok ? response : undefined;
    } catch { steps.push(`${name} failed`); return undefined; }
  };
  const text = async (response: Response | undefined) => (response ? response.text().catch(() => '') : '');
  if (provider === 'chatgpt') {
    const session = await (await get('session', '/api/auth/session'))?.json().catch(() => null);
    const token = session?.accessToken;
    if (typeof token !== 'string' || !token) { steps.push('signed out'); return { bodies: [], steps }; }
    const auth = { authorization: `Bearer ${token}` };
    const [wham, init] = await Promise.all([
      get('wham', '/backend-api/wham/usage', { headers: auth }).then(text),
      get('init', '/backend-api/conversation/init', { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ gizmo_id: null, requested_default_model: null, conversation_id: null, timezone_offset_min: new Date().getTimezoneOffset() }) }).then(text)
    ]);
    return { bodies: [{ kind: 'chatgpt-wham', text: wham }, { kind: 'chatgpt-features', text: init }], steps };
  }
  const orgs = await (await get('organizations', '/api/organizations'))?.json().catch(() => []);
  const org = Array.isArray(orgs) ? orgs.find((o: any) => Array.isArray(o?.capabilities) && o.capabilities.includes('chat')) || orgs[0] : undefined;
  const id = org?.uuid || org?.id;
  if (!id) { steps.push('no organization'); return { bodies: [], steps }; }
  return { bodies: [{ kind: 'claude-usage', text: await get('usage', `/api/organizations/${encodeURIComponent(id)}/usage`).then(text) }], steps };
}
