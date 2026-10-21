import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { extract } from '../src/core/adapter';
import { bundledSelectors } from '../src/core/selectors';
const { JSDOM } = createRequire(import.meta.url)('jsdom') as typeof import('jsdom');

// Trimmed from a perplexity.ai search thread saved in Brave on 2026-10-22: questions sit in a right-hand bubble,
// answers in a “prose” block after a “Researched” step header that is not part of the answer.
const question = (text: string) => `<div class="min-w-0 whitespace-pre-wrap" data-message-bubble="right"><div><div data-renderer="lm"><p>${text}</p></div></div><span aria-hidden="true" hidden></span></div>`;
const answer = (text: string) => `<div data-workflow-final-text=""><div data-workflow-items="populated"><div title="Researched">Researched</div></div><div class="break-words"><div class="prose dark:prose-invert inline" data-renderer="lm"><p>${text}</p></div></div></div>`;
const page = `<nav><a>say hi</a></nav><main>${question('say hi')}${answer('Hi! How can I help today?')}${question('again')}${answer('Hi again! What would you like to do next?')}<div contenteditable="true" id="ask-input"></div></main>`;

describe('Perplexity capture', () => {
  it('reads questions as yours and answers as the assistant’s, without step headers or sidebar titles', () => {
    const doc = new JSDOM(page, { url: 'https://www.perplexity.ai/search/x' }).window.document;
    expect(extract(doc, 'perplexity', bundledSelectors).turns.map(turn => [turn.role, turn.text])).toEqual([
      ['user', 'say hi'], ['assistant', 'Hi! How can I help today?'], ['user', 'again'], ['assistant', 'Hi again! What would you like to do next?']
    ]);
  });
});
