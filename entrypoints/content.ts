import { defineContentScript } from 'wxt/utils/define-content-script';
import { bundledSelectors, providerIds, type ProviderId } from '../src/core/selectors';
import { collectTurnNodes, extract, makeAdapter } from '../src/core/adapter';
import { updateBrief } from '../src/core/brief';
import { encode } from 'gpt-tokenizer';
import { estimateMeter, type LimitEvent, type Meter } from '../src/core/limits';
import { archiveWindow, mergeTurnWindows, type TurnArchive } from '../src/core/capture';
import type { Extraction } from '../src/core/adapter';
import { readUsageWindows, activeWindows, windowLabel, type UsageWindow } from '../src/core/usage-windows';
import { composerStatusText, statusLinePosition } from '../src/core/composer-status';

export default defineContentScript({
  matches: ['https://chatgpt.com/*', 'https://claude.ai/*', 'https://gemini.google.com/*', 'https://chat.deepseek.com/*', 'https://grok.com/*', 'https://www.perplexity.ai/*'],
  main(ctx) {
    const id = providerIds.find(p => bundledSelectors.providers[p].hosts.includes(location.hostname)) as ProviderId | undefined;
    if (!id) return;
    document.getElementById('handoff-composer-status')?.remove();
    let timer: number | undefined;
    const pageUrl = () => location.origin + location.pathname + location.search + location.hash;
    const storageKeys = () => { const key = `brief:${pageUrl()}`; return { key, highWaterKey: `visibleTurnsHighWater:${key}`, archiveKey: `archive:${key}` }; };
    const genericNewChat = () => id === 'gemini' && location.pathname === '/app';
    const limitHistoryKey = `limitEvents:${id}`;
    let captureInProgress = false;
    let latestMeter: Meter | undefined;
    let latestWindows: UsageWindow[] = [];
    let composerUsageEnabled = true;
    const statusHost = document.createElement('div');
    statusHost.id = 'handoff-composer-status';
    statusHost.setAttribute('role', 'note');
    statusHost.setAttribute('aria-label', 'Handoff usage information');
    statusHost.style.cssText = 'position:fixed;z-index:2147483000;pointer-events:none;display:none';
    const shadow = statusHost.attachShadow({ mode: 'closed' });
    const statusStyle = document.createElement('style');
    statusStyle.textContent = ':host{all:initial}span{display:inline-block;max-width:100%;padding:2px 7px;border-radius:5px;background:#172538;color:#f7f9fc;font:10px/14px system-ui,-apple-system,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 4px #0003}@media(prefers-color-scheme:light){span{background:#eef3ff;color:#233754}}';
    const statusText = document.createElement('span');
    statusStyle.textContent += 'progress{width:32px;height:4px;accent-color:#a99aff;vertical-align:middle;margin:0 4px}';
    shadow.append(statusStyle, statusText);
    document.body.append(statusHost);
    let statusFrame = 0;
    let lastPrompt = '';
    let lastPromptTokens = 0;
    let lastLimitText: string | undefined;
    let lastLimitCheck = 0;
    const updateStatus = () => {
      statusFrame = 0;
      const editor = bundledSelectors.providers[id].editor.map(selector => document.querySelector(selector)).find(Boolean) as HTMLElement | undefined;
      if (!editor || !composerUsageEnabled) { statusHost.style.display = 'none'; return; }
      const editorRect = editor.getBoundingClientRect();
      let surface: Element = editor;
      let ancestor = editor.parentElement;
      for (let depth = 0; ancestor && depth < 5 && !ancestor.matches('body,main'); depth++, ancestor = ancestor.parentElement) {
        const rect = ancestor.getBoundingClientRect();
        if (rect.width >= editorRect.width * 0.85 && rect.height <= 360 && rect.bottom >= editorRect.bottom + 10) surface = ancestor;
      }
      const position = statusLinePosition(surface.getBoundingClientRect(), innerWidth, innerHeight);
      if (!position) { statusHost.style.display = 'none'; return; }
      const sampleX = position.left + Math.min(90, position.width / 2);
      const occupied = document.elementFromPoint(sampleX, position.top + 16);
      for (let element = occupied; element && element !== document.body && element !== document.documentElement; element = element.parentElement) {
        if (element === surface || element.contains(surface)) break;
        const rect = element.getBoundingClientRect();
        if (rect.width >= 180 && rect.height <= 64 && rect.top < position.top + 19 && rect.bottom > position.top) {
          position.top = rect.bottom + 2;
          break;
        }
      }
      if (position.top + 19 > innerHeight) { statusHost.style.display = 'none'; return; }
      const below = document.elementFromPoint(sampleX, position.top + 8);
      if (below?.closest('button,input,textarea,select,[contenteditable="true"],[role="button"]')) { statusHost.style.display = 'none'; return; }
      const value = editor instanceof HTMLTextAreaElement ? editor.value : editor.textContent || '';
      const fresh = latestMeter?.at && Date.now() - latestMeter.at < 3600000 && (!latestMeter.resetAt || latestMeter.resetAt > Date.now());
      if (value !== lastPrompt) { lastPrompt = value; lastPromptTokens = encode(value).length; }
      const windows = activeWindows(latestWindows);
      statusText.replaceChildren();
      if (windows.length) {
        if (lastPromptTokens) statusText.append(`≈${lastPromptTokens} prompt tokens · `);
        windows.slice(0, 2).forEach((win, index) => {
          if (index) statusText.append(' · ');
          statusText.append(windowLabel(win));
          if (win.percent !== undefined) { const bar = document.createElement('progress'); bar.max = 100; bar.value = win.percent; bar.setAttribute('aria-label', `${win.feature}: ${win.percent}% used`); statusText.append(bar); }
        });
      } else statusText.textContent = composerStatusText(lastPromptTokens, fresh ? latestMeter : undefined);
      statusText.title = windows.length ? windows.map(win => `${windowLabel(win)} (shown on service page)`).join('\n') : 'Remaining allowance has not been exposed by this service. Prompt tokens are approximate and do not measure your remaining allowance.';
      statusHost.style.left = `${position.left}px`;
      statusHost.style.top = `${position.top}px`;
      statusHost.style.maxWidth = `${position.width}px`;
      statusHost.style.display = 'block';
    };
    const scheduleStatus = () => { if (!statusFrame) statusFrame = requestAnimationFrame(updateStatus); };
    ctx.addEventListener(document, 'input', scheduleStatus, { capture: true });
    ctx.addEventListener(document, 'focusin', scheduleStatus, { capture: true });
    ctx.addEventListener(document, 'scroll', scheduleStatus, { capture: true });
    ctx.addEventListener(window, 'resize', scheduleStatus);
    void chrome.storage.local.get([`meter:${id}`, `usageWindows:${id}`, 'composerUsageEnabled']).then(saved => { latestMeter = saved[`meter:${id}`] as Meter | undefined; latestWindows = (saved[`usageWindows:${id}`] || []) as UsageWindow[]; composerUsageEnabled = saved.composerUsageEnabled !== false; scheduleStatus(); });
    ctx.setInterval(() => { void chrome.storage.local.get(`meter:${id}`).then(saved => { latestMeter = saved[`meter:${id}`] as Meter | undefined; scheduleStatus(); }); }, 30000);
    const observeUsage = async (force = false) => {
      const now = Date.now();
      const visibleWindows = readUsageWindows(document, id, collectTurnNodes(document, id, bundledSelectors), now);
      if (visibleWindows.length) {
        latestWindows = visibleWindows;
        const strongest = [...visibleWindows].sort((a, b) => (b.percent || 0) - (a.percent || 0))[0];
        latestMeter = strongest;
        scheduleStatus();
        await chrome.storage.local.set({ [`usageWindows:${id}`]: visibleWindows, [`meter:${id}`]: strongest });
        for (const meter of [...visibleWindows].sort((a, b) => (a.percent || 0) - (b.percent || 0))) void chrome.runtime.sendMessage({ type: 'OBSERVE_USAGE', provider: id, meter }).catch(() => {});
        return;
      }
      const signal = makeAdapter(id, bundledSelectors).detectLimit(document);
      if (signal.kind === 'unknown') {
        const savedMeter = (await chrome.storage.local.get(`meter:${id}`))[`meter:${id}`] as Meter | undefined;
        if (savedMeter?.tier === 'banner' && savedMeter.at && now - savedMeter.at < 3600000) { latestMeter = savedMeter; scheduleStatus(); return; }
      }
      const sameSignal = signal.text === lastLimitText;
      if (!force && sameSignal && now - lastLimitCheck < 600000) return;
      lastLimitText = signal.text;
      lastLimitCheck = now;
      const meter = { ...estimateMeter(id, signal.text, [], [], now), at: now };
      if (sameSignal && latestMeter?.resetAt && latestMeter.resetAt > now) meter.resetAt = latestMeter.resetAt;
      latestMeter = meter;
      scheduleStatus();
      await chrome.storage.local.set({ [`meter:${id}`]: meter });
      if (meter.tier === 'banner') void chrome.runtime.sendMessage({ type: 'OBSERVE_USAGE', provider: id, meter }).catch(() => {});
    };
    ctx.setInterval(() => { void observeUsage(); }, 30000);
    const settingsChanged = (changes: Record<string, chrome.storage.StorageChange>) => { if (changes.composerUsageEnabled) { composerUsageEnabled = changes.composerUsageEnabled.newValue !== false; scheduleStatus(); } };
    chrome.storage.onChanged.addListener(settingsChanged);
    ctx.onInvalidated(() => chrome.storage.onChanged.removeListener(settingsChanged));
    scheduleStatus();
    const captureOlderTurns = async (): Promise<Extraction> => {
      const initial = extract(document, id, bundledSelectors);
      const firstTurn = collectTurnNodes(document, id, bundledSelectors)[0];
      if (!firstTurn) return initial;
      let container: Element | null = firstTurn.parentElement;
      while (container && container.scrollHeight <= container.clientHeight + 40) container = container.parentElement;
      const scroller = (container || document.scrollingElement) as Element | null;
      if (!scroller || scroller.scrollHeight <= scroller.clientHeight + 40) return { ...initial, warning: [initial.warning, 'Older messages could not be loaded automatically.'].filter(Boolean).join(' ') };

      const originalTop = scroller.scrollTop;
      const originalHeight = scroller.scrollHeight;
      const originalAnchorTop = firstTurn.getBoundingClientRect().top;
      const captureUrl = pageUrl();
      const startedAt = Date.now();
      let turns = initial.turns;
      const artifacts = [...initial.artifacts];
      let stalled = 0;
      let reachedTop = false;
      let settlingTimedOut = false;
      captureInProgress = true;
      const readSettled = async () => {
        let next = extract(document, id, bundledSelectors);
        let previous = '', stable = 0;
        const deadline = Date.now() + 900;
        while (Date.now() < deadline) {
          if (ctx.isInvalid || pageUrl() !== captureUrl) throw new Error('The chat changed during capture. Capture the current conversation again.');
          const signature = next.turns.map(turn => `${turn.id || turn.role}:${turn.text}`).join('\u0000');
          stable = signature === previous ? stable + 1 : 0;
          if (stable >= 2) return next;
          previous = signature;
          await new Promise(resolve => setTimeout(resolve, 90));
          next = extract(document, id, bundledSelectors);
        }
        settlingTimedOut = true;
        return next;
      };
      const ingest = (next: Extraction) => {
        turns = mergeTurnWindows(next.turns, turns);
        for (const artifact of next.artifacts) if (!artifacts.some(saved => saved.name === artifact.name && saved.content === artifact.content)) artifacts.push(artifact);
      };
      try {
        // Begin at the newest messages even when the user was reading the middle.
        scroller.scrollTop = scroller.scrollHeight;
        scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
        const newest = await readSettled();
        if (newest.turns.length) turns = newest.turns;
        ingest(newest);
        for (let attempt = 0; attempt < 100 && Date.now() - startedAt < 25000; attempt++) {
          const before = scroller.scrollTop;
          const step = Math.max(180, Math.floor(scroller.clientHeight * 0.6));
          scroller.scrollTop = Math.max(0, before - step);
          scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
          const next = await readSettled();
          const previousCount = turns.length;
          ingest(next);
          stalled = scroller.scrollTop <= 1 && turns.length === previousCount ? stalled + 1 : 0;
          if (stalled >= 3) { reachedTop = true; break; }
        }
      } finally {
        if (pageUrl() === captureUrl) {
          scroller.scrollTop = originalTop;
          if (firstTurn.isConnected) scroller.scrollTop += firstTurn.getBoundingClientRect().top - originalAnchorTop;
          else if (originalTop > 0) scroller.scrollTop = Math.max(0, originalTop + scroller.scrollHeight - originalHeight);
          scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
        }
        captureInProgress = false;
      }
      return { ...initial, turns, artifacts, incomplete: true, warning: [
        reachedTop ? 'Scrolled to the start; only text rendered by the service could be collected.' : 'Capture stopped at its time or scroll bound; older messages may still be missing.',
        settlingTimedOut ? 'Some replies were still changing during capture. Wait for the reply to finish and capture again.' : ''
      ].filter(Boolean).join(' ') };
    };

    const persist = async () => {
      if (captureInProgress || ctx.isInvalid) return;
      await observeUsage();
      const captureUrl = pageUrl();
      const data = extract(document, id, bundledSelectors);
      const signal = makeAdapter(id, bundledSelectors).detectLimit(document);
      if (!data.turns.length) return;
      const { key, highWaterKey, archiveKey } = storageKeys();
      const saved = await chrome.storage.local.get([highWaterKey, archiveKey, limitHistoryKey, `meter:${id}`]);
      if (captureUrl !== pageUrl()) return;
      const history = Array.isArray(saved[limitHistoryKey]) ? saved[limitHistoryKey] as LimitEvent[] : [];
      const now = Date.now();
      const reachedLimit = signal.kind === 'banner' && estimateMeter(id, signal.text, [], [], now).percent === 100;
      if (reachedLimit && !history.some(event => now - event.at < 3600000)) {
        history.push({ at: now, approximateTokens: data.turns.reduce((sum, turn) => sum + encode(turn.text).length, 0) });
        await chrome.storage.local.set({ [limitHistoryKey]: history.slice(-12) });
      }
      const previousArchive = genericNewChat() ? undefined : saved[archiveKey] as TurnArchive | undefined;
      const archive = archiveWindow(previousArchive?.selectorsVersion === bundledSelectors.version ? previousArchive : undefined, data.turns, now);
      archive.selectorsVersion = bundledSelectors.version;
      const calculatedMeter = { ...estimateMeter(id, signal.text, archive.turns.map(turn => turn.text), history, now), at: now };
      const storedMeter = saved[`meter:${id}`] as Meter | undefined;
      const meter = signal.kind === 'unknown' && storedMeter?.tier === 'banner' && storedMeter.at && now - storedMeter.at < 3600000 ? storedMeter : calculatedMeter;
      if (signal.text === lastLimitText && latestMeter?.resetAt && latestMeter.resetAt > now) meter.resetAt = latestMeter.resetAt;
      latestMeter = meter;
      scheduleStatus();
      const brief = updateBrief(undefined, archive.turns, data.artifacts);
      await chrome.storage.local.set({ [key]: brief, [`savedAt:${key}`]: now, [highWaterKey]: previousArchive?.selectorsVersion === bundledSelectors.version ? Math.max(Number(saved[highWaterKey]) || 0, archive.turns.length) : archive.turns.length, [`health:${id}`]: { at: now, turns: data.turns.length, selectorsVersion: bundledSelectors.version }, [`meter:${id}`]: meter });
      try { await chrome.storage.local.set({ [archiveKey]: archive }); } catch { /* Brief remains available if local storage is full. */ }
    };
    const editorSelectors = bundledSelectors.providers[id].editor;
    const inEditor = (target: Node): boolean => {
      const element = target instanceof Element ? target : target.parentElement;
      return !!element && editorSelectors.some(selector => element.closest(selector));
    };
    const observer = new MutationObserver(mutations => {
      scheduleStatus();
      if (mutations.every(mutation => inEditor(mutation.target))) return;
      clearTimeout(timer);
      timer = ctx.setTimeout(() => { void persist().catch(() => {}); }, 1600);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    void persist().catch(() => {});
    const onMessage: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (message, _sender, sendResponse) => {
      if (message?.type === 'PING') { sendResponse({ ready: true, provider: id }); return; }
      if (message?.type === 'REFRESH_USAGE') {
        void observeUsage(true).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
        return true;
      }
      if (message?.type === 'EXTRACT') {
        void (async () => {
          const captureUrl = pageUrl();
          const { key, highWaterKey, archiveKey } = storageKeys();
          const result = message.includeOlder ? await captureOlderTurns() : extract(document, id, bundledSelectors);
          if (captureUrl !== pageUrl()) throw new Error('The chat changed during capture. Capture the current conversation again.');
          const editor = bundledSelectors.providers[id].editor.map(selector => document.querySelector(selector)).find(Boolean);
          const pendingPrompt = editor instanceof HTMLTextAreaElement ? editor.value : (editor?.textContent || '');
          if (!result.turns.length && !result.artifacts.length) {
            sendResponse({ provider: id, turnCount: 0, hasUserTurn: false, artifactCount: 0, incomplete: false, archiveSaved: true, warning: '', pendingPrompt: pendingPrompt.trim().slice(0, 8000), meter: estimateMeter(id, makeAdapter(id, bundledSelectors).detectLimit(document).text, [], []), url: pageUrl() });
            return;
          }
          const saved = await chrome.storage.local.get([highWaterKey, archiveKey, limitHistoryKey, `meter:${id}`]);
          const previousArchive = genericNewChat() ? undefined : saved[archiveKey] as TurnArchive | undefined;
          const archive = archiveWindow(previousArchive?.selectorsVersion === bundledSelectors.version ? previousArchive : undefined, result.turns);
          archive.selectorsVersion = bundledSelectors.version;
          let archiveSaved = true;
          const brief = updateBrief(undefined, archive.turns, result.artifacts);
          try { await chrome.storage.local.set({ [archiveKey]: archive, [key]: brief, [`savedAt:${key}`]: Date.now() }); } catch { archiveSaved = false; }
          const hadMoreTurns = previousArchive?.selectorsVersion === bundledSelectors.version && Number(saved[highWaterKey]) > archive.turns.length;
          const sourceWarning = !result.turns.some(turn => turn.role === 'user') && archive.turns.some(turn => turn.role === 'user') ? 'The original request was restored from this chat’s saved capture.' : result.warning;
          const warning = [sourceWarning, archive.incomplete ? 'Some captured windows did not overlap; transcript order or gaps need review.' : '', archive.truncated ? 'The local transcript reached its size cap; earliest text was trimmed.' : '', archiveSaved ? '' : 'Local storage is full; captured text could not be saved.', hadMoreTurns ? 'This chat previously showed more turns; older messages may be virtualized. Review the brief.' : ''].filter(Boolean).join(' ');
          const limit = makeAdapter(id, bundledSelectors).detectLimit(document);
          const history = Array.isArray(saved[limitHistoryKey]) ? saved[limitHistoryKey] as LimitEvent[] : [];
          const observed = estimateMeter(id, limit.text, archive.turns.map(turn => turn.text), history);
          const storedMeter = saved[`meter:${id}`] as Meter | undefined;
          const meter = limit.kind === 'unknown' && storedMeter?.tier === 'banner' && storedMeter.at && Date.now() - storedMeter.at < 3600000 ? storedMeter : observed;
          sendResponse({ provider: id, turnCount: archive.turns.length, hasUserTurn: archive.turns.some(turn => turn.role === 'user'), artifactCount: result.artifacts.length, incomplete: result.incomplete || archive.incomplete || archive.truncated || !archiveSaved || hadMoreTurns, archiveSaved, warning, pendingPrompt: pendingPrompt.trim().slice(0, 8000), brief, meter, url: pageUrl() });
        })().catch(error => sendResponse({ error: String(error) }));
        return true;
      }
      if (message?.type === 'INJECT_DRAFT' && typeof message.text === 'string') {
        if (!makeAdapter(id, bundledSelectors).injectDraft(document, message.text)) { sendResponse({ ok: false }); return; }
        setTimeout(() => {
          const editor = bundledSelectors.providers[id].editor.map(selector => document.querySelector(selector)).find(Boolean);
          const actual = editor instanceof HTMLTextAreaElement ? editor.value : editor?.textContent;
          sendResponse({ ok: actual === message.text });
        }, 400);
        return true;
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    ctx.onInvalidated(() => {
      observer.disconnect(); clearTimeout(timer); cancelAnimationFrame(statusFrame); statusHost.remove();
      chrome.runtime.onMessage.removeListener(onMessage);
    });
  }
});
