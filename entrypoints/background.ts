import { defineBackground } from 'wxt/utils/define-background';
import { bundledSelectors, providerIds, type ProviderId } from '../src/core/selectors';
import { usageAlert } from '../src/core/usage-alerts';
import { isSupportedChatUrl } from '../src/core/connection';
import { currentBadge, updateBadge, usageQueue, type BadgeRecord } from '../src/core/usage-delivery';
import { isCurrentReading, mergeUsageWindows, type UsageWindow } from '../src/core/usage-windows';
import { kindProvider, parseUsageResponse, type UsageKind } from '../src/core/usage-api';
import { apiProviders, fetchUsage, fieldNames } from '../src/core/usage-fetch';
import { refreshAfterSendDue, refreshAllUsage } from '../src/core/usage-refresh';
import { usagePageUrl } from '../src/core/usage-windows';
import type { Meter } from '../src/core/limits';
import { providerEnabled, providerNames } from '../src/core/rescue';
import { fetchRankings } from '../src/core/task-fit';
import { pageCommands, type ShortcutCommand } from '../src/core/shortcuts';

export default defineBackground(() => {
  const enqueueUsage = usageQueue();
  const badgeKey = (tabId: number) => `usageBadge:${tabId}`;
  const refreshBadge = async (tabId: number) => {
    const record = (await chrome.storage.session.get(badgeKey(tabId)))[badgeKey(tabId)] as BadgeRecord | undefined;
    const meter = currentBadge(record);
    if (!meter) {
      await chrome.action.setBadgeText({ tabId, text: '' });
      await chrome.action.setTitle({ tabId, title: 'Baton · no current service usage reading' });
      if (record) await chrome.storage.session.remove(badgeKey(tabId));
      return;
    }
    const text = meter.percent !== undefined ? `${Math.round(meter.percent)}%` : meter.nearLimit ? '!' : '';
    await chrome.action.setBadgeText({ tabId, text });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: meter.percent !== undefined && meter.percent >= 95 ? '#b33d45' : '#376b54' });
    await chrome.action.setTitle({ tabId, title: `Baton · ${meter.provider} · ${meter.feature}: ${meter.percent === undefined ? 'balance unknown' : `${meter.percent}% used`} (last service reading ${new Date(meter.at!).toLocaleTimeString()})` });
  };
  chrome.tabs.onActivated.addListener(({ tabId }) => { void enqueueUsage(() => refreshBadge(tabId)).catch(() => {}); });
  chrome.tabs.onRemoved.addListener(tabId => { void enqueueUsage(() => chrome.storage.session.remove(badgeKey(tabId))).catch(() => {}); });
  chrome.tabs.onUpdated.addListener((tabId, change) => {
    if (change.status !== 'loading') return;
    void enqueueUsage(async () => { await chrome.storage.session.remove(badgeKey(tabId)); await chrome.action.setBadgeText({ tabId, text: '' }); }).catch(() => {});
  });
  // Suggestion rankings: a public file in Baton's GitHub repo, checked once a day so a better model can be
  // suggested without a new release. Only that file is downloaded; nothing is sent. The bundled list is the fallback.
  const updateRankings = async () => { const saved = await fetchRankings(); if (saved) await chrome.storage.local.set({ rankingsRemote: saved }); return !!saved; };
  const scheduleRankings = () => { void chrome.alarms.get('baton-rankings').then(alarm => { if (!alarm) void chrome.alarms.create('baton-rankings', { delayInMinutes: 1, periodInMinutes: 1440 }); }).catch(() => {}); };
  chrome.runtime.onInstalled.addListener(scheduleRankings);
  // First install: open the welcome page (pin Baton, open an AI chat, find the glowing button).
  // Uninstall: the browser opens a short feedback page on Baton's site; only the version is in the address.
  const uninstallPage = () => { void chrome.runtime.setUninstallURL(`https://oscar-man-shrestha.github.io/handoff/uninstall.html?v=${encodeURIComponent(chrome.runtime.getManifest().version)}`).catch(() => {}); };
  chrome.runtime.onInstalled.addListener(details => {
    uninstallPage();
    if (details.reason === 'install') void chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') }).catch(() => {});
  });
  chrome.runtime.onStartup.addListener(uninstallPage);
  // Keyboard shortcuts (chrome://extensions/shortcuts) and the right-click “Save selection as a baton”: the chat page does
  // the work, so its content script gets the command. The side panel opens here, while the key press still counts.
  const toChatPage = (tab: chrome.tabs.Tab | undefined, command: ShortcutCommand) => { if (tab?.id && isSupportedChatUrl(tab.url)) void chrome.tabs.sendMessage(tab.id, { type: 'BATON_COMMAND', command }).catch(() => {}); };
  chrome.commands?.onCommand.addListener((command, tab) => {
    if (command === 'open-side-panel') { if (tab?.windowId !== undefined) void chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {}); return; }
    const page = pageCommands.find(name => name === command);
    if (page) toChatPage(tab, page);
  });
  const chatPatterns = [...new Set(providerIds.flatMap(id => bundledSelectors.providers[id].hosts.map(host => `https://${host}/*`)))];
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus?.removeAll(() => chrome.contextMenus.create({ id: 'baton-save-selection', title: 'Save selection as a baton', contexts: ['selection'], documentUrlPatterns: chatPatterns }, () => void chrome.runtime.lastError));
  });
  // The chat page shows the keys the browser actually assigned (in its tooltips and the save card).
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'SHORTCUT_KEYS' || !chrome.commands) return;
    void chrome.commands.getAll().then(commands => sendResponse({ ok: true, commands: commands.map(({ name, shortcut }) => ({ name, shortcut })) }), () => sendResponse({ ok: false }));
    return true;
  });
  chrome.contextMenus?.onClicked.addListener((info, tab) => { if (info.menuItemId === 'baton-save-selection') toChatPage(tab, 'save-selection'); });
  chrome.runtime.onStartup.addListener(scheduleRankings);
  chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'baton-rankings') void updateRankings().catch(() => {}); });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'REFRESH_RANKINGS' || !_sender.url?.startsWith(chrome.runtime.getURL(''))) return;
    void updateRankings().then(ok => sendResponse({ ok }), () => sendResponse({ ok: false }));
    return true;
  });
  // On-device task model: runs in a hidden offscreen page (WebAssembly can't load in the service worker).
  let offscreenReady: Promise<void> | undefined;
  const ensureOffscreen = () => offscreenReady ||= (async () => {
    const url = chrome.runtime.getURL('offscreen.html');
    const open = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT], documentUrls: [url] });
    if (!open.length) await chrome.offscreen.createDocument({ url, reasons: [chrome.offscreen.Reason.WORKERS], justification: 'Runs Baton\'s on-device task model to suggest which AI fits a prompt. Text stays on this device.' });
  })().finally(() => { offscreenReady = undefined; });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'CLASSIFY' || typeof message.text !== 'string') return;
    void (async () => {
      await ensureOffscreen();
      sendResponse(await chrome.runtime.sendMessage({ type: 'CLASSIFY_OFFSCREEN', text: message.text.slice(-1500) }));
    })().catch(error => sendResponse({ ok: false, error: String(error) }));
    return true;
  });
  // Google Drive backup runs here: the popup closes when Google's sign-in window opens. Extension pages only.
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const actions: Record<string, (drive: typeof import('../src/core/drive')) => Promise<unknown>> = {
      DRIVE_BACKUP: drive => drive.backupToDrive(), DRIVE_INSPECT: drive => drive.inspectDrive(), DRIVE_RESTORE: drive => drive.restoreFromDrive(), DRIVE_DISCONNECT: drive => drive.disconnectDrive()
    };
    const action = actions[message?.type];
    if (!action || !sender.url?.startsWith(chrome.runtime.getURL(''))) return;
    void import('../src/core/drive').then(action).then(result => sendResponse({ ok: true, result }), error => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Google Drive did not respond.' }));
    return true;
  });
  // Existing chat tabs connect after installation/update without reloading them.
  chrome.runtime.onInstalled.addListener(() => { void (async () => {
    // Baton's own content script, not the usage tap that runs beside it in the page.
    const script = chrome.runtime.getManifest().content_scripts?.flatMap(entry => entry.js || []).find(file => /content-scripts\/content\.js$/.test(file));
    if (!script) return;
    for (const tab of await chrome.tabs.query({})) {
      if (!tab.id || !isSupportedChatUrl(tab.url)) continue;
      try { const ready = await chrome.tabs.sendMessage(tab.id, { type: 'PING' }); if (ready?.ready) continue; } catch { /* Install into an existing tab. */ }
      try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [script] }); } catch { /* Discarded/restricted tabs connect when opened. */ }
    }
  })().catch(() => {}); });
  // Usage pages load in a background tab of the current window (focus stays put) and close once read.
  // A minimised window was tried in 0.3.18: on macOS it pulled the user into the new window.
  const usageDeps = () => ({
    tabs: () => chrome.tabs.query({}),
    open: async (url: string) => (await chrome.tabs.create({ url, active: false })).id,
    close: async (tabId: number) => { await chrome.tabs.remove(tabId); },
    ask: async (tabId: number) => !!(await chrome.tabs.sendMessage(tabId, { type: 'REFRESH_USAGE' }))?.ok,
    readingAt: async (provider: ProviderId) => Math.max(0, ...((((await chrome.storage.local.get(`usageWindows:${provider}`))[`usageWindows:${provider}`] || []) as UsageWindow[]).map(win => Number(win.at) || 0))),
    sleep: (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
    now: () => Date.now()
  });
  // Readings from the sites' usage responses (the page's own, via the usage tap, or Baton's refresh) join the stored ones.
  const saveReadings = (provider: ProviderId, readings: UsageWindow[]) => enqueueUsage(async () => {
    const key = `usageWindows:${provider}`;
    const saved = ((await chrome.storage.local.get(key))[key] || []) as UsageWindow[];
    await chrome.storage.local.set({ [key]: mergeUsageWindows(saved, readings) });
  });
  // Baton's own usage refresh (ChatGPT, Claude, Gemini) with the browser's sign-in, kept gentle: off with one switch,
  // at most once a minute per service, and backing off (2, 4, 8… up to 60 minutes) while a service gives nothing back,
  // e.g. signed out or refusing; one good answer resets it.
  const apiRunAt = new Map<ProviderId, number>();
  const apiBackoff = new Map<ProviderId, { fails: number; until: number }>();
  const refreshApi = async (provider: ProviderId) => {
    if (!apiProviders.includes(provider) || Date.now() - (apiRunAt.get(provider) || 0) < 60000) return false;
    if (Date.now() < (apiBackoff.get(provider)?.until || 0)) return false;
    if ((await chrome.storage.local.get('usageApiRefresh')).usageApiRefresh === false) return false;
    apiRunAt.set(provider, Date.now());
    const { readings, check } = await fetchUsage(provider).catch(error => ({ readings: [] as UsageWindow[], check: { at: Date.now(), route: 'none' as const, steps: [`failed: ${String(error).slice(0, 100)}`], readings: 0 } }));
    // The last check's outcome, shown in Baton's usage panel so a missing figure can be explained.
    const retryAt = readings.length ? undefined : Date.now() + Math.min(60, 2 ** ((apiBackoff.get(provider)?.fails || 0) + 1)) * 60000;
    await chrome.storage.local.set({ [`usageApiCheck:${provider}`]: { ...check, ...(retryAt ? { retryAt } : {}) } });
    if (readings.length) { apiBackoff.delete(provider); await saveReadings(provider, readings); return true; }
    const fails = (apiBackoff.get(provider)?.fails || 0) + 1;
    apiBackoff.set(provider, { fails, until: retryAt! });
    return false;
  };
  // Every 5 minutes, only for services the user is using: one with a tab open, or messages sent in the last 3 days.
  void chrome.alarms.create('baton-usage-api', { periodInMinutes: 5 });
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name !== 'baton-usage-api') return;
    void (async () => {
      const saved = await chrome.storage.local.get(['enabledProviders', ...apiProviders.map(id => `usageSends:${id}`)]);
      const enabled = (saved.enabledProviders || {}) as Record<string, boolean>;
      const open = (await chrome.tabs.query({})).map(tab => { try { return new URL(tab.url || '').hostname; } catch { return ''; } });
      const inUse = (id: ProviderId) => bundledSelectors.providers[id].hosts.some(host => open.includes(host)) || Math.max(0, ...((saved[`usageSends:${id}`] || []) as number[])) > Date.now() - 3 * 86400000;
      await Promise.all(apiProviders.filter(id => providerEnabled(id, enabled) && inUse(id)).map(refreshApi));
    })().catch(() => {});
  });
  // After a send, refresh that service's usage 30 s later (the reply's usage is then counted): its usage response
  // when it answers, else its usage page in a background tab.
  chrome.alarms.onAlarm.addListener(alarm => {
    if (!alarm.name.startsWith('handoff-usage:')) return;
    const provider = alarm.name.slice('handoff-usage:'.length) as ProviderId;
    if (!providerIds.includes(provider)) return;
    void (async () => {
      await chrome.storage.session.set({ [`refreshAfterSendAt:${provider}`]: Date.now() });
      apiRunAt.delete(provider);
      if (await refreshApi(provider)) return;
      await refreshAllUsage([provider], usageDeps());
    })().catch(() => {});
  });
  // Reset reminders the user asked for from the limit rescue card.
  chrome.alarms.onAlarm.addListener(alarm => {
    if (!alarm.name.startsWith('handoff-reset:')) return;
    const provider = alarm.name.slice('handoff-reset:'.length) as ProviderId;
    if (!providerIds.includes(provider)) return;
    void (async () => {
      await chrome.action.setBadgeText({ text: '✓' });
      await chrome.action.setBadgeBackgroundColor({ color: '#376b54' });
      await chrome.action.setTitle({ title: `Baton · ${providerNames[provider]} should be available again` });
      if (await chrome.permissions.contains({ permissions: ['notifications'] })) await chrome.notifications.create(alarm.name, { type: 'basic', iconUrl: chrome.runtime.getURL('icon-128.png'), title: `${providerNames[provider]} is available again`, message: 'Its usage limit was due to reset now. Your saved project is in Baton.', priority: 0 });
    })().catch(() => {});
  });
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
    // Usage a chat site fetched for itself, copied by the usage tap: only from that site's own tab, only its own kinds.
    if (message?.type === 'API_USAGE') {
      let host = '';
      try { host = _sender.url ? new URL(_sender.url).hostname : ''; } catch { return; }
      const provider = providerIds.find(id => bundledSelectors.providers[id].hosts.includes(host));
      const kind = message.kind as UsageKind;
      if (!provider || kindProvider[kind] !== provider || typeof message.text !== 'string') return;
      if (kind === 'claude-stream') { void chrome.storage.local.set({ [`usageTapCheck:${provider}`]: { at: Date.now(), kind, fields: message.text.slice(0, 300) } }).catch(() => {}); return; }
      const readings = parseUsageResponse(kind, message.text);
      if (readings.length) void saveReadings(provider, readings).catch(() => {});
      // A usage answer the page got but Baton couldn't read: keep its field names (never values) for the usage panel.
      else void chrome.storage.local.set({ [`usageTapCheck:${provider}`]: { at: Date.now(), kind, fields: fieldNames(message.text) } }).catch(() => {});
      return;
    }
    // A chat page of ChatGPT, Claude or Gemini opened: refresh its usage now (throttled to once a minute).
    if (message?.type === 'API_USAGE_REFRESH') {
      let host = '';
      try { host = _sender.url ? new URL(_sender.url).hostname : ''; } catch { return; }
      const provider = providerIds.find(id => bundledSelectors.providers[id].hosts.includes(host));
      if (provider) void refreshApi(provider).catch(() => {});
      return;
    }
    if (message?.type === 'REFRESH_ALL_USAGE') {
      if (!_sender.url?.startsWith(chrome.runtime.getURL(''))) return;
      // Runs here so it finishes even if the popup closes. Background tabs it opens are closed again.
      void (async () => {
        const enabled = ((await chrome.storage.local.get('enabledProviders')).enabledProviders || {}) as Record<string, boolean>;
        const results = await refreshAllUsage(providerIds.filter(id => providerEnabled(id, enabled)), usageDeps());
        sendResponse({ ok: true, results });
      })().catch(() => sendResponse({ ok: false }));
      return true;
    }
    if (message?.type === 'REFRESH_AFTER_SEND') {
      let host = '';
      try { host = _sender.url ? new URL(_sender.url).hostname : ''; } catch { return; }
      const provider = providerIds.find(id => bundledSelectors.providers[id].hosts.includes(host));
      if (!provider || !usagePageUrl(provider)) return;
      void (async () => {
        const saved = await chrome.storage.local.get(['refreshAfterSend', `usageWindows:${provider}`]);
        if (saved.refreshAfterSend === false) return;
        const lastRun = Number((await chrome.storage.session.get(`refreshAfterSendAt:${provider}`))[`refreshAfterSendAt:${provider}`]) || undefined;
        const newest = Math.max(0, ...((saved[`usageWindows:${provider}`] || []) as UsageWindow[]).map(win => Number(win.at) || 0));
        if (!refreshAfterSendDue(lastRun, newest) || await chrome.alarms.get(`handoff-usage:${provider}`)) return;
        await chrome.alarms.create(`handoff-usage:${provider}`, { when: Date.now() + 30000 });
      })().catch(() => {});
      return;
    }
    if (message?.type === 'REMIND_AT_RESET') {
      let host = '';
      try { host = _sender.url ? new URL(_sender.url).hostname : ''; } catch { return; }
      const provider = providerIds.find(id => bundledSelectors.providers[id].hosts.includes(host));
      const resetAt = Number(message.resetAt);
      if (!provider || provider !== message.provider || !Number.isFinite(resetAt) || resetAt < Date.now() + 30000 || resetAt > Date.now() + 8 * 86400000) { sendResponse({ ok: false }); return; }
      void (async () => {
        await chrome.alarms.create(`handoff-reset:${provider}`, { when: resetAt });
        sendResponse({ ok: true, notifications: await chrome.permissions.contains({ permissions: ['notifications'] }) });
      })().catch(() => sendResponse({ ok: false }));
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
