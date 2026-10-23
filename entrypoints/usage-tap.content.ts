import { defineContentScript } from 'wxt/utils/define-content-script';
import { connectFrames, frameShape, isClaudeTimelineStream, timelineUsage, timelineUsageJson } from '../src/core/claude-timeline';
import { isClaudeReplyStream, usageKindOf } from '../src/core/usage-kind';

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

    const scanClaudeStream = async (body: ReadableStream<Uint8Array>) => {
      let sseEvents = 0, sseLimits = 0;
      const reader = body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          for (let cut = buffer.indexOf('\n\n'); cut !== -1; cut = buffer.indexOf('\n\n')) {
            const data = buffer.slice(0, cut).split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
            buffer = buffer.slice(cut + 2);
            sseEvents++;
            if (!data.includes('message_limit')) continue;
            sseLimits++;
            try { const event = JSON.parse(data); if (event && event.message_limit) post('claude-usage', JSON.stringify({ message_limit: event.message_limit })); } catch { /* partial */ }
          }
        }
      } catch { /* stream closed */ }
      post('claude-stream', JSON.stringify({ stream: 'reply', events: sseEvents, limitEvents: sseLimits }));
    };
    // Claude's newer transport: Connect frames on StreamTimeline, open for long stretches. Only usage reports are kept.
    const gunzip = async (data: Uint8Array) => new Uint8Array(await new Response(new Blob([data.slice() as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    // What a Claude stream carried, for Baton's usage panel: counts and field numbers only, never content.
    let reportedAt = 0;
    const report = (stats: Record<string, unknown>, force = false) => { if (force || Date.now() - reportedAt > 5000) { reportedAt = Date.now(); post('claude-stream', JSON.stringify(stats)); } };
    const scanClaudeTimeline = async (body: ReadableStream<Uint8Array>, json: boolean) => {
      const reader = body.getReader(); let buffer = new Uint8Array();
      const stats = { stream: 'timeline', json, frames: 0, usage: 0, shapes: [] as string[] };
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const joined = new Uint8Array(buffer.length + value.length); joined.set(buffer); joined.set(value, buffer.length);
          const { frames, rest, tooBig } = connectFrames(joined);
          if (tooBig) { void reader.cancel().catch(() => {}); return; }
          buffer = rest.slice();
          for (const frame of frames) {
            if (frame.flags & 2) continue;
            const payload = frame.flags & 1 ? await gunzip(frame.payload).catch(() => undefined) : frame.payload;
            if (!payload) continue;
            const usage = json ? timelineUsageJson(new TextDecoder().decode(payload)) : timelineUsage(payload);
            stats.frames++;
            if (usage) { stats.usage++; post('claude-usage', JSON.stringify(usage)); }
            const shape = json ? 'json' : frameShape(payload);
            if (stats.shapes.length < 6 && !stats.shapes.includes(shape)) stats.shapes.push(shape);
          }
          report(stats);
        }
      } catch { /* stream closed */ }
      report(stats, true);
    };
    const originalFetch = window.fetch;
    window.fetch = function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
      const result = originalFetch.apply(this, [input, init] as Parameters<typeof fetch>);
      try {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href).href;
        const kind = usageKindOf(url);
        if (kind) void result.then(response => { if (response.ok) void response.clone().text().then(text => post(kind, text)).catch(() => {}); }).catch(() => {});
        // Claude reports its usage inside each reply's stream. Only the message_limit event is passed on, never the reply.
        else if (isClaudeReplyStream(url)) void result.then(response => { if (response.ok && response.body) void scanClaudeStream(response.clone().body!); }).catch(() => {});
        else if (isClaudeTimelineStream(url)) void result.then(response => { if (response.ok && response.body) void scanClaudeTimeline(response.clone().body!, /json/i.test(response.headers.get('content-type') || '')); }).catch(() => {});
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
