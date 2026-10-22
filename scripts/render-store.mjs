// Renders the Chrome Web Store images from store/src/*.html with the local Brave (or Chrome), using a throwaway
// profile. Output: store/*.png at the exact sizes the store asks for. Run: npm run render:store
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = fileURLToPath(new URL('..', import.meta.url));
const executablePath = [process.env.BROWSER, '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(path => path && existsSync(path));
if (!executablePath) throw new Error('No Brave or Chrome found. Set BROWSER to a Chromium executable.');
const jobs = [
  ...['01-continue', '02-usage', '03-suggest', '04-draft', '05-private'].map(name => [`${name}.html`, 1280, 800, `screenshot-${name}.png`]),
  ['promo-small.html', 440, 280, 'promo-small-440x280.png'],
  ['promo-marquee.html', 1400, 560, 'promo-marquee-1400x560.png']
];
const profile = mkdtempSync(join(tmpdir(), 'baton-render-'));
const browser = await puppeteer.launch({ executablePath, headless: true, userDataDir: profile, args: ['--hide-scrollbars'] });
try {
  const page = await browser.newPage();
  for (const [file, width, height, out] of jobs) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(`file://${join(root, 'store/src', file)}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(root, 'store', out), type: 'png', omitBackground: false });
    console.log(`store/${out} ${width}×${height}`);
  }
} finally { await browser.close(); rmSync(profile, { recursive: true, force: true }); }
