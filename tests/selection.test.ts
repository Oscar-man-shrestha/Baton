import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { bundledSelectors } from '../src/core/selectors';
import { selectedTurns } from '../src/core/adapter';
import { saveSelectionCapsule } from '../src/core/capsules';
import { listProjects } from '../src/core/projects';
import { selectionName, selectionSummary } from '../src/core/selection';
import { fillShortcutList, formatShortcut, manifestCommands, pageCommands, shortcutCommands, shortcutRows } from '../src/core/shortcuts';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as typeof import('jsdom');

const chat = () => new JSDOM(`<main>
  <div data-message-author-role="user"><p id="q">Plan a trip to Japan in spring</p></div>
  <div data-message-author-role="assistant"><p id="a1">Go in early April for cherry blossoms.<span hidden>secret</span></p><p id="a2">Book the rail pass before you leave.</p></div>
  <div data-message-author-role="user"><p id="q2">Now help me with my CV</p></div>
</main><footer id="outside">Terms of use</footer>`).window.document;

describe('saving a selection as a baton', () => {
  it('keeps whole messages that are fully selected and only the selected words of the others', () => {
    const doc = chat();
    const range = doc.createRange();
    range.setStart(doc.querySelector('#q')!, 0);
    range.setEnd(doc.querySelector('#a1')!.firstChild!, 'Go in early April'.length);
    expect(selectedTurns(doc, 'chatgpt', bundledSelectors, range).map(({ role, text }) => ({ role, text }))).toEqual([
      { role: 'user', text: 'Plan a trip to Japan in spring' },
      { role: 'assistant', text: 'Go in early April' }
    ]);
  });
  it('leaves hidden text out of a partial selection and ignores text outside the chat', () => {
    const doc = chat();
    const range = doc.createRange();
    range.setStart(doc.querySelector('#a1')!.firstChild!, 'Go in '.length);
    range.setEnd(doc.querySelector('#a2')!.firstChild!, 'Book the rail pass'.length);
    const [turn] = selectedTurns(doc, 'chatgpt', bundledSelectors, range);
    expect(turn.text).toContain('early April for cherry blossoms.');
    expect(turn.text).toContain('Book the rail pass');
    expect(turn.text).not.toContain('secret');
    expect(turn.text).not.toContain('before you leave');
    const outside = doc.createRange(); outside.selectNodeContents(doc.querySelector('#outside')!);
    expect(selectedTurns(doc, 'chatgpt', bundledSelectors, outside)).toEqual([]);
  });
  const sites = [
    ['chatgpt', '<div data-message-author-role="user">Plan my app</div>'],
    ['claude', '<div data-testid="user-message">Plan my app</div>'],
    ['gemini', '<user-query>Plan my app</user-query>'],
    ['deepseek', '<main><div class="ds-message">Plan my app</div></main>'],
    ['grok', '<div data-testid="message-user">Plan my app</div>'],
    ['perplexity', '<div data-testid="message-user">Plan my app</div>']
  ] as const;
  for (const [id, html] of sites) it(`reads a selection on ${id}`, () => {
    const doc = new JSDOM(html).window.document;
    const range = doc.createRange(); range.selectNodeContents(doc.body);
    expect(selectedTurns(doc, id, bundledSelectors, range).map(({ role, text }) => ({ role, text }))).toEqual([{ role: 'user', text: 'Plan my app' }]);
  });
  it('names the baton after the first words, preferring your own question', () => {
    expect(selectionName([{ role: 'assistant', text: 'Sure!', index: 0 }, { role: 'user', text: '## **Plan** a trip\nmore', index: 1 }])).toBe('Plan a trip');
    expect(selectionName([{ role: 'assistant', text: 'word '.repeat(30), index: 0 }])).toMatch(/^word( word)+…$/);
    expect(selectionName([{ role: 'assistant', text: 'word '.repeat(30), index: 0 }]).length).toBeLessThanOrEqual(61);
    expect(selectionName([])).toBe('Selected part of a chat');
    expect(selectionSummary([{ role: 'user', text: 'abc', index: 0 }])).toBe('1 message · 3 characters');
  });
  it('stores it like a captured chat, files it into an existing folder, and updates a repeated save', async () => {
    const store: Record<string, unknown> = { folders: ['Travel'] };
    vi.stubGlobal('chrome', { storage: { local: { get: async (key: string) => ({ [key]: store[key] }), set: async (value: object) => Object.assign(store, value) } } });
    try {
      const turns = [{ role: 'user' as const, text: 'Plan a trip to Japan', index: 0 }, { role: 'assistant' as const, text: 'Go in April. Contact me at me@example.com', index: 1 }];
      const first = await saveSelectionCapsule(turns, 'https://chatgpt.com/c/1', 'Japan trip', 'travel');
      expect(first.id).toMatch(/^selection:[0-9a-f]{64}$/);
      expect(first.folder).toBe('Travel');
      expect(first.draftMode).toBe('full');
      expect(first.snapshotText).toContain('# Selected part of a conversation');
      expect(first.draft).toContain('Go in April');
      expect(first.draft).not.toContain('me@example.com');
      const again = await saveSelectionCapsule(turns, 'https://chatgpt.com/c/1', 'Japan, spring', undefined);
      expect(again.id).toBe(first.id);
      expect(await listProjects()).toHaveLength(1);
      expect((await listProjects())[0]).toMatchObject({ name: 'Japan, spring' });
      expect((await listProjects())[0].folder).toBeUndefined();
      await saveSelectionCapsule([turns[0]], 'https://chatgpt.com/c/1', 'Just the question');
      expect(await listProjects()).toHaveLength(2);
    } finally { vi.unstubAllGlobals(); }
  });
});

