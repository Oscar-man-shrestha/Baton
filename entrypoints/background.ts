import { defineBackground } from 'wxt/utils/define-background';
import { bundledSelectors, providerIds, type ProviderId } from '../src/core/selectors';
import { usageAlert } from '../src/core/usage-alerts';
import type { Meter } from '../src/core/limits';

export default defineBackground(() => {
  const deliverDraft = async (tabId: number, text: string) => {
    for (let attempt = 1; attempt <= 12; attempt++) {
      try {
        const result = await chrome.tabs.sendMessage(tabId, { type: 'INJECT_DRAFT', text });
        if (result?.ok) {
          await chrome.storage.local.set({ lastDraftInsertion: { at: Date.now(), ok: true, attempts: attempt } });
          return;
        }
      } catch { /* Content script or editor may still be loading. */ }
      await new Promise(resolve => setTimeout(resolve, 750));
    }
    await chrome.storage.local.set({ lastDraftInsertion: { at: Date.now(), ok: false, attempts: 12 } });
  };
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'OBSERVE_USAGE') {
      const provider = message.provider as ProviderId;
      let host = '';
      try { host = _sender.url ? new URL(_sender.url).hostname : ''; } catch { return; }
      if (!providerIds.includes(provider) || !bundledSelectors.providers[provider].hosts.includes(host)) return;
      const meter = message.meter as Meter;
      if (!meter || meter.provider !== provider || meter.tier !== 'banner' || meter.confidence !== 'high') return;
      void (async () => {
        const saved = await chrome.storage.local.get(['desktopUsageAlerts', 'deliveredUsageAlerts']);
        const delivered = Array.isArray(saved.deliveredUsageAlerts) ? saved.deliveredUsageAlerts as string[] : [];
        const alert = usageAlert(meter, delivered);
        if (!alert || !saved.desktopUsageAlerts || !await chrome.permissions.contains({ permissions: ['notifications'] })) return;
        await chrome.storage.local.set({ deliveredUsageAlerts: [...delivered, alert.key].slice(-100) });
        await chrome.notifications.create(alert.key, { type: 'basic', iconUrl: chrome.runtime.getURL('icon-128.png'), title: alert.title, message: alert.message, priority: 0 });
      })().catch(() => { /* Notification failure must not interrupt the chat. */ });
      return;
    }
    if (message?.type !== 'OPEN_DRAFT' || typeof message.text !== 'string' || typeof message.url !== 'string') return;
    const allowed = ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'chat.deepseek.com', 'grok.com', 'www.perplexity.ai'];
    const url = new URL(message.url);
    if (url.protocol !== 'https:' || !allowed.includes(url.hostname)) { sendResponse({ ok: false, error: 'Unsupported destination' }); return; }
    chrome.tabs.create({ url: url.toString() }, tab => {
      const id = tab?.id;
      if (!id) { sendResponse({ ok: false }); return; }
      let started = false;
      const startDelivery = () => {
        if (started) return;
        started = true;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        void deliverDraft(id, message.text);
      };
      const onUpdated = (updatedId: number, info: { status?: string }) => {
        if (updatedId !== id || info.status !== 'complete') return;
        startDelivery();
      };
      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.get(id).then(current => { if (current.status === 'complete') startDelivery(); }).catch(() => {});
      sendResponse({ ok: true });
    });
    return true;
  });
});
