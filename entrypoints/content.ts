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
    const persist = async () => {
      const data = extract(document, id, bundledSelectors);
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
