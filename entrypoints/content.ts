import { defineContentScript } from 'wxt/utils/define-content-script';
import { bundledSelectors, providerIds, type ProviderId } from '../src/core/selectors';
import { collectTurnNodes, extract, findEditor, makeAdapter } from '../src/core/adapter';
import { draftBudget, redact, renderBrief, updateBrief, wrapHandoff } from '../src/core/brief';
import { saveCapturedCapsule } from '../src/core/capsules';
import { accountSwitch, newChatUrls, providerNames, reachedLimit } from '../src/core/rescue';
import { addPick, suggest, suggestionKeys, topicNames, topics, type TaskPicks, type Topic } from '../src/core/task-fit';
import { buildRescueCard, rescueCardStyle } from '../src/core/rescue-card';
import { encode } from 'gpt-tokenizer';
import { estimateMeter, parseStatedLimit, type LimitEvent, type Meter, type StatedLimit } from '../src/core/limits';
import { archiveWindow, mergeTurnWindows, type TurnArchive } from '../src/core/capture';
import type { Extraction } from '../src/core/adapter';
import { readUsageWindows, activeWindows, mergeUsageWindows, isCurrentReading, isUsagePageUrl, windowLabel, type UsageWindow } from '../src/core/usage-windows';
import { composerStatusText } from '../src/core/composer-status';
import { displayLabel, displayWindows, recordReadings, type UsageHistory } from '../src/core/usage-estimate';
import { chatFeature, chatSegments, type Segment } from '../src/core/composer-line';
import { messageSummary, recordLimitHit, type LimitHit } from '../src/core/message-counts';

