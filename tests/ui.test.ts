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
