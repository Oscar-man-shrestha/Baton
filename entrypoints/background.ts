import { defineBackground } from 'wxt/utils/define-background';
import { bundledSelectors, providerIds, type ProviderId } from '../src/core/selectors';
import { usageAlert } from '../src/core/usage-alerts';
import { isSupportedChatUrl } from '../src/core/connection';
import { currentBadge, updateBadge, usageQueue, type BadgeRecord } from '../src/core/usage-delivery';
import { isCurrentReading } from '../src/core/usage-windows';
import type { Meter } from '../src/core/limits';

export default defineBackground(() => {
  const enqueueUsage = usageQueue();
  const badgeKey = (tabId: number) => `usageBadge:${tabId}`;
  const refreshBadge = async (tabId: number) => {
    const record = (await chrome.storage.session.get(badgeKey(tabId)))[badgeKey(tabId)] as BadgeRecord | undefined;
    const meter = currentBadge(record);
    if (!meter) {
      await chrome.action.setBadgeText({ tabId, text: '' });
      await chrome.action.setTitle({ tabId, title: 'Handoff · no current service usage reading' });
      if (record) await chrome.storage.session.remove(badgeKey(tabId));
      return;
    }
    const text = meter.percent !== undefined ? `${Math.round(meter.percent)}%` : meter.nearLimit ? '!' : '';
    await chrome.action.setBadgeText({ tabId, text });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: meter.percent !== undefined && meter.percent >= 95 ? '#b33d45' : '#376b54' });
    await chrome.action.setTitle({ tabId, title: `Handoff · ${meter.provider} · ${meter.feature}: ${meter.percent === undefined ? 'balance unknown' : `${meter.percent}% used`} (last service reading ${new Date(meter.at!).toLocaleTimeString()})` });
  };
  chrome.tabs.onActivated.addListener(({ tabId }) => { void enqueueUsage(() => refreshBadge(tabId)).catch(() => {}); });
  chrome.tabs.onRemoved.addListener(tabId => { void enqueueUsage(() => chrome.storage.session.remove(badgeKey(tabId))).catch(() => {}); });
  chrome.tabs.onUpdated.addListener((tabId, change) => {
    if (change.status !== 'loading') return;
    void enqueueUsage(async () => { await chrome.storage.session.remove(badgeKey(tabId)); await chrome.action.setBadgeText({ tabId, text: '' }); }).catch(() => {});
  });
  // Existing chat tabs connect after installation/update without reloading them.
  chrome.runtime.onInstalled.addListener(() => { void (async () => {
    const script = chrome.runtime.getManifest().content_scripts?.[0]?.js?.[0];
    if (!script) return;
    for (const tab of await chrome.tabs.query({})) {
      if (!tab.id || !isSupportedChatUrl(tab.url)) continue;
      try { const ready = await chrome.tabs.sendMessage(tab.id, { type: 'PING' }); if (ready?.ready) continue; } catch { /* Install into an existing tab. */ }
      try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [script] }); } catch { /* Discarded/restricted tabs connect when opened. */ }
    }
  })().catch(() => {}); });
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
    if (message?.type === 'CLOUD_SIGN_IN') {
      if (!_sender.url?.startsWith(chrome.runtime.getURL(''))) return;
      // The toolbar popup closes when OAuth opens. Keep the flow in the worker.
      void import('../src/core/cloud').then(cloud => cloud.signInGoogle()).then(email => sendResponse({ ok: true, email })).catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Sign-in failed.' }));
      return true;
    }
    if (message?.type === 'OBSERVE_USAGE' || message?.type === 'REFRESH_USAGE_BADGE') {
      let host = '';
      try { host = _sender.url ? new URL(_sender.url).hostname : ''; } catch { return; }
      const provider = providerIds.find(id => bundledSelectors.providers[id].hosts.includes(host));
      if (!provider) return;
      if (message.type === 'REFRESH_USAGE_BADGE') {
        if (_sender.tab?.id === undefined) return;
        void enqueueUsage(() => refreshBadge(_sender.tab!.id!)).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
        return true;
      }
      const meter = message.meter as Meter;
      if (!meter || meter.provider !== provider || !isCurrentReading(meter)) return;
      void enqueueUsage(async () => {
        if (_sender.tab?.id !== undefined) {
          const key = badgeKey(_sender.tab.id);
          const record = (await chrome.storage.session.get(key))[key] as BadgeRecord | undefined;
          await chrome.storage.session.set({ [key]: updateBadge(record, meter) });
          await refreshBadge(_sender.tab.id);
        }
        const saved = await chrome.storage.local.get(['desktopUsageAlerts', 'deliveredUsageAlerts']);
        const delivered = Array.isArray(saved.deliveredUsageAlerts) ? saved.deliveredUsageAlerts as string[] : [];
        const alert = usageAlert(meter, delivered);
        if (!alert || !saved.desktopUsageAlerts || !await chrome.permissions.contains({ permissions: ['notifications'] })) return;
        await chrome.notifications.create(alert.key, { type: 'basic', iconUrl: chrome.runtime.getURL('icon-128.png'), title: alert.title, message: alert.message, priority: 0 });
        await chrome.storage.local.set({ deliveredUsageAlerts: [...delivered, alert.key].slice(-100) });
      }).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
      return true;
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
