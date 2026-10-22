// End-to-end smoke test: loads the built extension into the local Brave (or Chrome) with a throwaway profile,
// headless, and checks what works without signing in. Never signs in and never sends a message.
// Run: npm run build && node scripts/smoke-extension.mjs [outDir]
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const out = process.argv[2] || join(tmpdir(), 'baton-smoke');
mkdirSync(out, { recursive: true });
const executablePath = [process.env.BROWSER, '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(path => path && existsSync(path));
const profile = mkdtempSync(join(tmpdir(), 'baton-smoke-'));
const browser = await puppeteer.launch({ executablePath, headless: true, userDataDir: profile, enableExtensions: [join(process.cwd(), '.output/chrome-mv3')], args: ['--hide-scrollbars', '--no-first-run', '--window-size=1366,900'] });
const report = {};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const ua = (await browser.userAgent()).replace('HeadlessChrome', 'Chrome');
try {
  await wait(3000);
  const worker = browser.targets().find(target => target.type() === 'service_worker' && target.url().endsWith('background.js'));
  const extId = new URL(worker.url()).host;
  const base = `chrome-extension://${extId}/`;
  // The welcome tab opens from the install event; give it up to 10 s.
  for (let i = 0; i < 20 && !browser.targets().some(target => target.url() === `${base}welcome.html`); i++) await wait(500);
  report.welcomeOpenedOnInstall = browser.targets().some(target => target.url() === `${base}welcome.html`);

  const open = async (url, errors = []) => {
    const page = await browser.newPage();
    await page.setUserAgent(ua);
    await page.setViewport({ width: 1366, height: 900 });
    page.on('pageerror', error => errors.push(String(error.message || error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(error => errors.push(`goto: ${error.message}`));
    return page;
  };

  // Welcome page
  { const errors = []; const page = await open(`${base}welcome.html`, errors); await wait(1500);
    report.welcome = await page.evaluate(() => ({ aiLinks: document.querySelectorAll('#ais a').length, pinStatus: document.querySelector('#pin-status')?.textContent }));
    report.welcome.errors = errors; await page.screenshot({ path: join(out, 'welcome.png'), fullPage: true }); await page.close(); }

  // Popup
  { const errors = []; const page = await open(`${base}popup.html`, errors); await wait(2500);
    report.popup = await page.evaluate(() => ({
      accountLabel: document.querySelector('#account-label')?.textContent,
      usageBarSwitch: document.querySelector('#toggle-bar')?.checked, passButtonSwitch: document.querySelector('#toggle-pass')?.checked,
      otherAIsOpen: document.querySelector('#other-lanes')?.open, nextSectionHidden: document.querySelector('#next-section')?.hidden,
      captureButton: document.querySelector('#capture')?.textContent?.trim()
    }));
    // The on-device task model, through the real background + offscreen page.
    const prompts = ['create a meme of my cat', 'is it healthy to eat eggs every day', 'who won the oscars this year', 'write a birthday wish for my sister', 'fix my python error'];
    report.model = [];
    for (const text of prompts) {
      const started = Date.now();
      const reply = await page.evaluate(text => chrome.runtime.sendMessage({ type: 'CLASSIFY', text }), text).catch(error => ({ error: String(error) }));
      report.model.push({ text, reply, ms: Date.now() - started });
    }
    // Toggle the usage-bar switch off and back on through the UI.
    await page.click('label.switch:has(#toggle-bar)').catch(() => {});
    await wait(300);
    report.popup.switchWritesStorage = await page.evaluate(() => chrome.storage.local.get('composerUsageEnabled').then(saved => saved.composerUsageEnabled));
    await page.click('label.switch:has(#toggle-bar)').catch(() => {});
    report.popup.errors = errors; await page.screenshot({ path: join(out, 'popup.png') }); await page.close(); }

  // Settings: rankings editor and the online rankings check
  { const errors = []; const page = await open(`${base}options.html`, errors); await wait(1500);
    await page.evaluate(() => { document.querySelectorAll('details').forEach(d => { d.open = true; }); });
    report.settings = await page.evaluate(() => ({ rankingRows: document.querySelectorAll('#ranking-list li').length, firstForCode: document.querySelector('#ranking-list li .name')?.textContent }));
    await page.click('#ranking-update').catch(() => {}); await wait(5000);
    report.settings.rankingSource = await page.evaluate(() => document.querySelector('#ranking-source')?.textContent);
    report.settings.errors = errors; await page.close(); }

  const extPage = await open(`${base}welcome.html`);
  const setStorage = values => extPage.evaluate(values => chrome.storage.local.set(values), values);
  const getStorage = keys => extPage.evaluate(keys => chrome.storage.local.get(keys), keys);

  // Chat pages, signed out
  const hosts = () => {
    const box = id => { const element = document.getElementById(id); if (!element) return 'missing'; const r = element.getBoundingClientRect(); return element.style.display === 'none' || !r.width ? 'hidden' : `shown at ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`; };
    return { title: document.title.slice(0, 60), usageBar: box('handoff-composer-status'), passButton: box('handoff-pass'), signInRing: box('handoff-signin-ring'), continueCard: box('handoff-continue') };
  };
  report.sites = {};
  for (const [name, url] of [['chatgpt', 'https://chatgpt.com/'], ['claude', 'https://claude.ai/login'], ['gemini', 'https://gemini.google.com/app'], ['perplexity', 'https://www.perplexity.ai/'], ['grok', 'https://grok.com/'], ['deepseek', 'https://chat.deepseek.com/']]) {
    const errors = []; const page = await open(url, errors); await wait(7000);
    report.sites[name] = await page.evaluate(hosts).catch(error => ({ error: String(error) }));
    await page.screenshot({ path: join(out, `site-${name}.png`) }).catch(() => {});
    if (name === 'chatgpt') {
      // Type (never send) a coding prompt, open the Baton menu, screenshot it.
      const box = await page.$('#prompt-textarea, textarea, [contenteditable="true"]');
      if (box) { await box.click(); await page.keyboard.type('fix my python login error, it returns 500'); await wait(1500); }
      const pass = await page.$('#handoff-pass');
      const rect = pass && await pass.boundingBox();
      if (rect && rect.width) { await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2); await wait(2500); await page.screenshot({ path: join(out, 'chatgpt-menu.png') }); }
      report.sites.chatgpt.menuOpened = !!(rect && rect.width);
      // × on the usage bar hides it and saves the setting.
      const bar = await page.$('#handoff-composer-status'); const barRect = bar && await bar.boundingBox();
      if (barRect && barRect.width) { await page.keyboard.press('Escape'); await page.mouse.click(barRect.x + barRect.width - 12, barRect.y + barRect.height / 2); await wait(800);
        report.sites.chatgpt.closeButtonHidesBar = (await getStorage('composerUsageEnabled')).composerUsageEnabled === false;
        await setStorage({ composerUsageEnabled: true }); }
    }
    await page.close().catch(() => {});
  }

  // Another account: a waiting project shows the sign-in ring (signed out) on ChatGPT and Claude.
  const now = Date.now();
  await setStorage({ 'pendingProject:chatgpt': { provider: 'chatgpt', draft: 'Goal: test draft', at: now, from: 'https://chatgpt.com/c/old', title: 'Old chat' }, 'pendingProject:claude': { provider: 'claude', draft: 'Goal: test draft', at: now, from: 'https://claude.ai/chat/old', title: 'Old chat' } });
  report.anotherAccount = {};
  for (const [name, url] of [['chatgpt', 'https://chatgpt.com/'], ['claude', 'https://claude.ai/login']]) {
    const page = await open(url); await wait(7000);
    report.anotherAccount[name] = await page.evaluate(hosts).catch(error => ({ error: String(error) }));
    await page.screenshot({ path: join(out, `another-account-${name}.png`) }).catch(() => {});
    await page.close().catch(() => {});
  }
  report.rankingsStored = !!(await getStorage('rankingsRemote')).rankingsRemote;
} catch (error) { report.error = String(error); } finally {
  await browser.close().catch(() => {});
  rmSync(profile, { recursive: true, force: true });
}
console.log(JSON.stringify(report, null, 1));
