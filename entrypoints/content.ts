import { defineContentScript } from 'wxt/utils/define-content-script';
import { bundledSelectors, providerIds, type ProviderId } from '../src/core/selectors';
import { extract, makeAdapter } from '../src/core/adapter';
import { updateBrief, briefSchema } from '../src/core/brief';

export default defineContentScript({
  matches: ['https://chatgpt.com/*', 'https://claude.ai/*', 'https://gemini.google.com/*', 'https://chat.deepseek.com/*', 'https://grok.com/*', 'https://www.perplexity.ai/*'],
  main() {
    const id = providerIds.find(p => bundledSelectors.providers[p].hosts.includes(location.hostname)) as ProviderId | undefined;
    if (!id) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const key = `brief:${location.origin}${location.pathname}`;
    let noticeCard: HTMLElement | undefined;
    const showLimitCard = (notice: string) => {
      if (noticeCard) return;
      noticeCard = document.createElement('div');
      noticeCard.setAttribute('role', 'dialog');
      noticeCard.setAttribute('aria-label', 'AI chat usage notice');
      noticeCard.tabIndex = -1;
      const shadow = noticeCard.attachShadow({ mode: 'closed' });
      const style = document.createElement('style');
      style.textContent = ':host{position:fixed;z-index:2147483647;right:20px;bottom:20px;width:min(340px,calc(100vw - 40px));font:14px system-ui;color:#102030}section{padding:16px;background:#fff;border:2px solid #234;box-shadow:0 5px 24px #0005;border-radius:12px}h2{font-size:16px;margin:0 0 6px}p{line-height:1.4}button{font:inherit;padding:7px;margin-right:6px;border:1px solid #234;border-radius:5px;background:#fff}button:focus-visible{outline:3px solid #2670d1}@media(prefers-contrast:more){section{border:3px solid #000;box-shadow:none}}';
      const section = document.createElement('section');
      const heading = document.createElement('h2'); heading.textContent = 'Chat usage notice';
      const message = document.createElement('p'); message.textContent = notice;
      const choices = document.createElement('p'); choices.textContent = 'You can wait for the provider reset, start a fresh chat, or choose another service with a reviewed brief.';
      const handoff = document.createElement('button'); handoff.textContent = 'Open Handoff';
      const close = document.createElement('button'); close.textContent = 'Dismiss';
      const dismiss = () => { noticeCard?.remove(); noticeCard = undefined; };
      handoff.addEventListener('click', async () => { const result = await chrome.runtime.sendMessage({ type: 'OPEN_POPUP' }); if (!result?.ok) handoff.textContent = 'Click the Handoff toolbar icon'; });
      close.addEventListener('click', dismiss);
      section.addEventListener('keydown', event => {
        if (event.key === 'Escape') { dismiss(); return; }
        if (event.key === 'Tab') {
          const buttons = [handoff, close]; const index = buttons.indexOf(shadow.activeElement as HTMLButtonElement);
          if (event.shiftKey && index === 0) { event.preventDefault(); close.focus(); }
          if (!event.shiftKey && index === 1) { event.preventDefault(); handoff.focus(); }
        }
      });
      section.append(heading, message, choices, handoff, close); shadow.append(style, section); document.body.append(noticeCard); handoff.focus();
    };
    const persist = async () => {
      const data = extract(document, id, bundledSelectors);
      const signal = makeAdapter(id, bundledSelectors).detectLimit(document);
      if (signal.kind === 'banner') showLimitCard(signal.text);
      if (!data.turns.length) return;
      const previous = briefSchema.safeParse((await chrome.storage.local.get(key))[key]);
      const brief = updateBrief(previous.success ? previous.data : undefined, data.turns, data.artifacts);
      await chrome.storage.local.set({ [key]: brief, [`health:${id}`]: { at: Date.now(), turns: data.turns.length, selectorsVersion: bundledSelectors.version } });
    };
    const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(() => { void persist(); }, 1600); });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    void persist();
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'EXTRACT') {
        const result = extract(document, id, bundledSelectors);
        chrome.storage.local.get(key).then(saved => { const previous = briefSchema.safeParse(saved[key]); sendResponse({ ...result, brief: updateBrief(previous.success ? previous.data : undefined, result.turns, result.artifacts), limit: makeAdapter(id, bundledSelectors).detectLimit(document), url: location.href }); });
        return true;
      }
      if (message?.type === 'INJECT_DRAFT' && typeof message.text === 'string') {
        sendResponse({ ok: makeAdapter(id, bundledSelectors).injectDraft(document, message.text) });
      }
    });
  }
});
