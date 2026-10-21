import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { extract } from '../src/core/adapter';
import { bundledSelectors } from '../src/core/selectors';
const { JSDOM } = createRequire(import.meta.url)('jsdom') as typeof import('jsdom');

// Trimmed from a grok.com chat saved in Brave on 2026-10-22: the whole app sits inside “group/sidebar-wrapper”,
// and each message starts with a hidden heading marked data-no-copy.
const turn = (role: 'user' | 'assistant', text: string) => `<div class="items-${role === 'user' ? 'end' : 'start'}"><div role="article" data-testid="${role}-message" class="message-bubble"><h2 class="sr-only" data-no-copy="true">${role === 'user' ? 'You' : 'Grok'}</h2><div class="response-content-markdown markdown"><p>${text}</p></div></div><div role="group" class="action-buttons"><button aria-label="Copy">Copy</button></div></div>`;
const page = (sidebar: string) => `<div class="group/sidebar-wrapper flex flex-col h-svh w-full isolate">${sidebar}<main class="sidebar-inset"><div data-testid="chat-transcript-scroller">${turn('user', 'how to know grok free limit')}${turn('assistant', 'You get a message when you hit the limit.')}${turn('user', 'hey')}${turn('assistant', 'Hey! What’s up?')}</div><div data-testid="chat-input"><div contenteditable="true" class="tiptap ProseMirror"></div></div></main></div>`;

describe('Grok capture', () => {
  it('reads messages inside the app’s sidebar wrapper, without the hidden “You” heading', () => {
    const doc = new JSDOM(page(''), { url: 'https://grok.com/c/x' }).window.document;
    expect(extract(doc, 'grok', bundledSelectors).turns.map(turn => [turn.role, turn.text])).toEqual([
      ['user', 'how to know grok free limit'], ['assistant', 'You get a message when you hit the limit.'], ['user', 'hey'], ['assistant', 'Hey! What’s up?']
    ]);
  });
  it('still skips a real sidebar', () => {
    const sidebar = '<div class="sidebar flex"><div data-testid="sidebar-message">Old chat title</div></div>';
    const doc = new JSDOM(page(sidebar), { url: 'https://grok.com/c/x' }).window.document;
    expect(extract(doc, 'grok', bundledSelectors).turns.some(turn => turn.text.includes('Old chat title'))).toBe(false);
  });
});

import { findEditor, makeAdapter } from '../src/core/adapter';
describe('Grok composer', () => {
  // grok.com keeps a hidden, empty textarea next to its real editor; the first selector used to pick it.
  const composer = '<textarea class="hidden" aria-hidden="true"></textarea><div data-testid="chat-input"><div contenteditable="true" class="tiptap ProseMirror"><p>an</p></div></div>';
  it('uses the visible editor, or the one the key press came from', () => {
    const doc = new JSDOM(page('') + composer, { url: 'https://grok.com/c/x' }).window.document;
    const real = doc.querySelectorAll('[contenteditable="true"]')[1] as HTMLElement;
    expect(findEditor(doc, bundledSelectors.providers.grok.editor)).toBe(doc.querySelector('[contenteditable="true"]'));
    expect(findEditor(doc, bundledSelectors.providers.grok.editor, real.firstChild)).toBe(real);
    expect(findEditor(doc, bundledSelectors.providers.grok.editor)?.tagName).not.toBe('TEXTAREA');
  });
  it('inserts a draft into the real editor, not the hidden textarea', () => {
    const doc = new JSDOM(`<main>${composer}</main>`, { url: 'https://grok.com/' }).window.document;
    makeAdapter('grok', bundledSelectors).injectDraft(doc, 'Continue my project');
    expect((doc.querySelector('textarea') as HTMLTextAreaElement).value).toBe('');
    expect(doc.querySelector('[contenteditable="true"]')?.textContent).toContain('Continue my project');
  });
});

describe('Grok message identity', () => {
  it('uses Grok’s turn-heading id, so the same text sent twice is two messages', () => {
    const msg = (uuid: string) => `<div role="article" aria-labelledby="turn-heading-${uuid}" data-testid="user-message"><h2 id="turn-heading-${uuid}" class="sr-only" data-no-copy="true">You</h2><p>ok</p></div>`;
    const doc = new JSDOM(`<div class="group/sidebar-wrapper">${msg('a1')}${msg('b2')}</div>`, { url: 'https://grok.com/c/x' }).window.document;
    expect(extract(doc, 'grok', bundledSelectors).turns.map(turn => turn.id)).toEqual(['user:turn-heading-a1', 'user:turn-heading-b2']);
  });
});
