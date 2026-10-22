import { defineContentScript } from 'wxt/utils/define-content-script';
import { usageKindOf } from '../src/core/usage-kind';

// Usage tap: runs in the page's own context on ChatGPT, Claude and Gemini, before their scripts. When the site fetches
// its own usage (ChatGPT's allowances and Codex/Work windows, Claude's usage meter, Gemini's quota), Baton reads a copy
// of that one response; the page gets the original untouched. Nothing else is read, and nothing leaves the browser:
// the copy goes to Baton's content script on the same page.
export default defineContentScript({
  matches: ['https://chatgpt.com/*', 'https://claude.ai/*', 'https://gemini.google.com/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    const tagged = window as unknown as { __batonUsageTap?: boolean };
    if (tagged.__batonUsageTap) return;
    tagged.__batonUsageTap = true;
    const limit = 400000;
    const post = (kind: string, text: string) => { if (text && text.length <= limit) window.postMessage({ source: 'baton-usage-tap', kind, text }, location.origin); };

    const originalFetch = window.fetch;
    window.fetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
      const result = originalFetch.apply(this, [input, init] as Parameters<typeof fetch>);
      try {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href).href;
        const kind = usageKindOf(url);
        if (kind) void result.then(response => { if (response.ok) void response.clone().text().then(text => post(kind, text)).catch(() => {}); }).catch(() => {});
      } catch { /* Never get in the page's way. */ }
      return result;
    } as typeof fetch;

    // Gemini calls batchexecute through XMLHttpRequest.
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
      try {
        const kind = usageKindOf(new URL(String(url), location.href).href);
        if (kind) this.addEventListener('load', () => { try { if (this.status >= 200 && this.status < 300 && (this.responseType === '' || this.responseType === 'text')) post(kind, this.responseText); } catch { /* ignore */ } });
      } catch { /* ignore */ }
      return (open as (...args: unknown[]) => void).apply(this, [method, url, ...rest]);
    } as typeof XMLHttpRequest.prototype.open;
  }
});
