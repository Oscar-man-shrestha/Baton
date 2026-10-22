import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { extract, findEditor } from '../src/core/adapter';
import { bundledSelectors } from '../src/core/selectors';
const { JSDOM } = createRequire(import.meta.url)('jsdom') as typeof import('jsdom');

// Trimmed from a chatgpt.com conversation saved in Brave on 2026-10-22. ChatGPT no longer uses
// data-message-author-role; message units are keyed “…:user” / “…:assistant” and open with a hidden heading.
const user = (turn: number, id: string, text: string) => `<h4 class="sr-only">You said:</h4><div class="group/user-message" data-chatgpt-search-unit-key="fallback-turn-${turn}:0:user" data-chatgpt-search-message-ids="${id}"><div data-user-message-bubble="true"><div class="whitespace-pre-wrap">${text}</div></div><div class="turn-actions"><button aria-label="Copy">Copy</button></div></div>`;
const assistant = (turn: number, id: string, text: string) => `<div data-content-search-unit-key="fallback-turn-${turn}:1:assistant" data-chatgpt-search-unit-key="fallback-turn-${turn}:1:assistant" data-chatgpt-search-message-ids="${id} ${id}"><h4 class="sr-only" data-conversation-role="assistant">ChatGPT said:</h4><div data-chatgpt-selection-message-id="${id}"><div data-markdown-text-style="assistant-message"><p>${text}</p></div></div></div>`;
const page = `<main>${user(16, 'u1', 'hi')}${assistant(16, 'a1', 'Hey! How’s it going?')}${user(17, 'u2', 'hi')}${assistant(17, 'a2', 'Hi!')}</main><div data-chatgpt-composer><div contenteditable="true" role="textbox" class="ProseMirror" aria-label="Ask ChatGPT"><p data-placeholder="Ask ChatGPT" class="placeholder"><br></p></div></div>`;

describe('ChatGPT capture (Oct 2026 layout)', () => {
  const doc = new JSDOM(page, { url: 'https://chatgpt.com/c/x' }).window.document;
  it('reads messages with roles, without the hidden “You said:” / “ChatGPT said:” headings', () => {
    expect(extract(doc, 'chatgpt', bundledSelectors).turns.map(turn => [turn.role, turn.text])).toEqual([['user', 'hi'], ['assistant', 'Hey! How’s it going?'], ['user', 'hi'], ['assistant', 'Hi!']]);
  });
  it('gives two identical messages different ids, so both are counted', () => {
    expect(extract(doc, 'chatgpt', bundledSelectors).turns.filter(turn => turn.role === 'user').map(turn => turn.id)).toEqual(['user:u1', 'user:u2']);
  });
  it('finds the composer without #prompt-textarea', () => {
    expect(findEditor(doc, bundledSelectors.providers.chatgpt.editor)?.getAttribute('aria-label')).toBe('Ask ChatGPT');
  });
});
