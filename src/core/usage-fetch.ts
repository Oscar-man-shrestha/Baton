import type { ProviderId } from './selectors';
import { GEMINI_QUOTA_RPC, parseUsageResponse, type UsageKind } from './usage-api';
import type { UsageWindow } from './usage-windows';

// Baton's own usage refresh, so the bar stays current without a page load. It asks each site for the same usage the
// site's own pages fetch, with the user's existing sign-in: in an open tab of that AI when there is one (an ordinary
// request from the page), else from the background for ChatGPT and Claude. ChatGPT's short-lived access token is
// read for the call and kept nowhere. Only usage addresses are requested; no chat content is read or sent.

export const apiProviders: ProviderId[] = ['chatgpt', 'claude', 'gemini'];
type Body = { kind: UsageKind; text: string };

// Runs inside the AI's page (chrome.scripting, MAIN world): self-contained, returns the raw bodies.
async function fetchInPage(provider: string, geminiRpc: string): Promise<Body[]> {
  const out: Body[] = [];
  const text = async (response: Response) => (response.ok ? response.text() : '');
  if (provider === 'chatgpt') {
    const session = await fetch('/api/auth/session', { credentials: 'include', headers: { accept: 'application/json' } }).then(r => r.json()).catch(() => null);
    const token = session && session.accessToken;
    if (!token) return out;
    const headers = { authorization: `Bearer ${token}`, accept: 'application/json' };
    out.push({ kind: 'chatgpt-wham', text: await fetch('/backend-api/wham/usage', { credentials: 'include', headers }).then(text).catch(() => '') });
    out.push({ kind: 'chatgpt-features', text: await fetch('/backend-api/conversation/init', { method: 'POST', credentials: 'include', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ gizmo_id: null, requested_default_model: null, conversation_id: null, timezone_offset_min: new Date().getTimezoneOffset() }) }).then(text).catch(() => '') });
  } else if (provider === 'claude') {
    const orgs = await fetch('/api/organizations', { credentials: 'include', headers: { accept: 'application/json' } }).then(r => (r.ok ? r.json() : [])).catch(() => []);
    const org = Array.isArray(orgs) ? orgs.find((o: any) => Array.isArray(o?.capabilities) && o.capabilities.includes('chat')) || orgs[0] : undefined;
    const id = org && (org.uuid || org.id);
    if (!id) return out;
    out.push({ kind: 'claude-usage', text: await fetch(`/api/organizations/${encodeURIComponent(id)}/usage`, { credentials: 'include', headers: { accept: 'application/json' } }).then(text).catch(() => '') });
  } else if (provider === 'gemini') {
    const wiz = (window as any).WIZ_global_data || {};
    if (!wiz.SNlM0e) return out;
    const prefix = (location.pathname.match(/^\/u\/\d+(?=\/|$)/) || [''])[0];
    const query = new URLSearchParams({ rpcids: geminiRpc, 'source-path': '/app', bl: wiz.cfb2h || '', 'f.sid': wiz.FdrFJe || '', hl: document.documentElement.lang || 'en', _reqid: String(Math.floor(Math.random() * 900000) + 100000), rt: 'c' });
    const body = new URLSearchParams({ 'f.req': JSON.stringify([[[geminiRpc, JSON.stringify([[[1, 2]]]), null, 'generic']]]), at: wiz.SNlM0e });
    out.push({ kind: 'gemini-quota', text: await fetch(`${prefix}/_/BardChatUi/data/batchexecute?${query}`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', 'x-same-domain': '1' }, body }).then(text).catch(() => '') });
  }
  return out;
}

const origins: Record<string, string> = { chatgpt: 'https://chatgpt.com', claude: 'https://claude.ai', gemini: 'https://gemini.google.com' };

/** Reads usage for one AI; returns the parsed readings (empty when signed out or nothing came back). */
export async function fetchUsage(provider: ProviderId, now = Date.now()): Promise<UsageWindow[]> {
  if (!apiProviders.includes(provider)) return [];
  // Any loaded tab of that AI will do, even one still finishing (the refresh fires as a chat page opens).
  const tabs = await chrome.tabs.query({ url: `${origins[provider]}/*` }).catch(() => [] as chrome.tabs.Tab[]);
  let bodies: Body[] = [];
  for (const tab of tabs.filter(tab => tab.id !== undefined && !tab.discarded).slice(0, 2)) {
    try {
      const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id! }, world: 'MAIN', func: fetchInPage, args: [provider, GEMINI_QUOTA_RPC] });
      bodies = (result?.result as Body[] | undefined) || [];
    } catch { bodies = []; }
    if (bodies.some(body => body.text)) break;
  }
  // No open tab (or it couldn't answer): ChatGPT and Claude also answer the background with the browser's sign-in.
  if (!bodies.some(body => body.text) && provider !== 'gemini') bodies = await fetchFromBackground(provider);
  return bodies.flatMap(body => (body.text ? parseUsageResponse(body.kind, body.text, now) : []));
}

async function fetchFromBackground(provider: ProviderId): Promise<Body[]> {
  const base = origins[provider];
  const get = (path: string, init: RequestInit = {}) => fetch(base + path, { credentials: 'include', cache: 'no-store', ...init, headers: { accept: 'application/json', ...(init.headers || {}) } });
  try {
    if (provider === 'chatgpt') {
      const session = await get('/api/auth/session').then(r => (r.ok ? r.json() : null)).catch(() => null);
      const token = session?.accessToken;
      if (typeof token !== 'string' || !token) return [];
      const auth = { authorization: `Bearer ${token}` };
      const [wham, init] = await Promise.all([
        get('/backend-api/wham/usage', { headers: auth }).then(r => (r.ok ? r.text() : '')).catch(() => ''),
        get('/backend-api/conversation/init', { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ gizmo_id: null, requested_default_model: null, conversation_id: null, timezone_offset_min: new Date().getTimezoneOffset() }) }).then(r => (r.ok ? r.text() : '')).catch(() => '')
      ]);
      return [{ kind: 'chatgpt-wham', text: wham }, { kind: 'chatgpt-features', text: init }];
    }
    const orgs = await get('/api/organizations').then(r => (r.ok ? r.json() : [])).catch(() => []);
    const org = Array.isArray(orgs) ? orgs.find((o: any) => Array.isArray(o?.capabilities) && o.capabilities.includes('chat')) || orgs[0] : undefined;
    const id = org?.uuid || org?.id;
    if (!id) return [];
    return [{ kind: 'claude-usage', text: await get(`/api/organizations/${encodeURIComponent(id)}/usage`).then(r => (r.ok ? r.text() : '')).catch(() => '') }];
  } catch { return []; }
}
