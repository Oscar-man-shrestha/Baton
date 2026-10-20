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

function visibleClone(node: Element): Element {
  const clone = node.cloneNode(true) as Element;
  const originals = [node, ...Array.from(node.querySelectorAll('*'))];
  const copies = [clone, ...Array.from(clone.querySelectorAll('*'))];
  const getStyle = node.ownerDocument.defaultView?.getComputedStyle;
  if (getStyle) for (let i = originals.length - 1; i >= 0; i--) {
    const style = getStyle.call(node.ownerDocument.defaultView, originals[i]);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') copies[i].textContent = '';
  }
  clone.querySelectorAll('script,style,button,input,textarea,[hidden],[aria-hidden="true"], [style*="display:none"], [style*="display: none"], [style*="visibility:hidden"]').forEach(e => e.remove());
  return clone;
}

export function cleanNode(node: Element): string {
  const clone = visibleClone(node);
  const codeBlocks: string[] = [];
  const text = (current: Node): string => {
    if (current.nodeType === 3) return current.textContent || '';
    if (current.nodeType !== 1) return '';
    const element = current as Element;
    if (element.tagName === 'BR') return '\n';
    const children = Array.from(current.childNodes).map(text).join('');
    if (element.tagName === 'PRE') {
      const index = codeBlocks.push(children.replace(/[\u200B-\u200F\u2060\uFEFF]/g, '').replace(/\r\n?/g, '\n').trimEnd()) - 1;
      return `\n\uFFF0${index}\uFFF1\n`;
    }
    if (/^(P|DIV|LI|H[1-6]|BLOCKQUOTE)$/.test(element.tagName) && current !== clone) return `${children}\n`;
    return children;
  };
  return text(clone).replace(/[\u200B-\u200F\u2060\uFEFF]/g, '').replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim().replace(/\uFFF0(\d+)\uFFF1/g, (_, index: string) => codeBlocks[Number(index)] || '');
}

function cleanArtifact(node: Element): string {
  const clone = visibleClone(node);
  clone.querySelectorAll('button').forEach(e => e.remove());
  return (clone.textContent || '').replace(/[\u200B-\u200F\u2060\uFEFF]/g, '').trim();
}

export function makeAdapter(id: ProviderId, bundle: SelectorBundle): ProviderAdapter {
  const s = bundle.providers[id];
  const first = (doc: Document, selectors: string[]) => selectors.map(q => doc.querySelector(q)).find(Boolean) as Element | undefined;
  return {
    id, selectorsVersion: bundle.version, windowHours: id === 'claude' || id === 'gemini' ? 5 : undefined,
    extractTurns(doc) {
      const nodes = s.turns.flatMap(q => Array.from(doc.querySelectorAll(q)));
      const ordered = [...new Set(nodes)].sort((a, b) => a === b ? 0 : a.compareDocumentPosition(b) & 4 ? -1 : 1);
      return ordered.map((node, index) => ({
        role: node.matches('[data-message-author-role="user"], [data-testid="user-message"], [data-testid*="-user"], user-query, [class*="user"]') ? 'user' as const : 'assistant' as const,
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
      if (editor.tagName === 'TEXTAREA') {
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(editor), 'value')?.set;
        if (setter) setter.call(editor, text);
        else (editor as HTMLTextAreaElement).value = text;
      } else if (editor.getAttribute('contenteditable') === 'true') {
        const selection = doc.getSelection();
        const range = doc.createRange();
        range.selectNodeContents(editor);
        selection?.removeAllRanges();
        selection?.addRange(range);
        const inserted = typeof doc.execCommand === 'function' && doc.execCommand('insertText', false, text);
        if (!inserted) editor.textContent = text;
      } else return false;
      const EventClass = (doc.defaultView as (Window & typeof globalThis) | null)?.InputEvent ?? InputEvent;
      const event = new EventClass('input', { bubbles: true, inputType: 'insertText', data: text });
      editor.dispatchEvent(event);
      return (editor.tagName === 'TEXTAREA' ? (editor as HTMLTextAreaElement).value : editor.textContent) === text;
    },
    detectLimit(doc) {
      const notices = Array.from(doc.querySelectorAll('[role="alert"], [aria-live="assertive"], [data-testid*="limit"], [class*="usage-limit"]'));
      const match = notices.map(cleanNode).find(text => /(?:usage limit|quota|limit reached|approaching.{0,25}limit|try again in|(?:usage|free|message).{0,80}(?:\b\d{1,3}\s*%\s*(?:remaining|left)|\b(?:remaining|left)\s*:?\s*\d{1,3}\s*%|\b\d[\d,]*\s+tokens?\s+(?:remaining|left)))/i.test(text));
      return match ? { kind: 'banner', text: match.slice(0, 240) } : { kind: 'unknown', text: '' };
    }
  };
}

export function extract(doc: Document, id: ProviderId, bundle: SelectorBundle): Extraction {
  const adapter = makeAdapter(id, bundle);
  const turns = adapter.extractTurns(doc);
  const turnNodes = bundle.providers[id].turns.flatMap(selector => Array.from(doc.querySelectorAll(selector)));
  const hiddenInstruction = turnNodes.some(turn => [turn, ...Array.from(turn.querySelectorAll('*'))].some(node => {
    const style = doc.defaultView?.getComputedStyle(node);
    const hidden = node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true' || style?.display === 'none' || style?.visibility === 'hidden' || style?.opacity === '0';
    return hidden && /ignore (?:all|previous) instructions|system prompt|developer message/i.test(node.textContent || '');
  }));
  const warnings = [turns.length === 0 ? 'No visible turns found. Use plain-text fallback; older virtualized turns may be missing.' : '', hiddenInstruction ? 'Instruction-like hidden text was removed from the capture. Review the brief.' : ''].filter(Boolean);
  return { provider: id, turns, artifacts: adapter.extractArtifacts(doc), incomplete: turns.length === 0, warning: warnings.join(' ') || undefined };
}
