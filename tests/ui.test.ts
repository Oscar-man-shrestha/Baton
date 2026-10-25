import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as typeof import('jsdom');

describe('extension screens', () => {
  it('keeps the shared popup and sidebar controller markup synchronized', () => {
    const popup = new JSDOM(readFileSync(new URL('../entrypoints/popup/index.html', import.meta.url), 'utf8')).window.document;
    const sidebar = new JSDOM(readFileSync(new URL('../entrypoints/sidepanel/index.html', import.meta.url), 'utf8')).window.document;
    expect(sidebar.body.innerHTML).toBe(popup.body.innerHTML);
  });
  it('gives the browser popup a fixed initial width', () => {
    const css = readFileSync(new URL('../entrypoints/popup/style.css', import.meta.url), 'utf8');
    expect(css).toMatch(/html\s*\{\s*width:\s*400px\s*\}/);
    expect(css).not.toMatch(/max-width:\s*100vw/);
  });

  it('shows a simple first step and keeps later controls behind review', () => {
    const html = readFileSync(new URL('../entrypoints/popup/index.html', import.meta.url), 'utf8');
    const doc = new JSDOM(html).window.document;
    expect(doc.querySelector('#capture')).not.toBeNull();
    expect(doc.querySelector('#show-usage')).not.toBeNull();
    expect(doc.querySelector('#usage-dialog')?.contains(doc.querySelector('#usage-list'))).toBe(true);
    expect(doc.querySelector('#copy-extension-callback')).not.toBeNull();
    expect(doc.querySelector('.stats')).not.toBeNull();
    expect(doc.querySelector('.quick-actions')?.contains(doc.querySelector('#new-folder'))).toBe(true);
    expect(doc.querySelector('#new-capsule-dialog')).not.toBeNull();
    expect(doc.querySelector('.capture-extras')?.contains(doc.querySelector('#include-older'))).toBe(true);
    expect(doc.querySelector('#active-usage')).not.toBeNull();
    expect(doc.querySelector('#include-older')).not.toBeNull();
    expect(doc.querySelector('#manual')).not.toBeNull();
    expect(doc.querySelector('#library')?.hasAttribute('hidden')).toBe(true);
    expect(doc.querySelector('#flow')?.hasAttribute('hidden')).toBe(true);
    expect(doc.querySelector('#review-panel')).not.toBeNull();
    expect(doc.querySelector('#review-panel')?.contains(doc.querySelector('#draft'))).toBe(true);
  });

  it('shows Google sign-in and backup without opening a collapsed section', () => {
    const doc = new JSDOM(readFileSync(new URL('../entrypoints/popup/index.html', import.meta.url), 'utf8')).window.document;
    expect(doc.querySelector('#capture-card')?.contains(doc.querySelector('#cloud-card-action'))).toBe(true);
    const section = doc.querySelector('#google-backup');
    expect(section?.tagName).toBe('SECTION');
    expect(section?.closest('details')).toBeNull();
    expect(doc.querySelector('#google-sign-in')?.closest('details')).toBeNull();
    expect(doc.querySelector('#account-dialog')?.firstElementChild?.nextElementSibling?.nextElementSibling).toBe(section);
  });

  for (const screen of ['popup', 'options'] as const) it(`${screen} has labeled controls and one page title`, () => {
    const html = readFileSync(new URL(`../entrypoints/${screen}/index.html`, import.meta.url), 'utf8');
    const doc = new JSDOM(html).window.document;
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
    const ids = Array.from(doc.querySelectorAll('[id]')).map(element => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const input of Array.from(doc.querySelectorAll('textarea,select,input:not([type="checkbox"]):not([type="file"])'))) {
      expect(doc.querySelector(`label[for="${input.id}"]`), `${screen}: ${input.id} needs a label`).not.toBeNull();
    }
    for (const button of Array.from(doc.querySelectorAll('button'))) {
      expect((button.textContent || button.getAttribute('aria-label') || '').trim().length, `${screen}: button needs a name`).toBeGreaterThan(0);
    }
    const styles = readFileSync(new URL(`../entrypoints/${screen}/style.css`, import.meta.url), 'utf8');
    expect(styles).toContain(':focus-visible');
    expect(styles).toContain('prefers-contrast:more');
    expect(styles).toContain('prefers-reduced-motion');
  });
});

describe('Baton naming', () => {
  it('shows Baton wording and no leftover Capsule or Handoff text on any screen', () => {
    for (const screen of ['popup', 'sidepanel', 'options']) {
      const doc = new JSDOM(readFileSync(new URL(`../entrypoints/${screen}/index.html`, import.meta.url), 'utf8')).window.document;
      const visible = `${doc.title} ${doc.body.textContent} ${Array.from(doc.querySelectorAll('[aria-label],[placeholder],[title]')).map(node => `${node.getAttribute('aria-label') || ''} ${node.getAttribute('placeholder') || ''} ${node.getAttribute('title') || ''}`).join(' ')}`;
      expect(visible).not.toMatch(/\bCapsules?\b|\bHandoff\b/);
    }
    const popup = readFileSync(new URL('../entrypoints/popup/index.html', import.meta.url), 'utf8');
    expect(popup).toContain('Write a baton');
    for (const text of ['Pass the baton', 'Other AIs', 'Capture this chat', 'id="lanes"']) expect(popup).toContain(text);
    const order = new JSDOM(popup).window.document;
    // The current AI's card comes first; every other AI is inside the closed “Other AIs” drop-down.
    expect(order.querySelector('#active-usage')!.compareDocumentPosition(order.querySelector('#other-lanes')!) & 4).toBeTruthy();
    expect(order.querySelector('#other-lanes')?.contains(order.querySelector('#lanes'))).toBe(true);
    expect(order.querySelector('#other-lanes')?.hasAttribute('open')).toBe(false);
    // The bar under chat boxes can be hidden with its ×; this link (hidden by default) brings it back.
    // This chat's suggestions sit above Usage; hidden until a chat answers.
    expect(order.querySelector('#next-section + .lanes-section')).not.toBeNull();
    expect(order.querySelector('#next-section')?.hasAttribute('hidden')).toBe(true);
    // Switches for the bar and the Baton button are always visible, not hidden behind a “show again” link.
    expect(order.querySelector('.lanes-section .chat-toggles #toggle-bar')?.closest('[hidden]')).toBeNull();
    expect(order.querySelector('.lanes-section .chat-toggles #toggle-pass')?.closest('[hidden]')).toBeNull();
    const doc = new JSDOM(popup).window.document;
    // Baton's own layout: no stat tiles, one primary pass action, lanes above the list.
    expect(doc.querySelector('.stats')?.tagName).toBe('P');
    expect(doc.querySelector('.quick-actions .pass-primary')?.id).toBe('capture');
    expect(doc.querySelector('#lanes')!.compareDocumentPosition(doc.querySelector('#recent-list')!) & 4).toBeTruthy();
  });
});
