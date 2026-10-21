import type { ProviderId, SelectorBundle } from './selectors';
import { messageMarkdown } from './markdown';

export type Turn = { role: 'user' | 'assistant'; text: string; index: number; id?: string };
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

function hiddenByAncestor(node: Element): boolean {
  for (let element: Element | null = node; element; element = element.parentElement) {
    if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') return true;
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    if (style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse' || style?.opacity === '0') return true;
  }
  return false;
}

function visibleClone(node: Element): Element {
  const clone = node.cloneNode(true) as Element;
  if (hiddenByAncestor(node)) { clone.textContent = ''; return clone; }
  const originals = [node, ...Array.from(node.querySelectorAll('*'))];
  const copies = [clone, ...Array.from(clone.querySelectorAll('*'))];
  const getStyle = node.ownerDocument.defaultView?.getComputedStyle;
  if (getStyle) for (let i = originals.length - 1; i >= 0; i--) {
    const style = getStyle.call(node.ownerDocument.defaultView, originals[i]);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') copies[i].textContent = '';
  }
  clone.querySelectorAll('input[type="checkbox"]').forEach(input => input.replaceWith(clone.ownerDocument.createTextNode(input.hasAttribute('checked') ? '[x] ' : '[ ] ')));
  // data-no-copy marks page chrome inside a message, such as Grok's hidden “You” heading.
  clone.querySelectorAll('script,style,button,svg,input,textarea,[hidden],[aria-hidden="true"],[data-no-copy="true"], [style*="display:none"], [style*="display: none"], [style*="visibility:hidden"]').forEach(e => e.remove());
  return clone;
}

/**
 * The composer the user is using: the one holding the event target or focus, else a visible one.
 * Some pages keep a hidden, empty textarea next to the real editor (Grok), so “first match” is not enough.
 */
export function findEditor(doc: Document, selectors: string[], target?: Node | null): HTMLElement | undefined {
  const within = (node: Node | null | undefined) => { const element = node?.nodeType === 1 ? node as Element : node?.parentElement; for (const selector of selectors) { const hit = element?.closest(selector); if (hit) return hit as HTMLElement; } return undefined; };
  const direct = within(target) || within(doc.activeElement);
  if (direct) return direct;
  const all = selectors.flatMap(selector => Array.from(doc.querySelectorAll<HTMLElement>(selector)));
  const shown = all.filter(element => !hiddenByAncestor(element) && !element.closest('.hidden, .sr-only'));
  return shown.find(element => element.getClientRects().length > 0) || shown[0] || all[0];
}

export function cleanNode(node: Element): string {
  return messageMarkdown(visibleClone(node));
}

function messageContent(node: Element, id: ProviderId): Element {
  if (id === 'deepseek') return node.querySelector('.ds-markdown') || node;
  if (id === 'gemini') {
    const selectors = node.matches('user-query')
      ? ['.query-text', '[class*="query-text"]', '.query-content', '[class*="query-content"]']
      : ['.model-response-text', 'message-content', '.markdown', '[class*="response-content"]', '.response-container'];
    for (const selector of selectors) {
      const content = Array.from(node.querySelectorAll(selector)).find(element => !hiddenByAncestor(element));
      if (content) return content;
    }
    return node;
  }
  if (id === 'claude') return node.querySelector('.standard-markdown, .progressive-markdown') || node;
  return node;
}

function cleanTurn(node: Element, id: ProviderId): string {
  const content = messageContent(node, id);
  let result = cleanNode(content);
  if (id === 'gemini' && node.matches('user-query')) {
    const duplicate = result.match(/^#{1,6}\s+You said\b[ \t]*(.*?)\n+([\s\S]*)$/i);
    if (duplicate && (duplicate[1].trim() === duplicate[2].trim() || repeatsPreview(duplicate[1], duplicate[2]))) return duplicate[2].trim();
  }
  if (id === 'gemini' && content === node) {
    result = result.replace(/^(?:#{1,6}\s*)?(?:You|Gemini) said\b[ \t]*:?[ \t]*(?:\n)?/i, '').trim();
    const lines = result.split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length === 2 && lines[0].replace(/^You said\s*:?\s*/i, '') === lines[1]) result = lines[1];
    else if (lines.length > 1 && repeatsPreview(lines[0], lines.slice(1).join(' '))) result = result.slice(result.indexOf('\n')).trim();
  }
  return result;
}

/** Gemini's hidden heading previews the prompt and cuts it off with an ellipsis. */
function repeatsPreview(preview: string, body: string): boolean {
  const flat = (text: string) => text.replace(/\s+/g, ' ').trim();
  const shown = flat(preview.replace(/(?:\.{3}|…)$/, ''));
  return /(?:\.{3}|…)$/.test(preview.trim()) && shown.length >= 8 && flat(body).startsWith(shown);
}

function cleanArtifact(node: Element): string {
  const clone = visibleClone(node);
  clone.querySelectorAll('button').forEach(e => e.remove());
  return (clone.textContent || '').replace(/[\u200B-\u200F\u2060\uFEFF]/g, '').trim();
}

// A real sidebar, not a layout wrapper: Grok wraps its whole app in “group/sidebar-wrapper”.
function inSidebar(node: Element): boolean {
  for (let element: Element | null = node.parentElement; element; element = element.parentElement) {
    const tokens = (element.getAttribute('class') || '').split(/\s+/).filter(token => /sidebar/i.test(token));
    if (tokens.some(token => !/wrapper|inset|provider|layout|container|trigger|rail/i.test(token))) return true;
  }
  return false;
}

export function collectTurnNodes(doc: Document, id: ProviderId, bundle: SelectorBundle): Element[] {
  const selectors = bundle.providers[id].turns;
  const scopedRoot = id === 'deepseek' ? doc.querySelector('main, [role="main"]') : null;
  const collect = (root: Document | Element) => selectors.flatMap(selector => Array.from(root.querySelectorAll(selector)));
  const nodes = collect(scopedRoot || doc);
  if (id === 'claude') nodes.push(...Array.from(doc.querySelectorAll('.font-user-message, [data-testid="human-message"], [data-testid="message-human"], [data-testid="ai-message"], [data-testid="assistant-message"], [data-testid="message-assistant"], .font-claude-message')));
  const fallback = scopedRoot && nodes.length === 0 ? collect(doc) : nodes;
  const allowed = [...new Set(fallback)].filter(node => !node.closest('nav, aside, [role="navigation"], [id*="sidebar" i]') && !inSidebar(node));
  const preferred = id === 'deepseek' && allowed.some(node => node.matches('.ds-message')) ? allowed.filter(node => node.matches('.ds-message')) : allowed;
  const candidates = new Set(preferred);
  return preferred.filter(node => {
    for (let parent = node.parentElement; parent; parent = parent.parentElement) if (candidates.has(parent)) return false;
    return true;
  }).sort((a, b) => a === b ? 0 : a.compareDocumentPosition(b) & 4 ? -1 : 1);
}

function turnRole(node: Element, id: ProviderId): Turn['role'] {
  const explicit = node.getAttribute('data-message-author-role') || node.getAttribute('data-role');
  if (explicit === 'user' || explicit === 'assistant') return explicit;
  if (id === 'deepseek') {
    if (node.matches('[class*="user" i], [class*="human" i]')) return 'user';
    if (node.matches('[class*="assistant" i], [class*="agent" i]') || node.querySelector('.ds-markdown')) return 'assistant';
    return 'user';
  }
  if (id === 'claude') return node.matches('.font-user-message, [data-testid="user-message"], [data-testid="human-message"], [data-testid="message-human"]') ? 'user' : 'assistant';
  return node.matches('[data-testid="user-message"], [data-testid*="-user"], user-query, [class*="user"]') ? 'user' : 'assistant';
}

function messageIdentity(node: Element, role: Turn['role']): string | undefined {
  const own = node.getAttribute('data-message-id') || node.getAttribute('data-turn-id') || node.getAttribute('data-message-uuid');
  if (own) return `${role}:${own}`;
  const turn = node.closest('[data-turn-id], [data-turn-id-container]');
  const turnId = turn?.getAttribute('data-turn-id') || turn?.getAttribute('data-turn-id-container');
  if (turnId) return `${role}:${turnId}`;
  // Gemini commonly uses stable query/response element IDs; avoid generic container IDs.
  if (/^(?:user-query|model-response)$/.test(node.tagName.toLowerCase()) && node.id) return `${role}:${node.id}`;
  return undefined;
}

export function makeAdapter(id: ProviderId, bundle: SelectorBundle): ProviderAdapter {
  const s = bundle.providers[id];
  return {
    id, selectorsVersion: bundle.version, windowHours: id === 'claude' || id === 'gemini' ? 5 : undefined,
    extractTurns(doc) {
      return collectTurnNodes(doc, id, bundle).map((node, index) => ({
        role: turnRole(node, id),
        text: cleanTurn(node, id), index,
        id: messageIdentity(node, turnRole(node, id))
      })).filter(t => t.text);
    },
    extractArtifacts(doc) {
      return s.artifacts.flatMap(q => Array.from(doc.querySelectorAll(q))).map((e, version) => ({ name: e.getAttribute('aria-label') || `Artifact ${version + 1}`, kind: 'visible DOM', content: cleanArtifact(e), version: version + 1 })).filter(a => a.content);
    },
    injectDraft(doc, text) {
      const editor = findEditor(doc, s.editor);
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
      const notices = Array.from(doc.querySelectorAll('[role="alert"], [aria-live="assertive"], [data-testid*="limit" i], [class*="usage-limit" i], [role="progressbar"]'));
      const turns = collectTurnNodes(doc, id, bundle);
      const match = notices.filter(node => !turns.some(turn => turn.contains(node)) && !node.closest('nav, aside, [role="navigation"], [contenteditable="true"], textarea, #handoff-composer-status')).map(node => {
        const label = node.getAttribute('aria-label') || '';
        const current = Number(node.getAttribute('aria-valuenow'));
        const maximum = Number(node.getAttribute('aria-valuemax'));
        const accessiblePercent = node.getAttribute('role') === 'progressbar' && node.hasAttribute('aria-valuenow') && /(?:usage|quota|session|weekly)/i.test(label) && Number.isFinite(current) && Number.isFinite(maximum) && maximum === 100 ? ` ${Math.round(current)}% used` : '';
        return `${label}${accessiblePercent} ${cleanNode(node)}`.trim();
      }).find(text => /(?:usage|quota|session|weekly|message|model|free).{0,90}(?:(?:\d{1,3}\s*%\s*(?:remaining|left|used|consumed))|(?:(?:remaining|left)\s*:?\s*\d{1,3}\s*%)|(?:\d[\d,]*\s+tokens?\s+(?:remaining|left))|(?:limit\s+(?:reached|exceeded)))|(?:limit reached|quota exceeded|(?:close to|approaching|almost at).{0,35}(?:usage|message|limit|quota))/i.test(text));
      if (match) return { kind: 'banner', text: match.slice(0, 240) };
      // Many services print the limit as plain text beside the composer. Accept only short, visible, strict wording
      // outside conversation turns, navigation, the editor and other extensions.
      const reached = /(?:you(?:'|’)?ve|you have|you(?:'|’)?re|you are)\s+(?:reached|hit|run out of|out of)\b[^.]{0,60}?(?:limit|cap|messages)|(?:usage|message|rate)\s+limit\s+(?:reached|exceeded)/i;
      const walker = doc.createTreeWalker(doc.body, 4);
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        const value = (text.nodeValue || '').trim();
        if (value.length > 240 || !reached.test(value)) continue;
        const element = text.parentElement;
        if (!element || turns.some(turn => turn.contains(element)) || element.closest('nav, aside, [role="navigation"], [contenteditable="true"], textarea, [id^="handoff-"], [data-extension]') || hiddenByAncestor(element)) continue;
        let block: Element = element;
        for (let parent = element.parentElement, depth = 0; parent && depth < 3 && !parent.matches('main, body') && cleanNode(parent).length <= 300 && !turns.some(turn => parent!.contains(turn)); parent = parent.parentElement, depth++) block = parent;
        return { kind: 'banner', text: cleanNode(block).replace(/\s+/g, ' ').slice(0, 300) };
      }
      // On Claude's own usage screen, read only a labeled value that the user can see.
      if (id === 'claude' && /^\/settings\/usage\/?$/.test(doc.location.pathname)) {
        const main = doc.querySelector('main, [role="main"]');
        const visible = main ? cleanNode(main).slice(0, 5000) : '';
        const session = visible.match(/(?:current\s+session|5.hour\s+session|session\s+usage)\s*[:\n ]*\s*(\d{1,3})\s*%\s*(?:used|consumed)?/i);
        if (session && Number(session[1]) <= 100) return { kind: 'banner', text: `Session usage ${session[1]}% used (shown on Claude usage page)` };
      }
      return { kind: 'unknown', text: '' };
    }
  };
}

export function extract(doc: Document, id: ProviderId, bundle: SelectorBundle): Extraction {
  const adapter = makeAdapter(id, bundle);
  const turns = adapter.extractTurns(doc);
  const turnNodes = collectTurnNodes(doc, id, bundle);
  const hiddenInstruction = turnNodes.some(turn => [turn, ...Array.from(turn.querySelectorAll('*'))].some(node => {
    const style = doc.defaultView?.getComputedStyle(node);
    const hidden = node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true' || style?.display === 'none' || style?.visibility === 'hidden' || style?.opacity === '0';
    return hidden && /ignore (?:all|previous) instructions|system prompt|developer message/i.test(node.textContent || '');
  }));
  const hasUserTurn = turns.some(turn => turn.role === 'user');
  const warnings = [turns.length === 0 ? 'No visible turns found. Use plain-text fallback; older virtualized turns may be missing.' : '', turns.length && !hasUserTurn ? 'No user message was captured. Choose older-message capture or paste the original request before continuing.' : '', hiddenInstruction ? 'Instruction-like hidden text was removed from the capture. Review the brief.' : ''].filter(Boolean);
  return { provider: id, turns, artifacts: adapter.extractArtifacts(doc), incomplete: turns.length === 0 || !hasUserTurn, warning: warnings.join(' ') || undefined };
}
