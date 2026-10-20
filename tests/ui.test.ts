import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as typeof import('jsdom');

describe('extension screens', () => {
  it('gives the browser popup a fixed initial width', () => {
    const html = readFileSync(new URL('../entrypoints/popup/index.html', import.meta.url), 'utf8');
    expect(html).toMatch(/html\s*\{\s*width:\s*400px\s*\}/);
    expect(html).not.toMatch(/max-width:\s*100vw/);
  });

  it('shows a simple first step and keeps later controls behind review', () => {
    const html = readFileSync(new URL('../entrypoints/popup/index.html', import.meta.url), 'utf8');
    const doc = new JSDOM(html).window.document;
    expect(doc.querySelector('#capture')).not.toBeNull();
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
    expect(html).toContain(':focus-visible');
    expect(html).toContain('prefers-contrast:more');
    expect(html).toContain('prefers-reduced-motion');
  });
});