export default defineContentScript({
  matches: ['https://chatgpt.com/*', 'https://claude.ai/*', 'https://gemini.google.com/*', 'https://chat.deepseek.com/*', 'https://grok.com/*', 'https://www.perplexity.ai/*'],
  main(ctx) {
    const id = providerIds.find(p => bundledSelectors.providers[p].hosts.includes(location.hostname)) as ProviderId | undefined;
    if (!id) return;
    document.getElementById('handoff-composer-status')?.remove();
    let timer: number | undefined;
    // Site and path only: query strings such as Grok's “?rid=…” change with every reply.
    const pageUrl = () => location.origin + location.pathname;
    const storageKeys = () => { const key = `brief:${pageUrl()}`; return { key, highWaterKey: `visibleTurnsHighWater:${key}`, archiveKey: `archive:${key}` }; };
    const genericNewChat = () => id === 'gemini' && location.pathname === '/app';
    const limitHistoryKey = `limitEvents:${id}`;
    let captureInProgress = false;
    let latestMeter: Meter | undefined;
    let latestWindows: UsageWindow[] = [];
    let latestHistory: UsageHistory = {};
    let latestSends: number[] = [];
    let latestHits: LimitHit[] = [];
    let latestStated: StatedLimit | undefined;
    // When the service shows its limit, remember how many messages were sent in the window; this teaches the learned limit.
    const noteLimitHit = async () => {
      if (!reachedLimit({ [`usageWindows:${id}`]: latestWindows, [`meter:${id}`]: latestMeter }, id)) return;
      const key = `limitHits:${id}`;
      const hits = ((await chrome.storage.local.get(key))[key] || []) as LimitHit[];
      const next = recordLimitHit(hits, latestSends, id, Date.now(), latestStated);
      if (next !== hits) { latestHits = next; await chrome.storage.local.set({ [key]: next }); }
    };
    let composerUsageEnabled = true;
    const statusHost = document.createElement('div');
    statusHost.id = 'handoff-composer-status';
    statusHost.setAttribute('role', 'note');
    statusHost.setAttribute('aria-label', 'Baton usage information');
    statusHost.style.cssText = 'position:fixed;z-index:2147483000;pointer-events:none;display:none';
    const shadow = statusHost.attachShadow({ mode: 'closed' });
    const statusStyle = document.createElement('style');
    // A premium pill under the composer: baton mark, then ring-gauge segments “SESSION ◔ 54% left · 3h 1m”.
    statusStyle.textContent = ':host{all:initial}.line{display:inline-flex;align-items:center;gap:10px;max-width:100%;box-sizing:border-box;height:26px;padding:0 12px 0 9px;border-radius:999px;background:linear-gradient(180deg,rgba(44,43,60,.94),rgba(25,24,35,.94));border:1px solid rgba(255,255,255,.1);box-shadow:0 8px 22px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.07);-webkit-backdrop-filter:blur(12px) saturate(1.2);backdrop-filter:blur(12px) saturate(1.2);color:#f4f3fb;font:500 11px/1 system-ui,-apple-system,"SF Pro Text",sans-serif;font-variant-numeric:tabular-nums;letter-spacing:.1px;white-space:nowrap;overflow:hidden}.body{display:inline-flex;align-items:center;gap:10px;min-width:0;overflow:hidden}.brand{flex:none;width:13px;height:4px;border-radius:2px;transform:rotate(-35deg);background:repeating-linear-gradient(90deg,#b8a5ff 0 3px,rgba(255,255,255,.45) 3px 4px);box-shadow:0 0 6px rgba(176,154,255,.45)}.seg{display:inline-flex;align-items:center;gap:6px;min-width:0}.seg+.seg:before{content:"";flex:none;width:1px;height:12px;background:linear-gradient(180deg,transparent,rgba(255,255,255,.22),transparent);margin-right:4px}.k{font-size:8.5px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:#a3a1ba}.v{font-weight:700;color:#fff}.u{color:#bdbbd1;font-weight:500;margin-left:-3px}.n{color:#8f8da6;font-weight:500}.ring{flex:none;width:13px;height:13px;border-radius:50%;background:conic-gradient(var(--c) calc(var(--p) * 1%),rgba(255,255,255,.14) 0);-webkit-mask:radial-gradient(circle,transparent 3.6px,#000 4.2px);mask:radial-gradient(circle,transparent 3.6px,#000 4.2px)}.ok{--c:#34d1b0}.mid{--c:#f5b94a}.low{--c:#ff6b6b}.quiet{color:#8f8da6;font-weight:500}.x{all:unset;pointer-events:auto;cursor:pointer;flex:none;display:grid;place-items:center;width:16px;height:16px;margin:0 -6px 0 -2px;border-radius:50%;color:#a3a1ba;font:600 12px/1 system-ui,sans-serif;opacity:.7;transition:opacity .15s,background .15s}.line:hover .x,.x:focus-visible{opacity:1}.x:hover{background:rgba(255,255,255,.12);color:#fff}.x:focus-visible{outline:2px solid #b8a5ff;outline-offset:1px}.line{pointer-events:auto}@media(prefers-color-scheme:light){.line{background:linear-gradient(180deg,rgba(255,255,255,.97),rgba(246,245,251,.97));border-color:rgba(30,25,70,.1);color:#1e1d2b;box-shadow:0 6px 18px rgba(30,25,70,.12),inset 0 1px 0 #fff}.v{color:#16151f}.k{color:#6d6a86}.u{color:#4b4963}.n,.quiet{color:#7d7a95}.ring{background:conic-gradient(var(--c) calc(var(--p) * 1%),rgba(30,25,70,.12) 0)}.seg+.seg:before{background:linear-gradient(180deg,transparent,rgba(30,25,70,.2),transparent)}.brand{background:repeating-linear-gradient(90deg,#6650de 0 3px,rgba(0,0,0,.2) 3px 4px);box-shadow:none}.x{color:#6d6a86}.x:hover{background:rgba(30,25,70,.08);color:#16151f}.ok{--c:#14a387}.mid{--c:#d98a0b}.low{--c:#e04848}}';
    // The pill is built once: brand, a body that is refilled only when its content changes, and the ×.
    // Rebuilding the × on every page mutation (streaming replies) used to lose the press.
    const statusText = document.createElement('span');
    statusText.className = 'line';
    const statusBrand = document.createElement('i'); statusBrand.className = 'brand'; statusBrand.setAttribute('aria-hidden', 'true');
    const statusBody = document.createElement('span'); statusBody.className = 'body';
    const hideBar = document.createElement('button'); hideBar.type = 'button'; hideBar.className = 'x'; hideBar.textContent = '×';
    hideBar.title = 'Hide the usage bar (turn it back on in Baton → Usage)'; hideBar.setAttribute('aria-label', 'Hide the usage bar. Turn it back on in Baton, Usage.');
    const hideStatus = (event: Event) => { event.preventDefault(); event.stopPropagation(); composerUsageEnabled = false; statusHost.style.display = 'none'; statusPlacement = ''; void chrome.storage.local.set({ composerUsageEnabled: false }); };
    hideBar.addEventListener('pointerdown', hideStatus);
    hideBar.addEventListener('click', hideStatus);
    statusText.append(statusBrand, statusBody, hideBar);
    let statusPlacement = '';
    shadow.append(statusStyle, statusText);
    document.body.append(statusHost);
    // Limit rescue: interactive, shown only while the service reports a limit, placed above the composer.
    const rescueHost = document.createElement('div');
    rescueHost.id = 'handoff-limit-rescue';
    rescueHost.style.cssText = 'position:fixed;z-index:2147483001;display:none';
    const rescueShadow = rescueHost.attachShadow({ mode: 'closed' });
    const rescueStyle = document.createElement('style');
    rescueStyle.textContent = rescueCardStyle;
    rescueShadow.append(rescueStyle);
    document.body.append(rescueHost);
    let rescueSignature = '';
    let dismissedRescue = '';
    const positionRescue = () => {
      if (rescueHost.style.display === 'none') return;
      const width = Math.min(420, innerWidth - 32);
      const editor = findEditor(document, bundledSelectors.providers[id].editor);
      const rect = editor ? (editor.closest('form') || editor).getBoundingClientRect() : undefined;
      const left = rect && rect.width ? rect.left + (rect.width - width) / 2 : (innerWidth - width) / 2;
      const bottom = rect && rect.height ? innerHeight - rect.top + 10 : 24;
      rescueHost.style.width = `${width}px`;
      rescueHost.style.left = `${Math.max(16, Math.min(left, innerWidth - width - 16))}px`;
      rescueHost.style.bottom = `${bottom > innerHeight - 160 ? 24 : bottom}px`;
    };
    const rescueDraft = async () => {
      const data = extract(document, id, bundledSelectors);
      const { archiveKey } = storageKeys();
      const previous = genericNewChat() ? undefined : (await chrome.storage.local.get(archiveKey))[archiveKey] as TurnArchive | undefined;
      const archive = archiveWindow(previous?.selectorsVersion === bundledSelectors.version ? previous : undefined, data.turns);
      if (!archive.turns.length) throw new Error('There is no conversation on this page to carry over yet.');
      const brief = updateBrief(undefined, archive.turns, data.artifacts);
      await saveCapturedCapsule(archive, brief, pageUrl(), document.title);
      return redact(wrapHandoff(renderBrief(brief, 1400).text)).text;
    };
    // Shared by the rescue card and the Baton button: save a baton, then open the target with the project as an unsent draft.
    const passTo = async (target: ProviderId) => {
      const draft = await rescueDraft();
      if (!draftBudget(draft).fits) return 'Saved as a baton. This project is too long for a one-click draft; open Baton to review and shorten it.';
      const opened = await chrome.runtime.sendMessage({ type: 'OPEN_DRAFT', url: newChatUrls[target], text: draft });
      if (!opened?.ok) throw new Error(`Could not open ${providerNames[target]}. Your project is saved in Baton.`);
      return `Opened ${providerNames[target]} in a new tab with your project as an unsent draft. Also saved as a baton.`;
    };
    const updateRescue = async () => {
      const saved = await chrome.storage.local.get(suggestionKeys());
      const limit = reachedLimit(saved, id);
      const signature = limit ? `${limit.feature}:${limit.resetAt ?? ''}` : '';
      if (!limit || signature === dismissedRescue) { rescueHost.style.display = 'none'; rescueShadow.querySelector('.card')?.remove(); rescueSignature = ''; return; }
      if (signature === rescueSignature) return;
      rescueSignature = signature;
      const name = providerNames[id];
      // Ranked for what this chat is about, the same as the Baton menu.
      const asked = extract(document, id, bundledSelectors).turns.filter(turn => turn.role === 'user').slice(-3).map(turn => turn.text).join('\n');
      const card = buildRescueCard(document, limit, suggest(asked, id, saved).options, {
        continueIn: passTo,
        switchAccount: async () => {
          const draft = await rescueDraft();
          const help = accountSwitch(id);
          if (help.url) window.open(help.url, '_blank', 'noopener');
          try { await navigator.clipboard.writeText(draft); } catch { return `Saved as a baton; copying was blocked, so copy it from Baton. ${help.steps}`; }
          return `Project copied and saved as a baton. ${help.steps}`;
        },
        remind: async () => {
          const reply = await chrome.runtime.sendMessage({ type: 'REMIND_AT_RESET', provider: id, resetAt: limit.resetAt });
          if (!reply?.ok) throw new Error('Could not set the reminder.');
          const at = new Date(limit.resetAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return reply.notifications ? `I’ll send a desktop alert when ${name} resets (${at}).` : `I’ll mark the Baton icon when ${name} resets (${at}). Turn on desktop alerts in Baton → Usage for a pop-up.`;
        },
        dismiss: () => { dismissedRescue = rescueSignature; rescueHost.style.display = 'none'; }
      });
      rescueShadow.querySelector('.card')?.remove();
      rescueShadow.append(card);
      rescueHost.style.display = 'block';
      positionRescue();
    };
    const rescueChanged = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (Object.keys(changes).some(key => key.startsWith('usageWindows:') || key.startsWith('meter:') || key === 'enabledProviders')) void updateRescue().catch(() => {});
    };
    chrome.storage.onChanged.addListener(rescueChanged);
    ctx.onInvalidated(() => { chrome.storage.onChanged.removeListener(rescueChanged); rescueHost.remove(); });
    void updateRescue().catch(() => {});
    // Baton button: a round shortcut just outside the composer's bottom-right corner. Its menu lists the other AIs,
    // ranked by room left (the best one marked “Suggested”); picking one passes the chat as an unsent draft.
    const passHost = document.createElement('div');
    passHost.id = 'handoff-pass';
    passHost.style.cssText = 'position:fixed;z-index:2147483002;display:none;width:28px;height:28px';
    const passShadow = passHost.attachShadow({ mode: 'closed' });
    const passStyle = document.createElement('style');
    passStyle.textContent = ':host{all:initial}.pass{all:unset;box-sizing:border-box;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;cursor:pointer;background:linear-gradient(180deg,rgba(44,43,60,.96),rgba(25,24,35,.96));border:1px solid rgba(255,255,255,.12);box-shadow:0 6px 16px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.08);transition:transform .15s,box-shadow .15s}.pass:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(0,0,0,.42),0 0 0 3px rgba(176,154,255,.22)}.pass:focus-visible{outline:2px solid #b8a5ff;outline-offset:2px}.brand{width:14px;height:5px;border-radius:3px;transform:rotate(-35deg);background:repeating-linear-gradient(90deg,#b8a5ff 0 3px,rgba(255,255,255,.5) 3px 4px);box-shadow:0 0 6px rgba(176,154,255,.5)}.menu{position:fixed;width:272px;box-sizing:border-box;padding:10px;border-radius:14px;background:linear-gradient(180deg,rgba(40,39,55,.98),rgba(24,23,33,.98));border:1px solid rgba(255,255,255,.1);box-shadow:0 18px 44px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.06);color:#f4f3fb;font:500 12px/1.35 system-ui,-apple-system,sans-serif;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}.menu[hidden]{display:none}.menu h2{all:unset;display:block;font-size:13px;font-weight:700;margin:2px 4px 2px}.menu p{margin:0 4px 8px;color:#a3a1ba;font-size:10.5px}.opt{all:unset;box-sizing:border-box;display:grid;grid-template-columns:8px 1fr auto;align-items:center;gap:8px;width:100%;padding:8px;border-radius:9px;cursor:pointer}.opt:hover:not([aria-disabled=true]),.opt:focus-visible{background:rgba(255,255,255,.07)}.opt[aria-disabled=true]{opacity:.45;cursor:default}.dot{width:8px;height:8px;border-radius:50%;background:var(--c)}.opt b{font-weight:650}.opt small{display:block;color:#a3a1ba;font-size:10px}.tag{font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#1b1430;background:#b8a5ff;border-radius:999px;padding:2px 7px}.row{display:flex;gap:6px;margin-top:6px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08)}.row button{all:unset;flex:1;text-align:center;padding:6px;border-radius:8px;cursor:pointer;color:#cfcde0;font-size:11px}.row button:hover,.row button:focus-visible{background:rgba(255,255,255,.07)}.status{margin:8px 4px 2px;color:#cfcde0;font-size:10.5px}.status:empty{display:none}.tasks{display:flex;flex-wrap:wrap;gap:4px;margin:0 2px 8px}.chip{all:unset;cursor:pointer;font-size:10px;font-weight:600;padding:3px 8px;border-radius:999px;color:#cfcde0;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)}.chip:hover,.chip:focus-visible{background:rgba(255,255,255,.12)}.chip[aria-pressed=true]{background:#b8a5ff;color:#1b1430;border-color:transparent}@media(prefers-color-scheme:light){.pass{background:linear-gradient(180deg,#fff,#f4f3fa);border-color:rgba(30,25,70,.12);box-shadow:0 6px 16px rgba(30,25,70,.15)}.brand{background:repeating-linear-gradient(90deg,#6650de 0 3px,rgba(0,0,0,.2) 3px 4px);box-shadow:none}.menu{background:linear-gradient(180deg,#fff,#f7f6fb);border-color:rgba(30,25,70,.1);color:#1e1d2b;box-shadow:0 18px 40px rgba(30,25,70,.18)}.menu p,.opt small{color:#6d6a86}.opt:hover:not([aria-disabled=true]),.row button:hover{background:rgba(30,25,70,.06)}.row{border-color:rgba(30,25,70,.1)}.row button,.status{color:#3d3b52}.tag{background:#6650de;color:#fff}.chip{color:#3d3b52;background:rgba(30,25,70,.05);border-color:rgba(30,25,70,.1)}.chip[aria-pressed=true]{background:#6650de;color:#fff}}@media(prefers-reduced-motion:reduce){.pass{transition:none}}';
    const passButton = document.createElement('button');
    passButton.type = 'button'; passButton.className = 'pass';
    passButton.title = 'Pass the baton to another AI'; passButton.setAttribute('aria-label', 'Pass the baton to another AI'); passButton.setAttribute('aria-haspopup', 'menu');
    const passMark = document.createElement('i'); passMark.className = 'brand'; passMark.setAttribute('aria-hidden', 'true'); passButton.append(passMark);
    const passMenu = document.createElement('div'); passMenu.className = 'menu'; passMenu.setAttribute('role', 'menu'); passMenu.hidden = true;
    passShadow.append(passStyle, passButton, passMenu);
    document.body.append(passHost);
    let passEnabled = true;
    const laneColor: Record<ProviderId, string> = { claude: '#d97757', gemini: '#4c8df6', chatgpt: '#10a37f', deepseek: '#4d6bfe', grok: '#9aa3ad', perplexity: '#20b8cd' };
    const closePassMenu = () => { passMenu.hidden = true; passButton.setAttribute('aria-expanded', 'false'); };
    const openPassMenu = async (chosen?: Topic) => {
      const saved = await chrome.storage.local.get(suggestionKeys());
      // Suggest by what the prompt is about: the text being typed, else the last few things the user asked.
      const editor = findEditor(document, bundledSelectors.providers[id].editor);
      const typed = editor instanceof HTMLTextAreaElement ? editor.value : editor?.textContent || '';
      const asked = typed.trim() || extract(document, id, bundledSelectors).turns.filter(turn => turn.role === 'user').slice(-3).map(turn => turn.text).join('\n');
      const { topic, options, reason } = suggest(asked, id, saved, Date.now(), chosen);
      const suggested = options.find(option => option.status !== 'limited');
      passMenu.replaceChildren();
      const title = document.createElement('h2'); title.textContent = 'Pass the baton to…';
      const hint = document.createElement('p'); hint.textContent = `${chosen ? `Ranked for ${topicNames[topic].toLowerCase()}, then usage left.` : topic === 'general' ? 'Ranked for everyday use, then usage left. Pick a task to re-rank.' : `Looks like ${topicNames[topic].toLowerCase()}: ranked for that, then usage left.`} Opens a new chat with your project as a draft; you press Send.`;
      const status = document.createElement('p'); status.className = 'status'; status.setAttribute('role', 'status');
      // The guess can be wrong: one tap on the right task re-ranks the list (and later picks count for that task).
      const tasks = document.createElement('div'); tasks.className = 'tasks'; tasks.setAttribute('role', 'group'); tasks.setAttribute('aria-label', 'Task type');
      for (const option of topics) {
        const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'chip'; chip.textContent = topicNames[option];
        chip.setAttribute('aria-pressed', String(option === topic));
        chip.addEventListener('click', event => { event.stopPropagation(); void openPassMenu(option).catch(() => {}); });
        tasks.append(chip);
      }
      passMenu.append(title, hint, tasks);
      const run = async (action: () => Promise<string>) => { status.textContent = 'Working…'; try { status.textContent = await action(); } catch (error) { status.textContent = error instanceof Error ? error.message : 'That did not work. Open Baton to try again.'; } };
      for (const option of options) {
        const item = document.createElement('button'); item.type = 'button'; item.className = 'opt'; item.setAttribute('role', 'menuitem');
        const dot = document.createElement('i'); dot.className = 'dot'; dot.style.setProperty('--c', laneColor[option.provider]);
        const text = document.createElement('span'); const name = document.createElement('b'); name.textContent = providerNames[option.provider]; const detail = document.createElement('small'); const why = reason(option.provider); detail.textContent = why && option.status !== 'limited' ? `${why} · ${option.detail}` : option.detail; text.append(name, detail);
        item.append(dot, text);
        if (option === suggested) { const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = 'Suggested'; item.append(tag); }
        if (option.status === 'limited') item.setAttribute('aria-disabled', 'true');
        else item.addEventListener('click', () => {
          // Each pass teaches the order for this kind of task (kept on this device).
          void chrome.storage.local.get('taskPicks').then(stored => chrome.storage.local.set({ taskPicks: addPick(stored.taskPicks as TaskPicks | undefined, topic, option.provider) })).catch(() => {});
          void run(() => passTo(option.provider));
        });
        passMenu.append(item);
      }
      const row = document.createElement('div'); row.className = 'row';
      const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copy project';
      copy.addEventListener('click', () => { void run(async () => { const draft = await rescueDraft(); await navigator.clipboard.writeText(draft); return 'Project copied and saved as a baton. Paste it into any AI.'; }); });
      const hideButton = document.createElement('button'); hideButton.type = 'button'; hideButton.textContent = 'Hide this button';
      hideButton.title = 'Turn it back on in Baton → Usage';
      hideButton.addEventListener('click', () => { passEnabled = false; closePassMenu(); passHost.style.display = 'none'; void chrome.storage.local.set({ passButtonEnabled: false }); });
      row.append(copy, hideButton);
      passMenu.append(status, row);
      passMenu.hidden = false; passButton.setAttribute('aria-expanded', 'true');
      // Open upwards from the button when there is room, otherwise downwards; keep it on screen.
      const button = passHost.getBoundingClientRect(); const menu = passMenu.getBoundingClientRect();
      const left = Math.max(8, Math.min(button.right - menu.width, innerWidth - menu.width - 8));
      const top = button.top - menu.height - 8 >= 8 ? button.top - menu.height - 8 : Math.min(button.bottom + 8, innerHeight - menu.height - 8);
      passMenu.style.left = `${left}px`; passMenu.style.top = `${top}px`;
      (passMenu.querySelector('.opt:not([aria-disabled=true])') as HTMLElement | null)?.focus();
    };
    passButton.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); if (!passMenu.hidden) closePassMenu(); else void openPassMenu().catch(() => {}); });
    ctx.addEventListener(document, 'click', event => { if (!passMenu.hidden && !event.composedPath().includes(passHost)) closePassMenu(); }, { capture: true });
    ctx.addEventListener(document, 'keydown', event => { if (event.key === 'Escape' && !passMenu.hidden) { closePassMenu(); passButton.focus(); } }, { capture: true });
    ctx.onInvalidated(() => passHost.remove());
    // Free spot check shared by the usage pill and the Baton button: no visible text, controls or the composer itself.
    const interactiveSelector = 'button,input,textarea,select,[contenteditable="true"],[role="button"],a';
    const ownText = (element: Element) => Array.from(element.childNodes).some(node => node.nodeType === 3 && !!node.textContent?.trim());
    const spotTaken = (left: number, top: number, width: number, height: number, surface: Element, step = 12): Element | true | undefined => {
      if (top < 0 || left < 0 || top + height > innerHeight - 2 || left + width > innerWidth - 2) return true;
      for (let x = left + 6; x < left + width - 4; x += step) {
        for (const y of [top + 4, top + height / 2, top + height - 4]) {
          const element = document.elementFromPoint(x, y);
          if (!element || element === document.body || element === document.documentElement) continue;
          if (surface.contains(element) || element.closest(interactiveSelector) || ownText(element)) return element;
        }
      }
      return undefined;
    };
    const placePassButton = (surface: Element, box: DOMRect, pill?: DOMRect) => {
      if (!passEnabled) { passHost.style.display = 'none'; return; }
      const size = 28;
      const overlapsPill = (left: number, top: number) => !!pill && left < pill.right + 4 && left + size > pill.left - 4 && top < pill.bottom + 4 && top + size > pill.top - 4;
      const spots: [number, number][] = [[box.right - size, box.bottom + 5], [box.right + 8, box.bottom - size - 6], [box.right - size, box.top - size - 6]];
      passHost.style.visibility = 'hidden'; passHost.style.display = 'block';
      const spot = spots.find(([left, top]) => !overlapsPill(left, top) && !spotTaken(left, top, size, size, surface));
      if (!spot) { if (passMenu.hidden) passHost.style.display = 'none'; passHost.style.visibility = ''; return; }
      passHost.style.left = `${spot[0]}px`; passHost.style.top = `${spot[1]}px`; passHost.style.visibility = '';
    };
    void chrome.storage.local.get('passButtonEnabled').then(saved => { passEnabled = saved.passButtonEnabled !== false; scheduleStatus(); });
    let statusFrame = 0;
    let lastPrompt = '';
    let lastPromptTokens = 0;
    let lastLimitText: string | undefined;
    let lastLimitCheck = 0;
    const updateStatus = () => {
      statusFrame = 0;
      positionRescue();
      const editor = findEditor(document, bundledSelectors.providers[id].editor);
      const hideAll = () => { statusHost.style.display = 'none'; if (passMenu.hidden) passHost.style.display = 'none'; };
      if (!editor) { hideAll(); return; }
      const editorRect = editor.getBoundingClientRect();
      const exposed = document.elementFromPoint(editorRect.left + Math.min(20, editorRect.width / 2), editorRect.top + Math.min(10, editorRect.height / 2));
      // A settings dialog can cover the composer while it remains in the DOM.
      if (!exposed || !editor.contains(exposed)) { hideAll(); return; }
      let surface: Element = editor;
      let ancestor = editor.parentElement;
      // The composer is the outermost rounded box with a visible background, border or shadow around the editor
      // (Gemini's box is much wider than its editor; DeepSeek wraps its box in wider invisible containers).
      const looksLikeBox = (element: Element) => {
        const style = getComputedStyle(element);
        const painted = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent' || parseFloat(style.borderTopWidth) > 0 || style.boxShadow !== 'none';
        return parseFloat(style.borderTopLeftRadius) >= 8 && painted;
      };
      for (let depth = 0; ancestor && depth < 10 && !ancestor.matches('body,main'); depth++, ancestor = ancestor.parentElement) {
        const rect = ancestor.getBoundingClientRect();
        if (rect.width >= editorRect.width * 0.85 && rect.width < innerWidth * 0.95 && rect.height <= 360 && rect.bottom >= editorRect.bottom && looksLikeBox(ancestor)) surface = ancestor;
      }
      const surfaceRect = surface.getBoundingClientRect();
      if (surfaceRect.width < 180 || surfaceRect.bottom < 0 || surfaceRect.left >= innerWidth - 180) { hideAll(); return; }
      if (!composerUsageEnabled) { statusHost.style.display = 'none'; placePassButton(surface, surfaceRect); return; }
      const pillLeft = Math.max(8, surfaceRect.left);
      const pillMaxWidth = Math.min(Math.max(surfaceRect.width, 220), innerWidth - pillLeft - 8);
      const value = editor instanceof HTMLTextAreaElement ? editor.value : editor.textContent || '';
      const fresh = isCurrentReading(latestMeter);
      if (value !== lastPrompt) { lastPrompt = value; lastPromptTokens = encode(value).length; }
      const windows = displayWindows(latestWindows, latestHistory, latestSends);
      const current = latestMeter;
      if (isCurrentReading(current) && !windows.some(win => win.feature === current.feature)) windows.push({ ...current, key: `${id}:notice`, source: 'provider-page' });
      windows.sort((a, b) => (b.percent || 0) - (a.percent || 0));
      // The line sits under the chat box, so it shows chat usage only. ChatGPT's Codex/Work and credits,
      // banked resets and feature caps stay in the sidebar card and the tooltip.
      const chat = windows.filter(win => !/image|file|upload|voice|deep research|work|codex|credit|limit resets|^model$/i.test(win.feature));
      const extras = windows.filter(win => !chat.includes(win));
      const nextBody = document.createElement('span');
      const piece = (className: string, text: string) => { const node = document.createElement('span'); node.className = className; node.textContent = text; return node; };
      const addSegment = (segment: Segment) => {
        const node = document.createElement('span'); node.className = 'seg';
        if (segment.label) node.append(piece('k', segment.label));
        if (segment.left !== undefined) {
          const ring = document.createElement('span'); ring.className = `ring ${segment.level || 'ok'}`; ring.style.setProperty('--p', String(segment.left)); ring.setAttribute('aria-hidden', 'true'); node.append(ring);
          // “54%” bold, “left” lighter.
          const [figure, ...rest] = segment.value.split(' ');
          node.append(piece('v', figure)); if (rest.length) node.append(piece('u', rest.join(' ')));
        } else node.append(piece('v', segment.value));
        if (segment.note) node.append(piece('n', segment.note));
        nextBody.append(node);
      };
      const segments = chatSegments(chat);
      if (segments.length) segments.forEach(addSegment);
      else {
        // Only a chat notice may stand in: ChatGPT's “latest reading” is often its Work allowance.
        const chatMeter = fresh && latestMeter && chatFeature(latestMeter.feature) ? latestMeter : undefined;
        const text = composerStatusText(0, chatMeter);
        const counted = messageSummary(id, latestSends, latestHits, Date.now(), latestStated);
        if (!text.endsWith('Usage left: unknown')) addSegment({ label: '', value: text.replace(/^Usage left: /, '') });
        else if (counted.count || counted.learnedLimit !== undefined) addSegment({ label: 'Chat', value: counted.text, note: 'counted by Baton' });
        else addSegment({ label: 'Chat', value: extras.length ? 'no limit shown' : 'usage not shown' });
      }
      if (lastPromptTokens) { const tokens = piece('seg quiet', `≈${lastPromptTokens.toLocaleString('en-US')} prompt tokens`); nextBody.append(tokens); }
      if (nextBody.innerHTML !== statusBody.innerHTML) statusBody.replaceChildren(...Array.from(nextBody.childNodes));
      statusText.title = windows.length ? windows.map(win => win.estimate ? `${displayLabel(win)} (estimated from messages sent since the last service reading)` : `${windowLabel(win)} (shown on service page)`).join('\n') : 'Remaining allowance has not been exposed by this service. Prompt tokens are approximate and do not measure your remaining allowance.';
      statusHost.setAttribute('aria-label', `Baton: ${statusText.textContent}`);
      // Measure the real pill, then try: below the box (left-aligned), below a row of controls under the box
      // (Claude's Project / model row), then above the box. A spot is taken only where the pill would not cover
      // visible text or a control; empty full-width wrappers (Gemini's and DeepSeek's centred disclaimers) are fine.
      // Nothing moved and nothing changed: keep the pill where it is (no re-measure, no flicker).
      const placementKey = [surfaceRect.left, surfaceRect.top, surfaceRect.bottom, surfaceRect.width, innerWidth, innerHeight, statusBody.innerHTML].join('|');
      if (placementKey === statusPlacement && statusHost.style.display === 'block') { placePassButton(surface, surfaceRect, statusHost.getBoundingClientRect()); return; }
      statusPlacement = placementKey;
      statusHost.style.visibility = 'hidden';
      statusHost.style.display = 'block';
      statusHost.style.left = `${pillLeft}px`;
      statusHost.style.top = '0px';
      statusHost.style.maxWidth = `${pillMaxWidth}px`;
      const pill = statusHost.getBoundingClientRect();
      const pillHeight = pill.height || 28;
      const conflict = (top: number) => spotTaken(pillLeft, top, pill.width, pillHeight, surface, 24);
      let top = surfaceRect.bottom + 6;
      let hit = conflict(top);
      if (hit && hit !== true) {
        let row: Element = hit;
        for (let element: Element | null = hit; element && element !== document.body; element = element.parentElement) {
          const rect = element.getBoundingClientRect();
          if (rect.top >= surfaceRect.bottom - 2 && rect.height <= 64 && !element.contains(surface)) row = element; else break;
        }
        top = row.getBoundingClientRect().bottom + 6;
        hit = conflict(top);
      }
      if (hit) { top = surfaceRect.top - pillHeight - 6; hit = conflict(top); }
      if (hit) { statusHost.style.display = 'none'; statusHost.style.visibility = ''; statusPlacement = ''; placePassButton(surface, surfaceRect); return; }
      statusHost.style.top = `${top}px`;
      statusHost.style.visibility = '';
      placePassButton(surface, surfaceRect, statusHost.getBoundingClientRect());
    };
    const scheduleStatus = () => { if (!statusFrame) statusFrame = requestAnimationFrame(updateStatus); };
    ctx.addEventListener(document, 'input', scheduleStatus, { capture: true });
    ctx.addEventListener(document, 'focusin', scheduleStatus, { capture: true });
    ctx.addEventListener(document, 'scroll', scheduleStatus, { capture: true });
    ctx.addEventListener(window, 'resize', scheduleStatus);
    void chrome.storage.local.get([`usageHistory:${id}`, `usageSends:${id}`, `limitHits:${id}`, `statedLimit:${id}`]).then(saved => { latestStated = saved[`statedLimit:${id}`] as StatedLimit | undefined; latestHistory = (saved[`usageHistory:${id}`] || {}) as UsageHistory; latestSends = (saved[`usageSends:${id}`] || []) as number[]; latestHits = (saved[`limitHits:${id}`] || []) as LimitHit[]; scheduleStatus(); });
    void chrome.storage.local.get([`meter:${id}`, `usageWindows:${id}`, 'composerUsageEnabled']).then(saved => { latestMeter = saved[`meter:${id}`] as Meter | undefined; latestWindows = (saved[`usageWindows:${id}`] || []) as UsageWindow[]; composerUsageEnabled = saved.composerUsageEnabled !== false; scheduleStatus(); });
    ctx.setInterval(() => { void chrome.storage.local.get(`meter:${id}`).then(saved => { latestMeter = saved[`meter:${id}`] as Meter | undefined; scheduleStatus(); }); }, 30000);
    const observeUsage = async (force = false) => {
      const now = Date.now();
      const visibleWindows = readUsageWindows(document, id, collectTurnNodes(document, id, bundledSelectors), now);
      if (visibleWindows.length) {
        latestWindows = mergeUsageWindows(latestWindows, visibleWindows, now);
        // Each official reading calibrates the estimate shown between readings.
        latestHistory = recordReadings(((await chrome.storage.local.get(`usageHistory:${id}`))[`usageHistory:${id}`] || {}) as UsageHistory, visibleWindows);
        await chrome.storage.local.set({ [`usageHistory:${id}`]: latestHistory });
        const strongest = activeWindows(latestWindows, now).sort((a, b) => (b.percent || 0) - (a.percent || 0))[0];
        latestMeter = strongest || { ...estimateMeter(id, '', [], [], now), at: now };
        scheduleStatus();
        await chrome.storage.local.set({ [`usageWindows:${id}`]: latestWindows, [`meter:${id}`]: latestMeter });
        await noteLimitHit();
        for (const meter of visibleWindows.map(win => latestWindows.find(current => current.key === win.key)).filter((win): win is UsageWindow => !!win).sort((a, b) => (a.percent || 0) - (b.percent || 0))) void chrome.runtime.sendMessage({ type: 'OBSERVE_USAGE', provider: id, meter }).catch(() => {});
        return;
      }
      const signal = makeAdapter(id, bundledSelectors).detectLimit(document);
      if (signal.kind === 'unknown') {
        const savedMeter = (await chrome.storage.local.get(`meter:${id}`))[`meter:${id}`] as Meter | undefined;
        if (isCurrentReading(savedMeter, now)) { latestMeter = savedMeter; scheduleStatus(); return; }
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
      // A limit message that states the allowance (“limit of 20 messages per 2 hours”) is kept for counting.
      const stated = parseStatedLimit(signal.text);
      if (stated) { latestStated = stated; await chrome.storage.local.set({ [`statedLimit:${id}`]: stated }); }
      await noteLimitHit();
      if (meter.tier === 'banner') void chrome.runtime.sendMessage({ type: 'OBSERVE_USAGE', provider: id, meter }).catch(() => {});
    };
    ctx.setInterval(() => { void observeUsage().then(() => chrome.runtime.sendMessage({ type: 'REFRESH_USAGE_BADGE' })).catch(() => {}); }, 30000);
    // A service usage page fills in its figures after load; read it soon instead of waiting for the interval.
    if (isUsagePageUrl(id, location.href)) ctx.setTimeout(() => { void observeUsage(true).catch(() => {}); }, 1500);
    const settingsChanged = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.composerUsageEnabled) composerUsageEnabled = changes.composerUsageEnabled.newValue !== false;
      if (changes.passButtonEnabled) passEnabled = changes.passButtonEnabled.newValue !== false;
      if (changes[`usageWindows:${id}`]) latestWindows = (changes[`usageWindows:${id}`].newValue || []) as UsageWindow[];
      if (changes[`meter:${id}`]) latestMeter = changes[`meter:${id}`].newValue as Meter | undefined;
      if (changes[`usageHistory:${id}`]) latestHistory = (changes[`usageHistory:${id}`].newValue || {}) as UsageHistory;
      if (changes[`usageSends:${id}`]) latestSends = (changes[`usageSends:${id}`].newValue || []) as number[];
      if (changes[`limitHits:${id}`]) latestHits = (changes[`limitHits:${id}`].newValue || []) as LimitHit[];
      if (changes[`statedLimit:${id}`]) latestStated = changes[`statedLimit:${id}`].newValue as StatedLimit | undefined;
      scheduleStatus();
    };
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
      const meter = isCurrentReading(latestMeter, now) ? latestMeter : signal.kind === 'unknown' && isCurrentReading(storedMeter, now) ? storedMeter : calculatedMeter;
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
    // A send counts when a send signal (the composer going from text to empty, or Enter / a Send button with text)
    // is followed within 90 s by a message of yours that was not on the page before. Key presses alone are not
    // relied on, because some editors swallow them. Opening, scrolling or switching chats has no send signal.
    const userTurnKeys = () => extract(document, id, bundledSelectors).turns.filter(turn => turn.role === 'user').map(turn => turn.id || `${turn.text.length}:${turn.text.slice(0, 120)}`);
    const composerText = (target?: EventTarget | null) => {
      const editor = findEditor(document, bundledSelectors.providers[id].editor, target instanceof Node ? target : undefined);
      return (editor instanceof HTMLTextAreaElement ? editor.value : editor?.textContent || '').trim();
    };
    const seenUserTurns = new Set<string>();
    let seeded = false;
    let sendIntentAt = 0;
    let lastComposer = '';
    let sendPoll: number | undefined;
    const recordSend = async (at: number) => {
      const key = `usageSends:${id}`;
      latestSends = [...(((await chrome.storage.local.get(key))[key] || []) as number[]), at].slice(-300);
      await chrome.storage.local.set({ [key]: latestSends });
      scheduleStatus();
      // Lets the background refresh this service's usage page shortly after (throttled, user setting).
      void chrome.runtime.sendMessage({ type: 'REFRESH_AFTER_SEND' }).catch(() => {});
    };
    const scanUserTurns = () => {
      const keys = userTurnKeys();
      const fresh = keys.filter(key => !seenUserTurns.has(key));
      keys.forEach(key => seenUserTurns.add(key));
      if (!seeded) { seeded = true; return; }
      if (fresh.length && sendIntentAt && Date.now() - sendIntentAt < 90000) {
        const at = sendIntentAt;
        sendIntentAt = 0;
        void recordSend(at).catch(() => {});
      }
    };
    const noteSendIntent = () => {
      if (!seeded) scanUserTurns();
      sendIntentAt = Date.now();
      if (sendPoll !== undefined) return;
      sendPoll = ctx.setInterval(() => {
        scanUserTurns();
        if (!sendIntentAt || Date.now() - sendIntentAt >= 90000) { clearInterval(sendPoll); sendPoll = undefined; sendIntentAt = 0; }
      }, 1000);
    };
    const composerChanged = () => {
      const text = composerText();
      if (lastComposer && !text) noteSendIntent();
      lastComposer = text;
    };
    ctx.setTimeout(scanUserTurns, 2500);
    ctx.addEventListener(document, 'input', composerChanged, { capture: true });
    ctx.addEventListener(document, 'keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.target instanceof Node && inEditor(event.target) && composerText(event.target)) noteSendIntent(); }, { capture: true });
    ctx.addEventListener(document, 'click', event => {
      const button = event.target instanceof Element ? event.target.closest('button') : null;
      if (button && composerText() && (button.getAttribute('type') === 'submit' || /send|submit/i.test(`${button.getAttribute('aria-label') || ''} ${button.getAttribute('data-testid') || ''}`))) noteSendIntent();
    }, { capture: true });
    const observer = new MutationObserver(mutations => {
      scheduleStatus();
      // Sending empties the composer; that change is the most reliable send signal.
      if (mutations.some(mutation => inEditor(mutation.target))) composerChanged();
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
          const editor = findEditor(document, bundledSelectors.providers[id].editor);
          const pendingPrompt = editor instanceof HTMLTextAreaElement ? editor.value : (editor?.textContent || '');
          if (!result.turns.length && !result.artifacts.length) {
            if (collectTurnNodes(document, id, bundledSelectors).length) throw new Error('The conversation is hidden by the page layout. Close the service’s sidebar or dialog, then capture again.');
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
          const meter = isCurrentReading(latestMeter) ? latestMeter : limit.kind === 'unknown' && isCurrentReading(storedMeter) ? storedMeter : observed;
          sendResponse({ provider: id, turnCount: archive.turns.length, hasUserTurn: archive.turns.some(turn => turn.role === 'user'), artifactCount: result.artifacts.length, incomplete: result.incomplete || archive.incomplete || archive.truncated || !archiveSaved || hadMoreTurns, archiveSaved, warning, pendingPrompt: pendingPrompt.trim().slice(0, 8000), brief, meter, url: pageUrl() });
        })().catch(error => sendResponse({ error: String(error) }));
        return true;
      }
      if (message?.type === 'INJECT_DRAFT' && typeof message.text === 'string') {
        if (!makeAdapter(id, bundledSelectors).injectDraft(document, message.text)) { sendResponse({ ok: false }); return; }
        setTimeout(() => {
          const editor = findEditor(document, bundledSelectors.providers[id].editor);
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
