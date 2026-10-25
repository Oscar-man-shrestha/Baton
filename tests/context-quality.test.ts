import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { cleanNode, extract } from '../src/core/adapter';
import { bundledSelectors } from '../src/core/selectors';
import { fullContext } from '../src/core/context-export';
import { selectEvidence } from '../src/core/extractive';
import { redact, updateBrief } from '../src/core/brief';
const { JSDOM } = createRequire(import.meta.url)('jsdom') as typeof import('jsdom');

describe('context fidelity', () => {
  it('preserves tables, links, checkboxes, nested lists, and code languages', () => {
    const doc = new JSDOM('<div><h2>Plan</h2><ul><li><input type="checkbox" checked>Save tasks<ul><li>Offline first</li></ul></li></ul><p>Read <a href="https://example.com/docs">the docs</a> and use <code>saveTask()</code>.</p><table><tr><th>Case</th><th>Result</th></tr><tr><td>Empty</td><td>No crash</td></tr></table><pre><code class="language-ts">const id = 1711902849000;\n  save(id);</code></pre><img alt="Task state diagram"></div>').window.document;
    const text = cleanNode(doc.querySelector('div')!);
    expect(text).toContain('[x] Save tasks');
    expect(text).toContain('  - Offline first');
    expect(text).toContain('[the docs](https://example.com/docs)');
    expect(text).toContain('`saveTask()`');
    expect(text).toContain('| Case | Result |\n| --- | --- |\n| Empty | No crash |');
    expect(text).toContain('```ts\nconst id = 1711902849000;\n  save(id);\n```');
    expect(text).toContain('[Image: Task state diagram]');
  });
  it('retains provider message identity without reading account data', () => {
    const doc = new JSDOM('<div data-message-author-role="user" data-message-id="u123">Plan my app</div>').window.document;
    expect(extract(doc, 'chatgpt', bundledSelectors).turns[0].id).toBe('user:u123');
  });
  it('prefers Gemini’s visible message body over a broad container and hidden duplicates', () => {
    const doc = new JSDOM('<user-query><div class="query-content"><div>You said Build my app</div><div hidden><div class="query-text">Hidden stale prompt</div></div><div class="query-text">Build my app</div></div></user-query>').window.document;
    expect(extract(doc, 'gemini', bundledSelectors).turns[0].text).toBe('Build my app');
  });
  it('preserves a literal speaker phrase typed by the user', () => {
    const doc = new JSDOM('<user-query><div class="query-text">You said this should work. Explain why.</div></user-query>').window.document;
    expect(extract(doc, 'gemini', bundledSelectors).turns[0].text).toBe('You said this should work. Explain why.');
  });
  it.each([false, true])('removes Gemini speaker headings and repeated prompts, broad wrapper: %s', broadWrapper => {
    const request = 'Hey I wanna make to do list beautiful that works in all edge cases';
    const user = `<h5>You said ${request}</h5><p>${request}</p>`;
    const doc = new JSDOM(`<user-query>${broadWrapper ? `<div class="query-content">${user}</div>` : user}</user-query><model-response><h6>Gemini said</h6><p>Keep every edge case.</p><pre><code>const tasks = [];</code></pre><p>Which platform should we use?</p></model-response>`).window.document;
    const turns = extract(doc, 'gemini', bundledSelectors).turns;
    expect(turns[0].text).toBe(request);
    expect(turns[1].text).not.toContain('Gemini said');
    expect(turns[1].text).toContain('const tasks = [];');
    expect(turns[1].text).toContain('Which platform should we use?');
  });
  it('captures Claude when primary user and alternate assistant wrappers coexist', () => {
    const doc = new JSDOM('<div data-testid="user-message">Build an app</div><div data-testid="assistant-message">Use a task reducer.</div>').window.document;
    expect(extract(doc, 'claude', bundledSelectors).turns.map(turn => turn.role)).toEqual(['user', 'assistant']);
  });
  it('keeps late sections of an answer instead of selecting only the beginning', () => {
    const text = `## Edge cases\n- Extremely long task names must wrap.\n- Rapid creation requires unique identifiers.\n- Empty states should reassure users.\n## Interface\n- Typography needs a readable hierarchy.\n- Use restrained colors and clear focus rings.\n## Features\n- Keyboard shortcuts support Enter and Escape.\n- Filtering separates active and completed tasks.`;
    const evidence = selectEvidence(text, 'Build a beautiful task app with edge cases', 250).join('\n');
    expect(evidence).toContain('Edge cases:');
    expect(evidence).toContain('Interface:');
    expect(evidence).toContain('Features:');
  });
  it('retains complete latest code as an artifact and does not ratify an unanswered technology question', () => {
    const brief = updateBrief(undefined, [{ role: 'user', text: 'Should I use React?', index: 0 }, { role: 'assistant', text: 'Use this:\n```js\nconst tasks = [];\n```', index: 1 }], []);
    expect(brief.decisions).toHaveLength(0);
    expect(brief.artifacts[0].content_verbatim).toBe('const tasks = [];');
  });
  it('exports every stored turn with coverage and redaction, without a compact-budget cut', () => {
    const text = `${'Detailed context. '.repeat(1000)}FINAL_REQUIREMENT`;
    const result = fullContext({ turns: [{ role: 'user', text, index: 0 }, { role: 'assistant', text: 'sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456', index: 1 }], incomplete: true, truncated: false, savedAt: 1 }, 'https://chatgpt.com/c/example?session=private');
    expect(result.text).toContain('FINAL_REQUIREMENT');
    expect(result.text).toContain('Some messages may be missing; check the order before relying on it.');
    expect(result.text).not.toContain('session=private');
    expect(result.text).not.toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(result.tokens).toBeGreaterThan(1500);
  });
  it('does not mistake code timestamps and dates for phone numbers', () => {
    const result = redact('createdAt: 1711902849000; due: 2026-10-25; call +14155552671');
    expect(result.text).toContain('1711902849000');
    expect(result.text).toContain('2026-10-25');
    expect(result.text).not.toContain('+14155552671');
  });
});