describe('keyboard shortcuts', () => {
  it('suggests at most four keys Chrome accepts, none repeated and none of Chrome’s own', () => {
    const suggested = Object.values(manifestCommands()).flatMap(command => command.suggested_key ? [command.suggested_key.default] : []);
    expect(suggested.length).toBeLessThanOrEqual(4);
    expect(new Set(suggested).size).toBe(suggested.length);
    for (const key of suggested) expect(key).toMatch(/^(?:Ctrl|Alt)\+(?:Shift\+)?[A-Z0-9]$/);
    expect(suggested).not.toContain('Alt+Shift+B');
    expect(suggested).not.toContain('Alt+Shift+I');
    expect(suggested).not.toContain('Alt+Shift+T');
    expect(manifestCommands()._execute_action).toBeDefined();
    for (const command of pageCommands) expect(shortcutCommands.some(item => item.name === command)).toBe(true);
  });
  it('shows keys as the keyboard reads them and marks unassigned ones', () => {
    expect(formatShortcut('Alt+Shift+P', true)).toBe('⌥⇧P');
    expect(formatShortcut('Alt+Shift+P', false)).toBe('Alt+Shift+P');
    expect(formatShortcut('', true)).toBe('');
    const rows = shortcutRows([{ name: 'open-pass-menu', shortcut: 'Alt+Shift+P' }, { name: 'capture-chat', shortcut: '' }], false);
    expect(rows.map(row => row.name)).toEqual(shortcutCommands.map(command => command.name));
    expect(rows.find(row => row.name === 'capture-chat')?.keys).toBe('Not set');
    const doc = new JSDOM('<ul></ul>').window.document;
    const list = doc.querySelector('ul') as HTMLElement;
    fillShortcutList(list, [{ name: 'save-selection', shortcut: 'Alt+Shift+S' }], true);
    expect(list.querySelectorAll('li')).toHaveLength(shortcutCommands.length);
    expect(Array.from(list.querySelectorAll('kbd')).map(kbd => kbd.textContent)).toContain('⌥⇧S');
  });
  it('lists the shortcuts in Baton and the guide, with a way to change them', () => {
    for (const page of ['../entrypoints/popup/index.html', '../entrypoints/welcome/index.html']) {
      const doc = new JSDOM(readFileSync(new URL(page, import.meta.url), 'utf8')).window.document;
      expect(doc.querySelector('#shortcut-list')).not.toBeNull();
      expect(doc.querySelector('#change-shortcuts')).not.toBeNull();
    }
    const popup = new JSDOM(readFileSync(new URL('../entrypoints/popup/index.html', import.meta.url), 'utf8')).window.document;
    expect(popup.querySelector('#toggle-selection')).not.toBeNull();
  });
});
