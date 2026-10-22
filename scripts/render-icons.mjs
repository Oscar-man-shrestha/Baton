// Renders the Baton logo from store/src/icon.svg (48 px and up) and icon-small.svg (16, 32 px) to PNGs:
// public/icon-{16,32,48,128}.png for the extension (the 128 has the store's 16 px transparent margin around a
// 96 px tile), store/icon-128.png for the store listing, and docs/favicon.png + docs/favicon.svg for the site.
// Run: npm run render:icons
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = fileURLToPath(new URL('..', import.meta.url));
const svg = name => readFileSync(join(root, 'store/src', name), 'utf8');
const executablePath = [process.env.BROWSER, '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(path => path && existsSync(path));
const jobs = [
  ['icon-small.svg', 16, 0, 'public/icon-16.png'],
  ['icon-small.svg', 32, 0, 'public/icon-32.png'],
  ['icon.svg', 48, 0, 'public/icon-48.png'],
  ['icon.svg', 128, 16, 'public/icon-128.png'],
  ['icon.svg', 64, 0, 'docs/favicon.png']
];
const profile = mkdtempSync(join(tmpdir(), 'baton-icons-'));
const browser = await puppeteer.launch({ executablePath, headless: true, userDataDir: profile });
try {
  const page = await browser.newPage();
  for (const [file, size, margin, out] of jobs) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    const inner = size - margin * 2;
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;display:grid;place-items:center">${svg(file).replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
    await page.screenshot({ path: join(root, out), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    console.log(out, `${size}×${size}`);
  }
} finally { await browser.close(); rmSync(profile, { recursive: true, force: true }); }
copyFileSync(join(root, 'public/icon-128.png'), join(root, 'store/icon-128.png'));
copyFileSync(join(root, 'store/src/icon.svg'), join(root, 'docs/favicon.svg'));
