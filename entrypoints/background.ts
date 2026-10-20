import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'OPEN_POPUP') {
      chrome.action.openPopup().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
      return true;
    }
    if (message?.type !== 'OPEN_DRAFT' || typeof message.text !== 'string' || typeof message.url !== 'string') return;
    const allowed = ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'chat.deepseek.com', 'grok.com', 'www.perplexity.ai'];
    const url = new URL(message.url);
    if (url.protocol !== 'https:' || !allowed.includes(url.hostname)) { sendResponse({ ok: false, error: 'Unsupported destination' }); return; }
    chrome.tabs.create({ url: url.toString() }, tab => {
      const id = tab?.id;
      if (!id) { sendResponse({ ok: false }); return; }
      const onUpdated = (updatedId: number, info: { status?: string }) => {
        if (updatedId !== id || info.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        chrome.tabs.sendMessage(id, { type: 'INJECT_DRAFT', text: message.text }).catch(() => {});
      };
      chrome.tabs.onUpdated.addListener(onUpdated);
      sendResponse({ ok: true });
    });
    return true;
  });
});
