import type { ProviderId, SelectorBundle } from './selectors';

export type Turn = { role: 'user' | 'assistant'; text: string; index: number };
export type Artifact = { name: string; kind: string; content: string; version: number };
export type Extraction = { provider: ProviderId; turns: Turn[]; artifacts: Artifact[]; incomplete: boolean; warning?: string };
export type LimitSignal = { kind: 'banner' | 'unknown'; text: string; resetAt?: number };
export interface ProviderAdapter {
  readonly id: ProviderId;
  readonly selectorsVersion: number;
  readonly windowHours?: number;
  extractTurns(doc: Document): Turn[];
  extractArtifacts(doc: Document): Artifact[];
  injectDraft(doc: Document, text: string): boolean;
  detectLimit(doc: Document): LimitSignal;
}

export function cleanNode(node: Element): string {
  const clone = node.cloneNode(true) as Element;
  clone.querySelectorAll('script,style,button,input,textarea,[hidden],[aria-hidden="true"], [style*="display:none"], [style*="display: none"], [style*="visibility:hidden"]').forEach(e => e.remove());
  return (clone.textContent || '').replace(/[\u200B-\u200F\u2060\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
}

function cleanArtifact(node: Element): string {
  const clone = node.cloneNode(true) as Element;
  clone.querySelectorAll('script,style,button,[hidden],[aria-hidden="true"], [style*="display:none"], [style*="display: none"]').forEach(e => e.remove());
  return (clone.textContent || '').replace(/[\u200B-\u200F\u2060\uFEFF]/g, '').trim();
}

export function makeAdapter(id: ProviderId, bundle: SelectorBundle): ProviderAdapter {
  const s = bundle.providers[id];
  const first = (doc: Document, selectors: string[]) => selectors.map(q => doc.querySelector(q)).find(Boolean) as Element | undefined;
  return {
    id, selectorsVersion: bundle.version, windowHours: id === 'claude' || id === 'gemini' ? 5 : undefined,
    extractTurns(doc) {
      const nodes = s.turns.flatMap(q => Array.from(doc.querySelectorAll(q)));
      return [...new Set(nodes)].map((node, index) => ({
        role: node.matches('[data-message-author-role="user"], [data-testid="user-message"], user-query, [class*="user"]') ? 'user' as const : 'assistant' as const,
        text: cleanNode(node), index
      })).filter(t => t.text);
    },
    extractArtifacts(doc) {
      return s.artifacts.flatMap(q => Array.from(doc.querySelectorAll(q))).map((e, version) => ({ name: e.getAttribute('aria-label') || `Artifact ${version + 1}`, kind: 'visible DOM', content: cleanArtifact(e), version: version + 1 })).filter(a => a.content);
    },
    injectDraft(doc, text) {
      const editor = first(doc, s.editor);
      if (!editor) return false;
      (editor as HTMLElement).focus();
      if (editor instanceof HTMLTextAreaElement) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        setter?.call(editor, text);
      } else { editor.textContent = text; }
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    },
    detectLimit(doc) {
      const notices = Array.from(doc.querySelectorAll('[role="alert"], [aria-live="assertive"], [data-testid*="limit"], [class*="usage-limit"]'));
      const match = notices.map(cleanNode).find(text => /(?:usage limit|quota|limit reached|approaching.{0,25}limit|try again in)/i.test(text));
      return match ? { kind: 'banner', text: match.slice(0, 240) } : { kind: 'unknown', text: '' };
    }
  };
}

export function extract(doc: Document, id: ProviderId, bundle: SelectorBundle): Extraction {
  const adapter = makeAdapter(id, bundle);
  const turns = adapter.extractTurns(doc);
  return { provider: id, turns, artifacts: adapter.extractArtifacts(doc), incomplete: turns.length === 0, warning: turns.length === 0 ? 'No visible turns found. Use plain-text fallback; older virtualized turns may be missing.' : undefined };
}
