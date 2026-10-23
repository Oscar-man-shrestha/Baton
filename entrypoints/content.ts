import { defineContentScript } from 'wxt/utils/define-content-script';
import { bundledSelectors, providerIds, type ProviderId } from '../src/core/selectors';
import { cleanNode, collectTurnNodes, extract, findEditor, makeAdapter, questionBefore, sameDraft, selectedTurns } from '../src/core/adapter';
import { draftBudget, exactDetails, goalFromUserText, updateBrief } from '../src/core/brief';
import { saveCapturedCapsule, saveSelectionCapsule, saveWrittenBrief } from '../src/core/capsules';
import { briefPrompt, checkSummary, checkWrittenBrief, completeWrittenBrief, findWrittenBrief, withoutHandoffRequests } from '../src/core/written-brief';
import { handoffDraft } from '../src/core/context-export';
import { listFolders, type Project } from '../src/core/projects';
import { selectionName, selectionSummary } from '../src/core/selection';
import { formatShortcut, onMac, type ShortcutCommand } from '../src/core/shortcuts';
import { newChatUrls, providerNames, reachedLimit } from '../src/core/rescue';
import { withNextStep } from '../src/core/next-step';
import { pendingFor, pendingKey, shouldOffer, signInLabel, switchHelp, type PendingProject } from '../src/core/account-continue';
import { addPick, promptTopic, suggest, suggestionKeys, topicNames, topics, type ModelGuess, type TaskPicks, type Topic } from '../src/core/task-fit';
import { buildRescueCard, rescueCardStyle } from '../src/core/rescue-card';
import { encode } from 'gpt-tokenizer';
import { estimateMeter, parseStatedLimit, type LimitEvent, type Meter, type StatedLimit } from '../src/core/limits';
import { archiveWindow, captureCheck, mergeTurnWindows, type TurnArchive } from '../src/core/capture';
import { fetchStoredChat } from '../src/core/lossless';
import type { Extraction, Turn } from '../src/core/adapter';
import { readUsageWindows, activeWindows, mergeUsageWindows, isCurrentReading, isUsagePageUrl, windowLabel, type UsageWindow } from '../src/core/usage-windows';
import { composerStatusText } from '../src/core/composer-status';
import { displayLabel, displayWindows, recordReadings, type UsageHistory } from '../src/core/usage-estimate';
import { chatFeature, chatSegments, countSegments, workSegments, type Segment } from '../src/core/composer-line';
import { messageSummary, recordLimitHit, sentToday, type LimitHit } from '../src/core/message-counts';

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
    statusStyle.textContent = ':host{all:initial}.line{display:inline-flex;align-items:center;gap:10px;max-width:100%;box-sizing:border-box;height:26px;padding:0 12px 0 9px;border-radius:999px;background:linear-gradient(180deg,rgba(44,43,60,.94),rgba(25,24,35,.94));border:1px solid rgba(255,255,255,.1);box-shadow:0 8px 22px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.07);-webkit-backdrop-filter:blur(12px) saturate(1.2);backdrop-filter:blur(12px) saturate(1.2);color:#f4f3fb;font:500 11px/1 system-ui,-apple-system,"SF Pro Text",sans-serif;font-variant-numeric:tabular-nums;letter-spacing:.1px;white-space:nowrap;overflow:hidden}.body{display:inline-flex;align-items:center;gap:10px;min-width:0;overflow:hidden}.brand{flex:none;width:13px;height:4px;border-radius:2px;transform:rotate(-35deg);background:repeating-linear-gradient(90deg,#b8a5ff 0 3px,rgba(255,255,255,.45) 3px 4px);box-shadow:0 0 6px rgba(176,154,255,.45)}.seg{display:inline-flex;align-items:center;gap:6px;min-width:0}.seg+.seg:before{content:"";flex:none;width:1px;height:12px;background:linear-gradient(180deg,transparent,rgba(255,255,255,.22),transparent);margin-right:4px}.k{font-size:8.5px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:#a3a1ba}.v{font-weight:700;color:#fff}.u{color:#bdbbd1;font-weight:500;margin-left:-3px}.n{color:#8f8da6;font-weight:500}.ring{flex:none;width:13px;height:13px;border-radius:50%;background:conic-gradient(var(--c) calc(var(--p) * 1%),rgba(255,255,255,.14) 0);-webkit-mask:radial-gradient(circle,transparent 3.6px,#000 4.2px);mask:radial-gradient(circle,transparent 3.6px,#000 4.2px)}.ok{--c:#34d1b0}.mid{--c:#f5b94a}.low{--c:#ff6b6b}.quiet{color:#8f8da6;font-weight:500}.x{all:unset;pointer-events:auto;cursor:pointer;flex:none;display:grid;place-items:center;width:16px;height:16px;margin:0 -6px 0 -2px;border-radius:50%;color:#a3a1ba;font:600 12px/1 system-ui,sans-serif;opacity:.7;transition:opacity .15s,background .15s}.line:hover .x,.x:focus-visible{opacity:1}.x:hover{background:rgba(255,255,255,.12);color:#fff}.x:focus-visible{outline:2px solid #b8a5ff;outline-offset:1px}.line{pointer-events:auto}@media(prefers-color-scheme:light){.line{background:linear-gradient(180deg,rgba(255,255,255,.97),rgba(246,245,251,.97));border-color:rgba(30,25,70,.1);color:#1e1d2b;box-shadow:0 6px 18px rgba(30,25,70,.12),inset 0 1px 0 #fff}.v{color:#16151f}.k{color:#6d6a86}.u{color:#4b4963}.n,.quiet{color:#7d7a95}.ring{background:conic-gradient(var(--c) calc(var(--p) * 1%),rgba(30,25,70,.12) 0)}.seg+.seg:before{background:linear-gradient(180deg,transparent,rgba(30,25,70,.2),transparent)}.brand{background:repeating-linear-gradient(90deg,#6650de 0 3px,rgba(0,0,0,.2) 3px 4px);box-shadow:none}.x{color:#6d6a86}.x:hover{background:rgba(30,25,70,.08);color:#16151f}.ok{--c:#14a387}.mid{--c:#d98a0b}.low{--c:#e04848}}.line.tight .u,.line.tight .seg+.seg .n{display:none}.line.tighter .seg:nth-child(n+4),.line.tightest .seg:nth-child(n+3){display:none}';
    // The pill is built once: brand, a body that is refilled only when its content changes, and the ×.
    // Rebuilding the × on every page mutation (streaming replies) used to lose the press.
    const statusText = document.createElement('span');
    statusText.className = 'line';
    const statusBrand = document.createElement('i'); statusBrand.className = 'brand'; statusBrand.setAttribute('aria-hidden', 'true');
    const statusBody = document.createElement('span'); statusBody.className = 'body';
    const hideBar = document.createElement('button'); hideBar.type = 'button'; hideBar.className = 'x'; hideBar.textContent = '×';
    hideBar.title = 'Hide the usage bar (turn it back on in Baton → Show on AI chat pages)'; hideBar.setAttribute('aria-label', 'Hide the usage bar. Turn it back on in Baton, Show on AI chat pages.');
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
    // Asks the on-device task model (via the background) when keywords alone can't tell; gives up after 4 s.
    const modelGuess = (text: string) => Promise.race([
      chrome.runtime.sendMessage({ type: 'CLASSIFY', text }).then(reply => reply?.ok ? reply.guess as ModelGuess : undefined, () => undefined),
      new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), 4000))
    ]);
    // A Baton draft pasted into this chat counts as its goal, not its wrapper text (which ranked AIs for the wrong task).
    const lastAsked = (count = 3) => extract(document, id, bundledSelectors).turns.filter(turn => turn.role === 'user').slice(-count).map(turn => goalFromUserText(turn.text)).join('\n');
    // What decides the task: the text in the box, else your latest message. Replies and older messages don't.
    const askedNow = () => {
      const editor = findEditor(document, bundledSelectors.providers[id].editor);
      const typed = (editor instanceof HTMLTextAreaElement ? editor.value : editor?.textContent || '').trim();
      return typed || lastAsked(1).trim();
    };
    /** Keywords first, the on-device model when they can't tell; shared by the Baton menu and Baton's side panel. */
    const suggestNow = async (chosen?: Topic, known?: ModelGuess) => {
      const saved = await chrome.storage.local.get(suggestionKeys());
      const asked = askedNow();
      const model = known || (!chosen && asked && promptTopic(asked) === 'general' ? await modelGuess(asked) : undefined);
      return { asked, model, ...suggest(asked, id, saved, Date.now(), chosen, model) };
    };
    const rescueDraft = async (target?: ProviderId) => (await saveVisibleChat(target)).draft;
    // Saves the chat as Baton has seen it so far (no scrolling back); the draft plus how many messages it holds.
    // The chat as Baton has seen it so far: what is on the page joined with the stored transcript of this chat.
    const chatArchive = async () => {
      const data = extract(document, id, bundledSelectors);
      // The chat as the service stores it (Claude, ChatGPT): every message, not only the ones on screen. When it has at
      // least what the page shows, it replaces the page reading; otherwise the page reading stands.
      const stored = await fetchStoredChat(id, location).catch(() => undefined);
      if (stored && stored.length >= data.turns.length) { data.turns = stored; data.incomplete = false; data.warning = undefined; }
      const { archiveKey } = storageKeys();
      const previous = stored?.length || genericNewChat() ? undefined : (await chrome.storage.local.get(archiveKey))[archiveKey] as TurnArchive | undefined;
      const archive = archiveWindow(previous?.selectorsVersion === bundledSelectors.version ? previous : undefined, data.turns);
      if (!archive.turns.length) throw new Error('There is no conversation on this page to carry over yet.');
      return { data, archive };
    };
    const saveVisibleChat = async (target?: ProviderId) => {
      const { data, archive } = await chatArchive();
      const brief = updateBrief(undefined, archive.turns, data.artifacts);
      await saveCapturedCapsule(archive, brief, pageUrl(), document.title);
      return { draft: handoffDraft(archive, brief, pageUrl(), target).draft, messages: archive.turns.length, check: captureCheck(archive.turns) };
    };
    // Shared by the rescue card and the Baton button: save a baton, then open the target with the project as an unsent draft.
    const openDraftIn = async (target: ProviderId, draft: string) => {
      // Copied first, so a page that doesn't take the text (or a sign-in screen) never loses the draft.
      await navigator.clipboard.writeText(draft).catch(() => {});
      const opened = await chrome.runtime.sendMessage({ type: 'OPEN_DRAFT', url: newChatUrls[target], text: draft });
      if (!opened?.ok) throw new Error(`Could not open ${providerNames[target]}. Your project is saved in Baton.`);
      void chrome.storage.local.get('passCount').then(saved => chrome.storage.local.set({ passCount: (Number(saved.passCount) || 0) + 1 })).catch(() => {});
    };
    const passTo = async (target: ProviderId, next?: string) => {
      const saved = await saveVisibleChat(target);
      const draft = withNextStep(saved.draft, next);
      if (!draftBudget(draft, target).fits) return 'Saved as a baton. This project is too long for a one-click draft; open Baton to review and shorten it.';
      await openDraftIn(target, draft);
      return `Opened ${providerNames[target]} with your project as an unsent draft: ${saved.check.text}. Also saved as a baton and copied, in case the page doesn't show it.`;
    };
    // A saved selection goes exactly as saved. Too long to type in for you: it is copied and the AI opens to paste it.
    const passSaved = async (saved: Project, target: ProviderId, next?: string) => {
      const draft = withNextStep(saved.draft || '', next);
      if (!draftBudget(draft, target).fits) {
        await navigator.clipboard.writeText(draft);
        window.open(newChatUrls[target], '_blank', 'noopener');
        return `It’s longer than Baton types in for you, so it’s copied: paste it into ${providerNames[target]} (${onMac(navigator) ? '⌘V' : 'Ctrl+V'}), then press Send.`;
      }
      await openDraftIn(target, draft);
      return `Opened ${providerNames[target]} with this part as an unsent draft. Read it, then press Send.`;
    };
    // Same AI, another account: save the project, show where to switch (Google's chooser for Gemini), and offer it
    // as a draft on the next fresh chat here. The user signs in and out in the service's own screens.
    const sameAiOtherAccount = async (next?: string) => {
      const draft = withNextStep(await rescueDraft(id), next);
      const pending: PendingProject = { provider: id, draft, at: Date.now(), from: pageUrl(), title: document.title.slice(0, 120) };
      await chrome.storage.local.set({ [pendingKey(id)]: pending });
      const help = switchHelp(id);
      if (help.chooser) window.open(help.chooser, '_blank', 'noopener');
      // Log out with the service's own page, only after the user confirms: it signs out every tab of this AI.
      if (help.logout && window.confirm(`Your project is saved.\n\nLog out of ${providerNames[id]} now so you can pick another account? Other ${providerNames[id]} tabs will be logged out too.`)) {
        setTimeout(() => location.assign(help.logout!), 150);
        return `Saved. Logging you out of ${providerNames[id]}… Then press “Continue with Google” and pick your other account.`;
      }
      return `Saved. ${(help.logout ? help.manual : help.steps).join(' ')}`;
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
      const card = buildRescueCard(document, limit, (await suggestNow()).options, {
        continueIn: passTo,
        switchAccount: () => sameAiOtherAccount(),
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
    // The page can't restyle the host: a site filter, blend mode or clip would smear or cut the glow.
    passHost.style.cssText = 'position:fixed;z-index:2147483002;display:none;width:40px;height:40px;isolation:isolate;background:none!important;border:0!important;box-shadow:none!important;filter:none!important;mix-blend-mode:normal!important;opacity:1!important;transform:none!important;overflow:visible!important;clip-path:none!important;mask:none!important;contain:none!important';
    const passShadow = passHost.attachShadow({ mode: 'closed' });
    const passStyle = document.createElement('style');
    passStyle.textContent = ':host{all:initial}.pass{all:unset;position:relative;box-sizing:border-box;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;cursor:pointer;background:radial-gradient(circle at 32% 26%,#c9b8ff 0,#8b6cff 46%,#5b3fd8 100%);border:1px solid rgba(255,255,255,.35);box-shadow:0 0 0 2px rgba(139,108,255,.55),0 0 10px 2px rgba(150,120,255,.5),0 3px 8px rgba(40,20,110,.45);transition:transform .18s,box-shadow .18s}.pass:before{content:"";position:absolute;inset:-6px;border-radius:50%;border:1.5px solid rgba(196,181,255,.85);box-shadow:0 0 8px rgba(150,120,255,.6),inset 0 0 6px rgba(150,120,255,.35);pointer-events:none;animation:batonHalo 2.6s ease-in-out 4}.pass:hover{transform:translateY(-1px) scale(1.05);box-shadow:0 0 0 3px rgba(139,108,255,.7),0 0 14px 3px rgba(150,120,255,.6),0 4px 10px rgba(40,20,110,.5)}.pass:focus-visible{outline:2px solid #b8a5ff;outline-offset:8px}:host([data-compact]) .pass{width:28px;height:28px}:host([data-compact]) .pass:before{inset:-4px}:host([data-compact]) .brand{width:14px;height:4.5px}@keyframes batonHalo{50%{opacity:.35;transform:scale(1.12)}}.brand{width:19px;height:6px;border-radius:3px;transform:rotate(-35deg);background:repeating-linear-gradient(90deg,#fff 0 3px,rgba(255,255,255,.55) 3px 4px);box-shadow:0 0 6px rgba(255,255,255,.55)}.menu{position:fixed;width:272px;box-sizing:border-box;padding:10px;border-radius:14px;background:linear-gradient(180deg,rgba(40,39,55,.98),rgba(24,23,33,.98));border:1px solid rgba(255,255,255,.1);box-shadow:0 18px 44px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.06);color:#f4f3fb;font:500 12px/1.35 system-ui,-apple-system,sans-serif;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}.menu[hidden]{display:none}.menu h2{all:unset;display:block;font-size:13px;font-weight:700;margin:2px 4px 2px}.menu p{margin:0 4px 8px;color:#a3a1ba;font-size:10.5px}.opt{all:unset;box-sizing:border-box;display:grid;grid-template-columns:8px 1fr auto;align-items:center;gap:8px;width:100%;padding:8px;border-radius:9px;cursor:pointer}.opt:hover:not([aria-disabled=true]),.opt:focus-visible{background:rgba(255,255,255,.07)}.opt[aria-disabled=true]{opacity:.45;cursor:default}.dot{width:8px;height:8px;border-radius:50%;background:var(--c)}.opt b{font-weight:650}.opt small{display:block;color:#a3a1ba;font-size:10px}.tag{font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#1b1430;background:#b8a5ff;border-radius:999px;padding:2px 7px}.row{display:flex;gap:6px;margin-top:6px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08)}.row button{all:unset;flex:1;text-align:center;padding:6px;border-radius:8px;cursor:pointer;color:#cfcde0;font-size:11px}.row button:hover,.row button:focus-visible{background:rgba(255,255,255,.07)}.status{margin:8px 4px 2px;color:#cfcde0;font-size:10.5px}.status:empty{display:none}.next{display:grid;gap:4px;margin:2px 2px 10px}.next span{font-size:11px;font-weight:700;color:#cfcde0}.next input{all:unset;box-sizing:border-box;width:100%;padding:8px 10px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#f4f3fb;font:500 12.5px/1.3 system-ui,-apple-system,sans-serif}.next input:focus{border-color:#b8a5ff;box-shadow:0 0 0 3px rgba(184,165,255,.2)}.next input::placeholder{color:#8e8ba6}.next small{color:#a3a1ba;font-size:10px}.opt.account{margin-top:4px;border-top:1px solid rgba(255,255,255,.08);border-radius:0 0 9px 9px;padding-top:10px}.swap{font-style:normal;font-size:13px;color:#b8a5ff;width:10px;text-align:center}.basis{font-style:italic;margin-top:-4px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tasks{display:flex;flex-wrap:wrap;gap:4px;margin:0 2px 8px}.chip{all:unset;cursor:pointer;font-size:10px;font-weight:600;padding:3px 8px;border-radius:999px;color:#cfcde0;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)}.chip:hover,.chip:focus-visible{background:rgba(255,255,255,.12)}.chip[aria-pressed=true]{background:#b8a5ff;color:#1b1430;border-color:transparent}@media(prefers-color-scheme:light){.pass{border-color:rgba(255,255,255,.6);box-shadow:0 0 0 2px rgba(102,80,222,.45),0 0 10px 2px rgba(102,80,222,.35),0 3px 8px rgba(60,40,150,.3)}.pass:before{border-color:rgba(102,80,222,.7);box-shadow:0 0 8px rgba(102,80,222,.4)}.menu{background:linear-gradient(180deg,#fff,#f7f6fb);border-color:rgba(30,25,70,.1);color:#1e1d2b;box-shadow:0 18px 40px rgba(30,25,70,.18)}.menu p,.opt small{color:#6d6a86}.opt:hover:not([aria-disabled=true]),.row button:hover{background:rgba(30,25,70,.06)}.row{border-color:rgba(30,25,70,.1)}.row button,.status{color:#3d3b52}.tag{background:#6650de;color:#fff}.chip{color:#3d3b52;background:rgba(30,25,70,.05);border-color:rgba(30,25,70,.1)}.next span{color:#3d3b52}.next input{background:#fff;border-color:rgba(30,25,70,.18);color:#1e1d2b}.next small{color:#6d6a86}.chip[aria-pressed=true]{background:#6650de;color:#fff}}@media(prefers-reduced-motion:reduce){.pass,.pass:before{transition:none;animation:none}}';
    const passButton = document.createElement('button');
    passButton.type = 'button'; passButton.className = 'pass';
    passButton.title = 'Baton: continue this chat in another AI'; passButton.setAttribute('aria-label', 'Pass the baton to another AI'); passButton.setAttribute('aria-haspopup', 'menu');
    const passMark = document.createElement('i'); passMark.className = 'brand'; passMark.setAttribute('aria-hidden', 'true'); passButton.append(passMark);
    const passMenu = document.createElement('div'); passMenu.className = 'menu'; passMenu.setAttribute('role', 'menu'); passMenu.hidden = true;
    passShadow.append(passStyle, passButton, passMenu);
    document.body.append(passHost);
    let passEnabled = true;
    const laneColor: Record<ProviderId, string> = { claude: '#d97757', gemini: '#4c8df6', chatgpt: '#10a37f', deepseek: '#4d6bfe', grok: '#9aa3ad', perplexity: '#20b8cd' };
    const closePassMenu = () => { passMenu.hidden = true; passButton.setAttribute('aria-expanded', 'false'); };
    // “What's next?”: kept while the menu re-ranks; on a fresh open it starts with any unsent text in the chat box.
    let menuNext = '';
    let menuTyping = false;
    const openPassMenu = async (chosen?: Topic, model?: ModelGuess) => {
      if (!chosen && !model && passMenu.hidden) {
        const editor = findEditor(document, bundledSelectors.providers[id].editor);
        menuTyping = false;
        menuNext = (editor instanceof HTMLTextAreaElement ? editor.value : editor?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300);
      }
      // Opens at once on the keyword guess; the model, when needed, answers below and re-ranks.
      const saved = await chrome.storage.local.get(suggestionKeys());
      const asked = askedNow();
      const { topic, options, reason } = suggest(asked, id, saved, Date.now(), chosen, model);
      const suggested = options.find(option => option.status !== 'limited');
      passMenu.replaceChildren();
      const title = document.createElement('h2'); title.textContent = 'Pass the baton to…';
      const hint = document.createElement('p'); hint.textContent = `${chosen ? `Ranked for ${topicNames[topic].toLowerCase()}, then usage left.` : topic === 'general' ? 'Ranked for everyday use, then usage left. Pick a task to re-rank.' : `Looks like ${topicNames[topic].toLowerCase()}: ranked for that, then usage left.`} Opens a new chat with your project as a draft; you press Send.`;
      const basis = document.createElement('p'); basis.className = 'basis'; basis.textContent = asked ? `Based on: “${asked.replace(/\s+/g, ' ').slice(0, 70)}${asked.length > 70 ? '…' : ''}”` : 'No message yet: ranked for everyday use.';
      const status = document.createElement('p'); status.className = 'status'; status.setAttribute('role', 'status');
      // The guess can be wrong: one tap on the right task re-ranks the list (and later picks count for that task).
      const tasks = document.createElement('div'); tasks.className = 'tasks'; tasks.setAttribute('role', 'group'); tasks.setAttribute('aria-label', 'Task type');
      for (const option of topics) {
        const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'chip'; chip.textContent = topicNames[option];
        chip.setAttribute('aria-pressed', String(option === topic));
        chip.addEventListener('click', event => { event.stopPropagation(); void openPassMenu(option).catch(() => {}); });
        tasks.append(chip);
      }
      const nextField = document.createElement('label'); nextField.className = 'next';
      const nextLabel = document.createElement('span'); nextLabel.textContent = 'What’s next? (optional)';
      const nextInput = document.createElement('input'); nextInput.type = 'text'; nextInput.maxLength = 300; nextInput.value = menuNext;
      nextInput.placeholder = 'e.g. now add the login form'; nextInput.setAttribute('aria-describedby', 'baton-next-hint');
      const nextHint = document.createElement('small'); nextHint.id = 'baton-next-hint'; nextHint.textContent = 'Added to the end of the draft. Enter passes to the suggested AI.';
      nextInput.addEventListener('input', () => { menuNext = nextInput.value; menuTyping = true; });
      // Keys stay in Baton's box: the chat site must not react to typing here.
      for (const type of ['keydown', 'keyup', 'keypress'] as const) nextInput.addEventListener(type, event => {
        event.stopPropagation();
        if (type === 'keydown' && (event as KeyboardEvent).key === 'Enter' && suggested) { event.preventDefault(); void run(() => passTo(suggested.provider, menuNext)); }
        if (type === 'keydown' && (event as KeyboardEvent).key === 'Escape') { closePassMenu(); passButton.focus(); }
      });
      nextField.append(nextLabel, nextInput, nextHint);
      passMenu.append(title, hint, basis, tasks, nextField);
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
          void run(() => passTo(option.provider, menuNext));
        });
        passMenu.append(item);
      }
      // Opt-in: this AI writes the handoff (it knows the chat best), Baton checks it before it goes anywhere.
      const write = document.createElement('button'); write.type = 'button'; write.className = 'opt account'; write.setAttribute('role', 'menuitem');
      const writeIcon = document.createElement('i'); writeIcon.className = 'swap'; writeIcon.textContent = '✎'; writeIcon.setAttribute('aria-hidden', 'true');
      const writeText = document.createElement('span'); const writeName = document.createElement('b'); writeName.textContent = `Have ${providerNames[id]} write the handoff`;
      const writeHint = document.createElement('small'); writeHint.textContent = 'You send the request; Baton checks the reply, then you pick the next AI'; writeText.append(writeName, writeHint);
      write.append(writeIcon, writeText);
      write.addEventListener('click', () => { closePassMenu(); void startWrittenHandoff(); });
      passMenu.append(write);
      const other = document.createElement('button'); other.type = 'button'; other.className = 'opt account'; other.setAttribute('role', 'menuitem');
      const otherIcon = document.createElement('i'); otherIcon.className = 'swap'; otherIcon.textContent = '↻'; otherIcon.setAttribute('aria-hidden', 'true');
      const otherText = document.createElement('span'); const otherName = document.createElement('b'); otherName.textContent = `${providerNames[id]}, another account`;
      const otherHint = document.createElement('small'); otherHint.textContent = 'Save, switch account, continue here'; otherText.append(otherName, otherHint);
      other.append(otherIcon, otherText);
      other.addEventListener('click', () => { void run(() => sameAiOtherAccount(menuNext)); });
      passMenu.append(other);
      const row = document.createElement('div'); row.className = 'row';
      const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copy project';
      copy.addEventListener('click', () => { void run(async () => { const draft = withNextStep(await rescueDraft(), menuNext); await navigator.clipboard.writeText(draft); return 'Project copied and saved as a baton. Paste it into any AI.'; }); });
      const hideButton = document.createElement('button'); hideButton.type = 'button'; hideButton.textContent = 'Hide this button';
      hideButton.title = 'Turn it back on in Baton → Show on AI chat pages';
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
      // Keywords couldn't tell: ask the on-device model, then re-rank if the menu is still open and untouched.
      if (!chosen && !model && topic === 'general' && asked.trim()) {
        const opened = passMenu.innerHTML;
        const guess = await modelGuess(asked);
        if (guess && !passMenu.hidden && !menuTyping && passMenu.innerHTML === opened && suggest(asked, id, saved, Date.now(), undefined, guess).topic !== 'general') await openPassMenu(undefined, guess);
      }
    };
    passButton.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); if (!passMenu.hidden) closePassMenu(); else void openPassMenu().catch(() => {}); });
    ctx.addEventListener(document, 'click', event => { if (!passMenu.hidden && !event.composedPath().includes(passHost)) closePassMenu(); }, { capture: true });
    ctx.addEventListener(document, 'keydown', event => { if (event.key === 'Escape' && !passMenu.hidden) { closePassMenu(); passButton.focus(); } }, { capture: true });
    ctx.onInvalidated(() => passHost.remove());
    // Free spot check shared by the usage pill and the Baton button: no visible text, controls or the composer itself.
    const interactiveSelector = 'button,input,textarea,select,[contenteditable="true"],[role="button"],a';
    const ownText = (element: Element) => Array.from(element.childNodes).some(node => node.nodeType === 3 && !!node.textContent?.trim());
    // A pop-up, sign-in sheet or dialog floating over the page counts as taken, even in its empty corners.
    const floatingLayer = (element: Element, surface: Element) => {
      if (element.closest('dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"]')) return true;
      for (let node: Element | null = element; node && node !== document.body; node = node.parentElement) {
        if (node.contains(surface)) return false;
        if (getComputedStyle(node).position === 'fixed') return true;
      }
      return false;
    };
    // Last resort, above the box only: the sites' one-line “… can make mistakes.” notice may sit under Baton's bar.
    // When the chat box is at the bottom of the window (ChatGPT in a long chat), that line is the only room left.
    const disclaimer = (element: Element) => {
      for (let node: Element | null = element, depth = 0; node && depth < 4 && node !== document.body; node = node.parentElement, depth++) {
        const text = node.textContent || '';
        if (text.length < 160 && /can make mistakes/i.test(text)) return true;
      }
      return false;
    };
    const spotTaken = (left: number, top: number, width: number, height: number, surface: Element, step = 12, overDisclaimer = false): Element | true | undefined => {
      if (top < 0 || left < 0 || top + height > innerHeight - 2 || left + width > innerWidth - 2) return true;
      // Sample across the width and always at the right edge, so a grown pill can't end inside a neighbour.
      const xs: number[] = []; for (let x = left + 6; x < left + width - 4; x += step) xs.push(x); xs.push(left + width - 4);
      for (const x of xs) {
        for (const y of [top + 4, top + height / 2, top + height - 4]) {
          // Look through Baton's own button, bar and cards: only the site's content decides whether a spot is free.
          const element = document.elementsFromPoint(x, y).find(hit => !hit.id.startsWith('handoff-'));
          if (!element || element === document.body || element === document.documentElement) continue;
          if (overDisclaimer && disclaimer(element)) continue;
          if (surface.contains(element) || element.closest(interactiveSelector) || ownText(element) || floatingLayer(element, surface)) return element;
        }
      }
      return undefined;
    };
    const placePassButton = (surface: Element, box: DOMRect, pill?: DOMRect) => {
      // Hidden by the user, but a menu opened with the shortcut stays until it closes.
      if (!passEnabled) { if (passMenu.hidden) passHost.style.display = 'none'; return; }
      const size = 40, compact = 28;
      const overlapsPill = (left: number, top: number, side: number) => !!pill && left < pill.right + 4 && left + side > pill.left - 4 && top < pill.bottom + 4 && top + side > pill.top - 4;
      // Last spot, as for the bar: a compact button in the one-line “can make mistakes” notice right above the box
      // (ChatGPT in a long chat with a narrow window: no room below or beside the box, and the notice spans the width).
      const spots: [number, number, number, boolean][] = [[box.right - size, box.bottom + 5, size, false], [box.right + 8, box.bottom - size - 6, size, false], [box.right - size, box.top - size - 6, size, false], [box.right - compact, box.top - compact - 2, compact, true]];
      passHost.style.visibility = 'hidden'; passHost.style.display = 'block';
      const spot = spots.find(([left, top, side, overDisclaimer]) => !overlapsPill(left, top, side) && !spotTaken(left, top, side, side, surface, 12, overDisclaimer));
      if (!spot) { if (passMenu.hidden) passHost.style.display = 'none'; passHost.style.visibility = ''; return; }
      passHost.toggleAttribute('data-compact', spot[2] === compact);
      passHost.style.width = passHost.style.height = `${spot[2]}px`;
      passHost.style.left = `${spot[0]}px`; passHost.style.top = `${spot[1]}px`; passHost.style.visibility = '';
    };
    void chrome.storage.local.get('passButtonEnabled').then(saved => { passEnabled = saved.passButtonEnabled !== false; scheduleStatus(); });
    let statusFrame = 0;
    let lastPrompt = '';
    let lastPromptTokens = 0;
    // The whole conversation's size in tokens: the messages only (as Baton captures them, without buttons and other page
    // text), recounted at most every 3 s; long chats are estimated at 4 characters a token.
    let chatSizeAt = 0, chatSizeTokens = 0;
    const chatSize = () => {
      if (Date.now() - chatSizeAt < 3000) return chatSizeTokens;
      chatSizeAt = Date.now();
      // A reply's container and an inner element can both match: count each message once (outermost only).
      const turns = collectTurnNodes(document, id, bundledSelectors);
      const text = turns.filter(node => !turns.some(other => other !== node && other.contains(node))).map(node => { try { return cleanNode(node); } catch { return node.textContent || ''; } }).join('\n');
      chatSizeTokens = !text.trim() ? 0 : text.length > 60000 ? Math.round(text.length / 4) : encode(text).length;
      return chatSizeTokens;
    };
    const tokenCount = (n: number) => (n < 1000 ? `≈${n}` : `≈${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k`);
    let lastLimitText: string | undefined;
    let lastLimitCheck = 0;
    const updateStatus = () => {
      statusFrame = 0;
      positionRescue();
      const editor = findEditor(document, bundledSelectors.providers[id].editor);
      const hideAll = () => { statusHost.style.display = 'none'; if (passMenu.hidden) passHost.style.display = 'none'; };
      if (!editor) { hideAll(); return; }
      const editorRect = editor.getBoundingClientRect();
      // Look through Baton's own layers (tour card, rings, cards) so they never hide the bar themselves.
      const exposed = document.elementsFromPoint(editorRect.left + Math.min(20, editorRect.width / 2), editorRect.top + Math.min(10, editorRect.height / 2)).find(hit => !hit.id.startsWith('handoff-'));
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
      // Leaves the Baton button's width free at the right end, in case both share the line above the box.
      const pillMaxWidth = Math.min(Math.max(surfaceRect.width - 48, 220), innerWidth - pillLeft - 8);
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
        // Reset countdowns (“3h 20m”, “29d 23h”) read “reset in 3h 20m”; counts like “1 today” stay plain.
        if (segment.note) node.append(piece('n', /^\d+[dhm]\b/.test(segment.note) ? `reset in ${segment.note}` : segment.note));
        nextBody.append(node);
      };
      // ChatGPT: its Plan limits (Codex/Work, not chat) are the only numbers it publishes, so they follow the chat count.
      // Same order as ChatGPT's own figures read: Thinking, Codex/Work windows, then the allowance closest to running out.
      const counts = id === 'chatgpt' ? countSegments(windows) : [];
      const work = id === 'chatgpt' ? [...counts.slice(0, 1), ...workSegments(extras), ...counts.slice(1)] : [];
      const segments = chatSegments(chat);
      // Claude reports the 5-hour session only with a reply: once it resets, hold its place until the next message.
      if (id === 'claude' && segments.some(segment => segment.label === 'Weekly') && !segments.some(segment => segment.label === 'Session')) addSegment({ label: 'Session', value: '—', note: 'after your next message' });
      if (segments.length) segments.forEach(addSegment);
      else {
        // Only a chat notice may stand in: ChatGPT's “latest reading” is often its Work allowance.
        const chatMeter = fresh && latestMeter && chatFeature(latestMeter.feature) ? latestMeter : undefined;
        const text = composerStatusText(0, chatMeter);
        const counted = messageSummary(id, latestSends, latestHits, Date.now(), latestStated);
        if (!text.endsWith('Usage left: unknown')) addSegment({ label: '', value: text.replace(/^Usage left: /, '') });
        // With ChatGPT's own allowances on show, the chat count gives them the room (it stays in the bar's tooltip and Baton's panel).
        else if (counted.uncapped) { if (!work.length) addSegment({ label: 'Chat', value: 'No cap', note: `${counted.count} sent today` }); }
        else if (counted.count || counted.learnedLimit !== undefined) addSegment({ label: 'Chat', value: counted.text, note: 'counted by Baton' });
        // Nothing reported and nothing counted yet: say so plainly, with today's count from this browser.
        else addSegment({ label: 'Chat', value: 'No limit shown', note: `${sentToday(latestSends, Date.now())} today` });
      }
      work.forEach(addSegment);
      // How big this conversation already is; last in the bar, so it is the first to step aside when space is short.
      const size = chatSize();
      if (size) addSegment({ label: 'Chat size', value: `${tokenCount(size)} tokens` });
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
      // Too many segments for the room (ChatGPT with Thinking and Work): drop “left” and later resets, not whole words.
      statusText.classList.remove('tight', 'tighter', 'tightest');
      if (statusBody.scrollWidth > statusBody.clientWidth + 1) statusText.classList.add('tight');
      // Still too wide: drop whole segments from the end (least important last) rather than cut a number in half.
      if (statusBody.scrollWidth > statusBody.clientWidth + 1) statusText.classList.add('tighter');
      if (statusBody.scrollWidth > statusBody.clientWidth + 1) statusText.classList.add('tightest');
      const pill = statusHost.getBoundingClientRect();
      const pillHeight = pill.height || 28;
      const conflict = (top: number, overDisclaimer = false) => spotTaken(pillLeft, top, pill.width, pillHeight, surface, 24, overDisclaimer);
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
      if (hit) {
        const above = surfaceRect.top - pillHeight - 6;
        const aboveHit = conflict(above);
        top = above; hit = aboveHit;
        // Something sits right on top of the box (another extension's usage strip on Claude): stack above that row, so the
        // bar keeps its place above the box instead of moving under it.
        if (aboveHit && aboveHit !== true) {
          let row: Element | undefined;
          for (let element: Element | null = aboveHit; element && element !== document.body; element = element.parentElement) {
            const rect = element.getBoundingClientRect();
            if (rect.bottom <= surfaceRect.top + 2 && rect.bottom >= surfaceRect.top - pillHeight - 24 && rect.height <= 64 && !element.contains(surface)) row = element; else break;
          }
          if (row) { const stacked = row.getBoundingClientRect().top - pillHeight - 6; const stackedHit = conflict(stacked); if (!stackedHit) { top = stacked; hit = undefined; } }
        }
      }
      // Last resort: over the one-line “can make mistakes” notice, below the box or above it (ChatGPT in a long chat).
      if (hit) { top = surfaceRect.bottom + 6; hit = conflict(top, true); }
      if (hit) { top = surfaceRect.top - pillHeight - 2; hit = conflict(top, true); }
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
    // “Continue your project here?” on the next fresh chat after “another account”.
    const continueHost = document.createElement('div');
    continueHost.id = 'handoff-continue';
    continueHost.style.cssText = 'position:fixed;z-index:2147483003;display:none;width:min(420px,calc(100vw - 32px))';
    const continueShadow = continueHost.attachShadow({ mode: 'closed' });
    const continueStyle = document.createElement('style');
    continueStyle.textContent = ':host{all:initial}.card{box-sizing:border-box;display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:center;padding:14px 14px 12px;border-radius:16px;background:linear-gradient(180deg,rgba(40,39,55,.98),rgba(24,23,33,.98));border:1px solid rgba(139,108,255,.45);box-shadow:0 18px 44px rgba(0,0,0,.45),0 0 24px rgba(139,108,255,.25);color:#f4f3fb;font:500 13px/1.4 system-ui,-apple-system,sans-serif}.mark{grid-row:span 2;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 32% 26%,#c9b8ff,#8b6cff 46%,#5b3fd8)}.mark i{width:16px;height:5px;border-radius:3px;transform:rotate(-35deg);background:repeating-linear-gradient(90deg,#fff 0 3px,rgba(255,255,255,.55) 3px 4px)}b{font-size:14px}small{color:#a3a1ba;font-size:11.5px}.row{grid-column:1/-1;display:flex;gap:8px;margin-top:8px}button{all:unset;cursor:pointer;padding:8px 14px;border-radius:10px;font-weight:700;font-size:12.5px}.go{background:#b8a5ff;color:#1b1430}.later{color:#cfcde0;background:rgba(255,255,255,.06)}button:focus-visible{outline:2px solid #b8a5ff;outline-offset:2px}.msg{grid-column:1/-1;color:#cfcde0;font-size:12px;margin:6px 0 0}.msg:empty{display:none}@media(prefers-color-scheme:light){.card{background:linear-gradient(180deg,#fff,#f7f6fb);color:#1e1d2b;border-color:rgba(102,80,222,.35);box-shadow:0 18px 40px rgba(30,25,70,.18)}small,.msg{color:#6d6a86}.go{background:#6650de;color:#fff}.later{color:#3d3b52;background:rgba(30,25,70,.06)}}';
    const continueCard = document.createElement('div'); continueCard.className = 'card'; continueCard.setAttribute('role', 'dialog'); continueCard.setAttribute('aria-label', 'Continue your Baton project here');
    continueShadow.append(continueStyle, continueCard);
    document.body.append(continueHost);
    ctx.onInvalidated(() => continueHost.remove());
    let pendingProject: PendingProject | undefined;
    void chrome.storage.local.get(pendingKey(id)).then(saved => { pendingProject = pendingFor(saved[pendingKey(id)], id); });
    const hideContinue = () => { continueHost.style.display = 'none'; };
    const placeContinue = () => {
      const editor = findEditor(document, bundledSelectors.providers[id].editor);
      const rect = (editor?.closest('form') || editor)?.getBoundingClientRect();
      const width = Math.min(420, innerWidth - 32);
      const left = rect && rect.width ? rect.left + (rect.width - width) / 2 : (innerWidth - width) / 2;
      continueHost.style.left = `${Math.max(16, Math.min(left, innerWidth - width - 16))}px`;
      const bottom = rect && rect.height ? innerHeight - rect.top + 12 : 96;
      continueHost.style.top = 'auto';
      continueHost.style.bottom = `${bottom > innerHeight - 140 ? 96 : bottom}px`;
    };
    const showContinue = (pending: PendingProject) => {
      continueCard.replaceChildren(); continueCard.dataset.mode = 'offer';
      const mark = document.createElement('span'); mark.className = 'mark'; mark.setAttribute('aria-hidden', 'true'); mark.append(document.createElement('i'));
      const title = document.createElement('b'); title.textContent = 'Continue your project here?';
      const minutes = Math.max(1, Math.round((Date.now() - pending.at) / 60000));
      const from = document.createElement('small'); from.textContent = `${pending.title ? `“${pending.title.slice(0, 48)}” · ` : ''}saved ${minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`} ago`;
      const row = document.createElement('div'); row.className = 'row';
      const go = document.createElement('button'); go.type = 'button'; go.className = 'go'; go.textContent = 'Continue';
      const later = document.createElement('button'); later.type = 'button'; later.className = 'later'; later.textContent = 'Not now';
      const msg = document.createElement('p'); msg.className = 'msg'; msg.setAttribute('role', 'status');
      go.addEventListener('click', async () => {
        await chrome.storage.local.remove(pendingKey(id)).catch(() => {});
        pendingProject = undefined;
        if (makeAdapter(id, bundledSelectors).injectDraft(document, pending.draft)) { msg.textContent = 'Added as a draft. Review it, then press Send.'; row.remove(); setTimeout(hideContinue, 2600); return; }
        try { await navigator.clipboard.writeText(pending.draft); msg.textContent = 'Copied. Paste it into the chat box (⌘V or Ctrl+V).'; } catch { msg.textContent = 'Could not add it here. Open Baton to copy your project.'; }
      });
      later.addEventListener('click', () => { pendingProject = undefined; void chrome.storage.local.remove(pendingKey(id)).catch(() => {}); hideContinue(); });
      row.append(go, later);
      continueCard.append(mark, title, from, row, msg);
      placeContinue();
      continueHost.style.display = 'block';
      go.focus({ preventScroll: true });
    };
    // Signed out with a project waiting: ring the button that leads to Google's account chooser, with a one-line tip.
    const ringHost = document.createElement('div');
    ringHost.id = 'handoff-signin-ring';
    ringHost.style.cssText = 'position:fixed;z-index:2147483003;display:none;pointer-events:none;border-radius:14px;border:3px solid #8b6cff;box-shadow:0 0 0 6px rgba(139,108,255,.25),0 0 28px rgba(167,139,250,.75)';
    document.body.append(ringHost);
    ctx.onInvalidated(() => ringHost.remove());
    const signInTarget = (): { element: HTMLElement; kind: 'google' | 'login' } | undefined => {
      let login: HTMLElement | undefined;
      for (const element of Array.from(document.querySelectorAll<HTMLElement>('button, a, [role="button"]'))) {
        const kind = signInLabel(element.innerText || element.textContent || '');
        if (!kind) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width < 20 || rect.height < 12 || rect.bottom < 0 || rect.top > innerHeight) continue;
        if (kind === 'google') return { element, kind };
        login ||= element;
      }
      return login ? { element: login, kind: 'login' } : undefined;
    };
    const showSignInTip = (target: { element: HTMLElement; kind: 'google' | 'login' }) => {
      const rect = target.element.getBoundingClientRect();
      ringHost.style.left = `${rect.left - 6}px`; ringHost.style.top = `${rect.top - 6}px`;
      ringHost.style.width = `${rect.width + 12}px`; ringHost.style.height = `${rect.height + 12}px`;
      ringHost.style.display = 'block';
      const text = target.kind === 'google' ? 'Press “Continue with Google” and pick your other account. Your project is waiting.' : 'Press “Log in”, then “Continue with Google” and pick your other account. Your project is waiting.';
      if (continueCard.dataset.mode !== 'signin' || continueCard.dataset.text !== text) {
        continueCard.replaceChildren();
        continueCard.dataset.mode = 'signin'; continueCard.dataset.text = text;
        const mark = document.createElement('span'); mark.className = 'mark'; mark.setAttribute('aria-hidden', 'true'); mark.append(document.createElement('i'));
        const title = document.createElement('b'); title.textContent = 'Switch account';
        const tip = document.createElement('small'); tip.textContent = text;
        continueCard.append(mark, title, tip);
      }
      continueHost.style.left = `${Math.max(16, Math.min(rect.left + rect.width / 2 - 210, innerWidth - 436))}px`;
      // Above the button when there's room, otherwise below it (ChatGPT's “Log in” sits at the very top).
      if (rect.top > 130) { continueHost.style.top = 'auto'; continueHost.style.bottom = `${innerHeight - rect.top + 18}px`; }
      else { continueHost.style.bottom = 'auto'; continueHost.style.top = `${rect.bottom + 18}px`; }
      continueHost.style.display = 'block';
    };
    const hideSignInTip = () => { ringHost.style.display = 'none'; if (continueCard.dataset.mode === 'signin') { continueCard.dataset.mode = ''; hideContinue(); } };
    const checkContinue = () => {
      if (pendingProject && pendingFor(pendingProject, id)) {
        const target = signInTarget();
        if (target) { showSignInTip(target); return; }
        hideSignInTip();
      } else hideSignInTip();
      const shown = continueHost.style.display === 'block';
      if (!pendingProject || !pendingFor(pendingProject, id)) { pendingProject = undefined; return; }
      const editor = findEditor(document, bundledSelectors.providers[id].editor);
      const offer = shouldOffer(pendingProject, { url: pageUrl(), turnCount: collectTurnNodes(document, id, bundledSelectors).length, hasEditor: !!editor });
      if (shown) { if (!offer) hideContinue(); else placeContinue(); return; }
      if (offer) showContinue(pendingProject);
    };
    ctx.setInterval(checkContinue, 1500);
    // First-use tour: once Baton shows on a chat page, ask (never start unasked) and walk through three highlights.
    // Answered once, it never asks again; “Take the tour again” in Baton sets tourReplay.
    const tourHost = document.createElement('div');
    tourHost.id = 'handoff-tour';
    tourHost.style.cssText = 'position:fixed;z-index:2147483004;display:none;width:min(320px,calc(100vw - 32px))';
    const tourShadow = tourHost.attachShadow({ mode: 'closed' });
    const tourStyle = document.createElement('style');
    tourStyle.textContent = ':host{all:initial}.card{box-sizing:border-box;padding:14px 14px 12px;border-radius:16px;background:linear-gradient(180deg,rgba(40,39,55,.99),rgba(24,23,33,.99));border:1px solid rgba(139,108,255,.55);box-shadow:0 18px 44px rgba(0,0,0,.5),0 0 26px rgba(139,108,255,.3);color:#f4f3fb;font:500 13px/1.45 system-ui,-apple-system,sans-serif}.top{display:flex;align-items:center;gap:8px;margin-bottom:6px}.mark{width:22px;height:22px;flex:none;border-radius:7px;display:grid;place-items:center;background:radial-gradient(circle at 32% 26%,#c9b8ff,#8b6cff 46%,#5b3fd8)}.mark i{width:11px;height:4px;border-radius:2px;transform:rotate(-35deg);background:repeating-linear-gradient(90deg,#fff 0 2px,rgba(255,255,255,.55) 2px 3px)}b{font-size:14px;flex:1}.step{color:#a3a1ba;font-size:11px}.close{all:unset;cursor:pointer;color:#a3a1ba;font-size:16px;line-height:1;padding:2px 4px;border-radius:6px}.close:hover{color:#fff;background:rgba(255,255,255,.08)}p{margin:0;color:#d6d4e6}.row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}button.go,button.alt{all:unset;cursor:pointer;padding:7px 13px;border-radius:9px;font-weight:700;font-size:12.5px}.go{background:#b8a5ff;color:#1b1430}.alt{color:#cfcde0;background:rgba(255,255,255,.07)}button:focus-visible{outline:2px solid #b8a5ff;outline-offset:2px}@media(prefers-color-scheme:light){.card{background:linear-gradient(180deg,#fff,#f7f6fb);color:#1e1d2b;border-color:rgba(102,80,222,.4);box-shadow:0 18px 40px rgba(30,25,70,.2)}p{color:#3d3b52}.step,.close{color:#6d6a86}.go{background:#6650de;color:#fff}.alt{color:#3d3b52;background:rgba(30,25,70,.06)}}';
    const tourCard = document.createElement('div'); tourCard.className = 'card'; tourCard.setAttribute('role', 'dialog'); tourCard.setAttribute('aria-label', 'Baton quick tour');
    tourShadow.append(tourStyle, tourCard);
    const tourRing = document.createElement('div');
    tourRing.id = 'handoff-tour-ring';
    tourRing.style.cssText = 'position:fixed;z-index:2147483003;display:none;pointer-events:none;border-radius:999px;border:2px solid #b8a5ff;box-shadow:0 0 0 3px rgba(139,108,255,.22),0 0 12px rgba(167,139,250,.45);transition:all .25s ease';
    document.body.append(tourHost, tourRing);
    ctx.onInvalidated(() => { tourHost.remove(); tourRing.remove(); });
    const shownOnPage = (element: HTMLElement) => element.style.display === 'block' && element.getBoundingClientRect().width > 0;
    type TourStep = { target: () => HTMLElement | undefined; title: string; text: string };
    const tourSteps: TourStep[] = [
      { target: () => passHost, title: 'The glowing button', text: 'Press it to continue this chat in another AI. Baton saves your project and opens the next AI with it ready as a draft.' },
      { target: () => shownOnPage(statusHost) ? statusHost : undefined, title: 'How much you have left', text: 'This bar shows your usage on this AI, read from the service’s own pages. Press × on it to hide it.' },
      { target: () => passHost, title: 'You stay in control', text: 'Baton never sends anything: you read the draft and press Send. Click the Baton icon in your toolbar for usage on every AI and your saved batons.' }
    ];
    let tourActive = false;
    let tourAskedHere = false;
    let tourState: string | undefined;
    let tourReplay = false;
    void chrome.storage.local.get(['tourState', 'tourReplay']).then(saved => { tourState = saved.tourState as string | undefined; tourReplay = saved.tourReplay === true; });
    const placeTour = (target?: HTMLElement) => {
      const width = Math.min(320, innerWidth - 32);
      const rect = target?.getBoundingClientRect();
      if (!rect) { tourRing.style.display = 'none'; tourHost.style.left = `${(innerWidth - width) / 2}px`; tourHost.style.top = 'auto'; tourHost.style.bottom = '96px'; return; }
      // Clears the Baton button's own halo, so the two rings never blur into one haze.
      const gap = target === passHost ? 11 : 7;
      tourRing.style.left = `${rect.left - gap}px`; tourRing.style.top = `${rect.top - gap}px`; tourRing.style.width = `${rect.width + gap * 2}px`; tourRing.style.height = `${rect.height + gap * 2}px`;
      tourRing.style.borderRadius = rect.height > 34 && rect.width > rect.height * 1.5 ? '14px' : '999px';
      tourRing.style.display = 'block';
      tourHost.style.left = `${Math.max(16, Math.min(rect.left + rect.width / 2 - width / 2, innerWidth - width - 16))}px`;
      const height = tourCard.getBoundingClientRect().height || 150;
      if (rect.top - height - 20 > 8) { tourHost.style.top = 'auto'; tourHost.style.bottom = `${innerHeight - rect.top + 18}px`; }
      else { tourHost.style.bottom = 'auto'; tourHost.style.top = `${Math.min(rect.bottom + 18, innerHeight - height - 8)}px`; }
    };
    const endTour = (state: 'done' | 'declined') => {
      tourActive = false; tourHost.style.display = 'none'; tourRing.style.display = 'none';
      tourState = state; tourReplay = false;
      void chrome.storage.local.set({ tourState: state, tourReplay: false }).catch(() => {});
    };
    const tourButton = (label: string, kind: 'go' | 'alt', action: () => void) => { const button = document.createElement('button'); button.type = 'button'; button.className = kind; button.textContent = label; button.addEventListener('click', event => { event.stopPropagation(); action(); }); return button; };
    const tourFrame = (title: string, step: string) => {
      tourCard.replaceChildren();
      const top = document.createElement('div'); top.className = 'top';
      const mark = document.createElement('span'); mark.className = 'mark'; mark.setAttribute('aria-hidden', 'true'); mark.append(document.createElement('i'));
      const heading = document.createElement('b'); heading.textContent = title;
      const count = document.createElement('span'); count.className = 'step'; count.textContent = step;
      const close = document.createElement('button'); close.type = 'button'; close.className = 'close'; close.textContent = '×'; close.setAttribute('aria-label', 'Close the tour');
      close.addEventListener('click', event => { event.stopPropagation(); endTour(tourActive ? 'done' : 'declined'); });
      top.append(mark, heading, count, close);
      tourCard.append(top);
    };
    const askTour = () => {
      tourAskedHere = true;
      tourFrame('New to Baton?', '');
      const text = document.createElement('p'); text.textContent = 'Take a 20-second tour of what Baton adds to this page?';
      const row = document.createElement('div'); row.className = 'row';
      const yes = tourButton('Show me', 'go', () => showTourStep(0));
      row.append(tourButton('No thanks', 'alt', () => endTour('declined')), yes);
      tourCard.append(text, row);
      tourHost.style.display = 'block';
      placeTour(passHost);
    };
    let tourList: TourStep[] = [];
    const showTourStep = (index: number) => {
      if (index === 0 || !tourList.length) tourList = tourSteps.filter(step => step.target());
      const steps = tourList;
      const step = steps[index];
      if (!step) { endTour('done'); return; }
      tourActive = true;
      tourFrame(step.title, `${index + 1} of ${steps.length}`);
      const text = document.createElement('p'); text.textContent = step.text;
      const row = document.createElement('div'); row.className = 'row';
      if (index > 0) row.append(tourButton('Back', 'alt', () => showTourStep(index - 1)));
      const last = index === steps.length - 1;
      if (last) row.append(tourButton('Done', 'alt', () => endTour('done')), tourButton('Try it now', 'go', () => { endTour('done'); void openPassMenu().catch(() => {}); }));
      else row.append(tourButton('Next', 'go', () => showTourStep(index + 1)));
      tourCard.append(text, row);
      tourHost.style.display = 'block';
      placeTour(step.target());
      (row.lastElementChild as HTMLElement | null)?.focus({ preventScroll: true });
    };
    ctx.addEventListener(document, 'keydown', event => { if (event.key === 'Escape' && tourHost.style.display === 'block') endTour(tourActive ? 'done' : 'declined'); }, { capture: true });
    const checkTour = () => {
      if (tourHost.style.display === 'block' && !tourActive && tourState) { tourHost.style.display = 'none'; tourRing.style.display = 'none'; return; }
      if (tourHost.style.display === 'block') { const index = tourCard.querySelector('.step')?.textContent?.split(' ')[0]; placeTour(tourActive && index ? tourList[Number(index) - 1]?.target() : passHost); return; }
      if (!shownOnPage(passHost) || !passMenu.hidden || continueHost.style.display === 'block') return;
      if (tourReplay) { tourReplay = false; void chrome.storage.local.set({ tourReplay: false }).catch(() => {}); showTourStep(0); return; }
      if (!tourState && !tourAskedHere) askTour();
    };
    ctx.setInterval(checkTour, 1500);
    const settingsChanged = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.composerUsageEnabled) composerUsageEnabled = changes.composerUsageEnabled.newValue !== false;
      if (changes.passButtonEnabled) passEnabled = changes.passButtonEnabled.newValue !== false;
      if (changes.selectionButtonEnabled) { selectionChipEnabled = changes.selectionButtonEnabled.newValue !== false; if (!selectionChipEnabled) hideChip(); }
      if (changes.tourState) tourState = changes.tourState.newValue as string | undefined;
      if (changes.tourReplay) tourReplay = changes.tourReplay.newValue === true;
      if (changes[pendingKey(id)]) { pendingProject = pendingFor(changes[pendingKey(id)].newValue, id); if (!pendingProject && continueHost.style.display === 'block' && !continueShadow.querySelector('.msg')?.textContent) hideContinue(); }
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
    // Usage the site fetched for itself (copied by the usage tap in the page): handed to the background to read and save.
    const tapped = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin) return;
      const data = event.data as { source?: unknown; kind?: unknown; text?: unknown } | null;
      if (!data || data.source !== 'baton-usage-tap' || typeof data.kind !== 'string' || typeof data.text !== 'string' || data.text.length > 400000) return;
      void chrome.runtime.sendMessage({ type: 'API_USAGE', kind: data.kind, text: data.text }).catch(() => {});
    };
    window.addEventListener('message', tapped);
    if (id === 'chatgpt' || id === 'claude' || id === 'gemini') void chrome.runtime.sendMessage({ type: 'API_USAGE_REFRESH' }).catch(() => {});
    ctx.onInvalidated(() => window.removeEventListener('message', tapped));
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
    // Save part of the chat as a baton: select some of the conversation and a small “Save as baton” chip appears by it.
    // The shortcut and the right-click menu open the same card. A long chat can become one baton per topic; the text
    // stays in this browser like every baton.
    const selectHost = document.createElement('div');
    selectHost.id = 'handoff-selection';
    selectHost.style.cssText = 'position:fixed;z-index:2147483005;left:0;top:0;width:0;height:0;overflow:visible;filter:none!important;transform:none!important';
    const selectShadow = selectHost.attachShadow({ mode: 'closed' });
    const selectStyle = document.createElement('style');
    selectStyle.textContent = ':host{all:initial}.chip{all:unset;position:fixed;display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 12px 0 10px;box-sizing:border-box;border-radius:999px;cursor:pointer;background:linear-gradient(180deg,rgba(44,43,60,.97),rgba(25,24,35,.97));border:1px solid rgba(139,108,255,.55);box-shadow:0 8px 22px rgba(0,0,0,.34),0 0 12px rgba(139,108,255,.3);color:#f4f3fb;font:600 12px/1 system-ui,-apple-system,sans-serif;white-space:nowrap}.chip:hover{border-color:#b8a5ff}.chip:focus-visible{outline:2px solid #b8a5ff;outline-offset:2px}.chip[hidden],.card[hidden],.toast[hidden]{display:none}.brand{flex:none;width:13px;height:4px;border-radius:2px;transform:rotate(-35deg);background:repeating-linear-gradient(90deg,#b8a5ff 0 3px,rgba(255,255,255,.45) 3px 4px)}.card{position:fixed;width:300px;box-sizing:border-box;padding:12px;border-radius:14px;background:linear-gradient(180deg,rgba(40,39,55,.99),rgba(24,23,33,.99));border:1px solid rgba(139,108,255,.5);box-shadow:0 18px 44px rgba(0,0,0,.45),0 0 22px rgba(139,108,255,.22);color:#f4f3fb;font:500 12px/1.4 system-ui,-apple-system,sans-serif}.card h2{all:unset;display:block;font-size:13.5px;font-weight:700;margin:0 2px 2px}.card p{margin:0 2px 10px;color:#a3a1ba;font-size:10.5px}label{display:grid;gap:4px;margin:0 0 8px}label span{font-size:11px;font-weight:700;color:#cfcde0}input,select{all:unset;box-sizing:border-box;width:100%;padding:7px 10px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#f4f3fb;font:500 12.5px/1.3 system-ui,-apple-system,sans-serif}select{cursor:pointer}option{color:#1e1d2b}input:focus,select:focus{border-color:#b8a5ff;box-shadow:0 0 0 3px rgba(184,165,255,.2)}.row{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}.row button{all:unset;cursor:pointer;padding:7px 13px;border-radius:9px;font-weight:700;font-size:12px}.save{background:#b8a5ff;color:#1b1430}.cancel{color:#cfcde0;background:rgba(255,255,255,.07)}.row button:focus-visible{outline:2px solid #b8a5ff;outline-offset:2px}.row button[disabled]{opacity:.5;cursor:default}.status{margin:8px 2px 0!important;color:#cfcde0!important;font-size:11px!important}.status:empty{display:none}.card .preview{font-style:italic;color:#cfcde0;font-size:11px;line-height:1.45;overflow-wrap:anywhere}.card .label{display:block;margin:2px 2px 6px;font-size:11px;font-weight:700;color:#cfcde0}.next{margin-bottom:8px}.opt{all:unset;box-sizing:border-box;display:grid;grid-template-columns:8px 1fr auto;align-items:center;gap:8px;width:100%;padding:7px 8px;border-radius:9px;cursor:pointer}.opt:hover:not([aria-disabled=true]),.opt:focus-visible{background:rgba(255,255,255,.07)}.opt[aria-disabled=true]{opacity:.45;cursor:default}.dot{width:8px;height:8px;border-radius:50%;background:var(--c)}.opt .name{display:block;font-weight:650;font-size:12px}.opt small{display:block;color:#a3a1ba;font-size:10px}.tag{font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#1b1430;background:#b8a5ff;border-radius:999px;padding:2px 7px}.chip kbd{font:600 10px/1 system-ui,sans-serif;color:#a3a1ba;margin-left:2px}.chip kbd:empty{display:none}.toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);max-width:min(420px,calc(100vw - 32px));box-sizing:border-box;padding:9px 14px;border-radius:12px;background:linear-gradient(180deg,rgba(44,43,60,.97),rgba(25,24,35,.97));border:1px solid rgba(139,108,255,.45);box-shadow:0 12px 30px rgba(0,0,0,.4);color:#f4f3fb;font:500 12.5px/1.4 system-ui,-apple-system,sans-serif}@media(prefers-color-scheme:light){.card .preview,.card .label{color:#3d3b52}.opt:hover:not([aria-disabled=true]),.opt:focus-visible{background:rgba(30,25,70,.06)}.opt small,.chip kbd{color:#6d6a86}.tag{background:#6650de;color:#fff}.chip,.toast{background:linear-gradient(180deg,#fff,#f7f6fb);color:#1e1d2b;border-color:rgba(102,80,222,.45);box-shadow:0 6px 18px rgba(30,25,70,.16)}.brand{background:repeating-linear-gradient(90deg,#6650de 0 3px,rgba(0,0,0,.2) 3px 4px)}.card{background:linear-gradient(180deg,#fff,#f7f6fb);color:#1e1d2b;border-color:rgba(102,80,222,.4);box-shadow:0 18px 40px rgba(30,25,70,.2)}.card p{color:#6d6a86}label span,.status{color:#3d3b52!important}input,select{background:#fff;border-color:rgba(30,25,70,.18);color:#1e1d2b}.save{background:#6650de;color:#fff}.cancel{color:#3d3b52;background:rgba(30,25,70,.06)}}';
    const selectChip = document.createElement('button'); selectChip.type = 'button'; selectChip.className = 'chip'; selectChip.hidden = true;
    selectChip.title = 'Save just this part of the chat as a baton';
    const chipMark = document.createElement('i'); chipMark.className = 'brand'; chipMark.setAttribute('aria-hidden', 'true');
    const chipKey = document.createElement('kbd');
    selectChip.append(chipMark, 'Save as baton', chipKey);
    const selectCard = document.createElement('div'); selectCard.className = 'card'; selectCard.setAttribute('role', 'dialog'); selectCard.setAttribute('aria-label', 'Save the selection as a baton'); selectCard.hidden = true;
    const toast = document.createElement('div'); toast.className = 'toast'; toast.setAttribute('role', 'status'); toast.hidden = true;
    selectShadow.append(selectStyle, selectChip, selectCard, toast);
    document.body.append(selectHost);
    ctx.onInvalidated(() => { selectHost.remove(); stopWriting(); });
    // The keys the browser assigned (shown on the chip, in the Baton button's tooltip and in tips), from the background.
    const keys: Partial<Record<ShortcutCommand, string>> = {};
    void chrome.runtime.sendMessage({ type: 'SHORTCUT_KEYS' }).then(reply => {
      if (!reply?.ok) return;
      for (const command of reply.commands as { name: ShortcutCommand; shortcut?: string }[]) keys[command.name] = formatShortcut(command.shortcut, onMac(navigator));
      chipKey.textContent = keys['save-selection'] || '';
      if (keys['open-pass-menu']) passButton.title = `Baton: continue this chat in another AI (${keys['open-pass-menu']})`;
    }).catch(() => {});
    let selectionChipEnabled = true;
    void chrome.storage.local.get('selectionButtonEnabled').then(saved => { selectionChipEnabled = saved.selectionButtonEnabled !== false; });
    let toastTimer: number | undefined;
    const showToast = (text: string) => { toast.textContent = text; toast.hidden = false; clearTimeout(toastTimer); toastTimer = ctx.setTimeout(() => { toast.hidden = true; }, 4200); };
    // The selection on the page, when it is in the conversation (not the chat box or Baton's own cards).
    const pageSelection = () => {
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount || selection.toString().trim().length < 2) return undefined;
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const element = container instanceof Element ? container : container.parentElement;
      if (!element || element.closest('[id^="handoff-"]') || inEditor(container) || element.closest('[contenteditable="true"], textarea, input')) return undefined;
      return { range: range.cloneRange(), text: selection.toString().trim(), inChat: collectTurnNodes(document, id, bundledSelectors).some(node => range.intersectsNode(node)) };
    };
    // Below the end of the selection, or above its start when there is no room underneath.
    const placeBySelection = (element: HTMLElement, range: Range, width: number, height: number) => {
      const rects = Array.from(range.getClientRects()).filter(rect => rect.width || rect.height);
      const first = rects[0] || range.getBoundingClientRect(), last = rects.at(-1) || first;
      const left = Math.max(8, Math.min(last.right - width / 2, innerWidth - width - 8));
      const top = last.bottom + 8 + height <= innerHeight - 8 ? last.bottom + 8 : Math.max(8, first.top - height - 8);
      element.style.left = `${left}px`; element.style.top = `${top}px`;
    };
    let chipRange: Range | undefined;
    const hideChip = () => { selectChip.hidden = true; chipRange = undefined; };
    const updateChip = () => {
      if (!selectionChipEnabled || !selectCard.hidden) { hideChip(); return; }
      const current = pageSelection();
      // A few words at least: double-clicking a single word to look it up shouldn't offer a baton (the shortcut still can).
      if (!current?.inChat || current.text.split(/\s+/).length < 3) { hideChip(); return; }
      chipRange = current.range;
      selectChip.hidden = false;
      const chip = selectChip.getBoundingClientRect();
      placeBySelection(selectChip, chipRange, chip.width || 120, chip.height || 28);
    };
    const closeSaveCard = () => { selectCard.hidden = true; selectCard.replaceChildren(); };
    const cardText = (tag: 'h2' | 'p' | 'span' | 'small', text: string, className = '') => { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; };
    // Keys stay in Baton's card: the chat site must not react to typing here.
    for (const type of ['keydown', 'keyup', 'keypress'] as const) selectCard.addEventListener(type, event => {
      event.stopPropagation();
      if (type === 'keydown' && (event as KeyboardEvent).key === 'Escape') { event.preventDefault(); closeSaveCard(); }
    });
    // Step 2, once saved: pass the selection on, ranked like the Pass menu for what it is about.
    const showPassOptions = async (saved: Project, asked: string, text = { heading: '✓ Saved as a baton', note: '' }) => {
      const { topic, options, reason } = suggest(asked, id, await chrome.storage.local.get(suggestionKeys()), Date.now());
      const suggested = options.find(option => option.status !== 'limited');
      selectCard.replaceChildren();
      const status = cardText('p', '', 'status'); status.setAttribute('role', 'status');
      const run = async (action: () => Promise<string>) => { status.textContent = 'Working…'; try { status.textContent = await action(); } catch (error) { status.textContent = error instanceof Error ? error.message : 'That did not work. Open Baton to try again.'; } };
      const next = document.createElement('label'); next.className = 'next';
      const nextInput = document.createElement('input'); nextInput.type = 'text'; nextInput.maxLength = 300; nextInput.placeholder = 'e.g. turn this into a checklist';
      next.append(cardText('span', 'What’s next? (optional)'), nextInput);
      nextInput.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing && suggested) { event.preventDefault(); void run(() => passSaved(saved, suggested.provider, nextInput.value)); } });
      selectCard.append(cardText('h2', text.heading), cardText('p', text.note || `“${saved.name.slice(0, 60)}”${saved.folder ? ` · in ${saved.folder}` : ''}. It’s in Baton with your other batons.`), next, cardText('small', 'Pass it to…', 'label'));
      for (const option of options) {
        const item = document.createElement('button'); item.type = 'button'; item.className = 'opt';
        const dot = document.createElement('i'); dot.className = 'dot'; dot.style.setProperty('--c', laneColor[option.provider]);
        const text = document.createElement('span'); const why = reason(option.provider);
        text.append(cardText('span', providerNames[option.provider], 'name'), cardText('small', why && option.status !== 'limited' ? `${why} · ${option.detail}` : option.detail));
        item.append(dot, text);
        if (option === suggested) item.append(cardText('span', 'Suggested', 'tag'));
        if (option.status === 'limited') item.setAttribute('aria-disabled', 'true');
        else item.addEventListener('click', () => {
          void chrome.storage.local.get('taskPicks').then(stored => chrome.storage.local.set({ taskPicks: addPick(stored.taskPicks as TaskPicks | undefined, topic, option.provider) })).catch(() => {});
          void run(() => passSaved(saved, option.provider, nextInput.value));
        });
        selectCard.append(item);
      }
      const row = document.createElement('div'); row.className = 'row';
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'cancel'; copy.textContent = 'Copy';
      copy.addEventListener('click', () => { void run(async () => { await navigator.clipboard.writeText(withNextStep(saved.draft || '', nextInput.value)); return 'Copied. Paste it into any AI chat, then press Send.'; }); });
      const done = document.createElement('button'); done.type = 'button'; done.className = 'save'; done.textContent = 'Done';
      done.addEventListener('click', closeSaveCard);
      row.append(copy, done);
      selectCard.append(status, row);
      (selectCard.querySelector('.opt:not([aria-disabled=true])') as HTMLElement | null)?.focus({ preventScroll: true });
      keepCardOnScreen();
    };
    const keepCardOnScreen = () => {
      const card = selectCard.getBoundingClientRect();
      if (card.bottom > innerHeight - 8) selectCard.style.top = `${Math.max(8, innerHeight - card.height - 8)}px`;
      if (card.right > innerWidth - 8) selectCard.style.left = `${Math.max(8, innerWidth - card.width - 8)}px`;
    };
    // Step 1: what will be saved, its name and folder.
    const openSaveCard = async (range: Range, text: string) => {
      // Outside the messages Baton recognises (a page change), keep the selected words as they read.
      const found = selectedTurns(document, id, bundledSelectors, range);
      const turns = found.length ? found : [{ role: 'assistant' as const, text, index: 0 }];
      const question = found.length ? questionBefore(document, id, bundledSelectors, range) : undefined;
      hideChip();
      selectCard.replaceChildren();
      const summary = cardText('p', `${selectionSummary(turns)}${question ? ', with the question it answers' : ''}. Saved on this device only.`);
      const preview = cardText('p', `“${turns.map(turn => turn.text).join(' ').replace(/\s+/g, ' ').slice(0, 140)}${turns.reduce((sum, turn) => sum + turn.text.length, 0) > 140 ? '…' : ''}”`, 'preview');
      const nameField = document.createElement('label');
      const nameInput = document.createElement('input'); nameInput.type = 'text'; nameInput.maxLength = 160; nameInput.value = selectionName(question ? [question, ...turns] : turns);
      nameField.append(cardText('span', 'Name'), nameInput);
      selectCard.append(cardText('h2', 'Save as baton'), summary, preview, nameField);
      const folders = await listFolders().catch(() => [] as string[]);
      const folderSelect = document.createElement('select');
      if (folders.length) {
        const folderField = document.createElement('label');
        folderSelect.append(new Option('No folder', ''), ...folders.map(folder => new Option(folder, folder)));
        folderField.append(cardText('span', 'Folder'), folderSelect);
        selectCard.append(folderField);
      }
      const row = document.createElement('div'); row.className = 'row';
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'cancel'; cancel.textContent = 'Cancel';
      const save = document.createElement('button'); save.type = 'button'; save.className = 'save'; save.textContent = 'Save';
      const status = cardText('p', '', 'status'); status.setAttribute('role', 'status');
      row.append(cancel, save);
      selectCard.append(row, status);
      const saveNow = async () => {
        if (save.disabled) return;
        save.disabled = true; status.textContent = 'Saving…';
        try {
          const saved = await saveSelectionCapsule({ turns, question }, pageUrl(), nameInput.value, folderSelect.value || undefined);
          await showPassOptions(saved, (question || turns.find(turn => turn.role === 'user') || turns[0]).text);
        } catch (error) { save.disabled = false; status.textContent = error instanceof Error && /quota/i.test(error.message) ? 'Baton’s storage is full. Delete some batons, then try again.' : 'Could not save it. Try again, or capture the whole chat from Baton.'; }
      };
      cancel.addEventListener('click', closeSaveCard);
      save.addEventListener('click', () => { void saveNow(); });
      nameInput.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); void saveNow(); } });
      selectCard.hidden = false;
      const card = selectCard.getBoundingClientRect();
      placeBySelection(selectCard, range, card.width || 300, card.height || 220);
      nameInput.focus({ preventScroll: true }); nameInput.select();
    };
    // Pressing the chip must not clear the selection it belongs to.
    selectChip.addEventListener('pointerdown', event => event.preventDefault());
    selectChip.addEventListener('mousedown', event => event.preventDefault());
    selectChip.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); const current = pageSelection(); const range = current?.range || chipRange; if (range) void openSaveCard(range, current?.text || range.toString().trim()).catch(() => {}); });
    const fromBaton = (event: Event) => event.composedPath().includes(selectHost);
    ctx.addEventListener(document, 'mouseup', event => { if (!fromBaton(event)) ctx.setTimeout(updateChip, 0); }, { capture: true });
    ctx.addEventListener(document, 'keyup', event => { if (!fromBaton(event) && (event.shiftKey || event.key === 'Shift' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a'))) ctx.setTimeout(updateChip, 0); }, { capture: true });
    ctx.addEventListener(document, 'selectionchange', () => { if (!selectChip.hidden && document.getSelection()?.isCollapsed) hideChip(); });
    ctx.addEventListener(document, 'scroll', () => { if (chipRange && !selectChip.hidden) { const chip = selectChip.getBoundingClientRect(); placeBySelection(selectChip, chipRange, chip.width, chip.height); } }, { capture: true });
    ctx.addEventListener(document, 'pointerdown', event => { if (!selectCard.hidden && !fromBaton(event)) closeSaveCard(); }, { capture: true });
    ctx.addEventListener(document, 'keydown', event => { if (event.key === 'Escape' && !selectChip.hidden) hideChip(); }, { capture: true });
    // “Have this AI write the handoff” (opt-in, from the Pass menu): Baton types a brief-writing prompt into this chat, you
    // send it, and when the reply is complete Baton checks it against the exact names and figures it collected from the
    // chat, adds back any that are missing, saves it as a baton and offers the next AI. Nothing is sent by Baton.
    let writing: { details: string[]; latest: string; turns: Turn[]; before: Set<string>; poll?: number; seen: string; stable: number; until: number } | undefined;
    const stopWriting = () => { if (writing?.poll) clearInterval(writing.poll); writing = undefined; };
    const writingCard = (heading: string, text: string, actions: [string, string, () => void][] = []) => {
      selectCard.replaceChildren(cardText('h2', heading), cardText('p', text));
      const row = document.createElement('div'); row.className = 'row';
      for (const [label, kind, action] of actions) { const button = document.createElement('button'); button.type = 'button'; button.className = kind; button.textContent = label; button.addEventListener('click', action); row.append(button); }
      if (actions.length) selectCard.append(row);
      selectCard.hidden = false;
      // Above the Baton button, or the bottom-right corner when it isn't shown.
      const anchor = passHost.style.display === 'block' ? passHost.getBoundingClientRect() : undefined;
      const card = selectCard.getBoundingClientRect();
      selectCard.style.left = `${Math.max(8, Math.min((anchor ? anchor.right : innerWidth - 16) - card.width, innerWidth - card.width - 8))}px`;
      selectCard.style.top = `${Math.max(8, (anchor ? anchor.top : innerHeight - 16) - card.height - 12)}px`;
    };
    const cancelWriting = () => { stopWriting(); closeSaveCard(); };
    const finishWriting = async (reply: string) => {
      const job = writing; stopWriting();
      if (!job) return;
      const check = checkWrittenBrief(reply, job.details, job.latest);
      const handoff = completeWrittenBrief(reply, check, job.latest);
      try {
        const saved = await saveWrittenBrief(handoff, job.turns, pageUrl(), document.title);
        await showPassOptions(saved, job.latest, { heading: '✓ Handoff written and checked', note: `${checkSummary(check, providerNames[id])} Saved as a baton.` });
      } catch { writingCard('Could not save the handoff', 'Try again, or copy the reply yourself.', [['Close', 'cancel', closeSaveCard]]); }
    };
    const watchForHandoff = () => {
      if (!writing || ctx.isInvalid) { stopWriting(); return; }
      if (Date.now() > writing.until) { stopWriting(); writingCard('No handoff reply yet', 'Baton stopped waiting after 10 minutes. Start again from the Baton menu when you’re ready.', [['Close', 'cancel', closeSaveCard]]); return; }
      const latest = [...extract(document, id, bundledSelectors).turns].reverse().find(turn => turn.role === 'assistant');
      const found = latest && !writing.before.has(latest.text) ? findWrittenBrief(latest.text) : undefined;
      if (!found) return;
      // Finished when the end line is there and the reply has stopped changing for two checks.
      writing.stable = found.complete && found.text === writing.seen ? writing.stable + 1 : 0;
      writing.seen = found.text;
      if (writing.stable >= 2) { void finishWriting(found.text); return; }
      writingCard('Reading the reply…', `${providerNames[id]} is writing the handoff. Baton checks it when it’s done.`, [['Cancel', 'cancel', cancelWriting]]);
    };
    const startWrittenHandoff = async () => {
      stopWriting(); hideChip();
      let archive: TurnArchive;
      try { archive = (await chatArchive()).archive; } catch (error) { showToast(error instanceof Error ? error.message : 'There is no conversation to hand off yet.'); return; }
      const turns = withoutHandoffRequests(archive.turns);
      const details = exactDetails(turns);
      const latest = [...turns].reverse().find(turn => turn.role === 'user')?.text || '';
      const prompt = briefPrompt(details);
      const before = new Set(extract(document, id, bundledSelectors).turns.filter(turn => turn.role === 'assistant').map(turn => turn.text));
      writing = { details, latest, turns, before, seen: '', stable: 0, until: Date.now() + 600000 };
      writing.poll = ctx.setInterval(watchForHandoff, 1500);
      // Your own unsent text in the chat box is never replaced: then the prompt is copied for you to paste.
      const typed = !!composerText();
      const placed = !typed && makeAdapter(id, bundledSelectors).injectDraft(document, prompt);
      if (!placed) await navigator.clipboard.writeText(prompt).catch(() => {});
      writingCard(`Ask ${providerNames[id]} to write the handoff`, placed
        ? `The request is in the chat box. Read it and press Send. When the reply is done, Baton checks it against ${details.length} exact names and figures from this chat, then offers the next AI.`
        : `${typed ? 'Your chat box has text, so the request' : 'The request'} is copied: paste it into the chat box and press Send. Baton checks the reply when it’s done.`, [['Cancel', 'cancel', cancelWriting]]);
    };
    // Keyboard shortcuts (and the right-click menu) arrive from the background as commands for this page.
    const runCommand = (command: string) => {
      if (command === 'write-handoff') { void startWrittenHandoff(); return; }
      if (command === 'save-selection') {
        const current = pageSelection();
        if (!current) { showToast(`Select part of the conversation first, then press ${keys['save-selection'] || 'the shortcut'} again (or right-click → Save selection as a baton).`); return; }
        void openSaveCard(current.range, current.text).catch(() => showToast('Could not read the selection. Try selecting it again.'));
        return;
      }
      if (command === 'capture-chat') {
        showToast('Saving this chat as a baton…');
        void saveVisibleChat().then(({ check }) => showToast(`Saved this chat as a baton: ${check.text}.${check.gaps ? ' Scroll through the chat, then save again.' : ''} For older messages too, use Capture in Baton.`), error => showToast(error instanceof Error ? error.message : 'Could not save this chat. Try Capture in Baton.'));
        return;
      }
      if (command === 'open-pass-menu') {
        if (!passMenu.hidden) { closePassMenu(); return; }
        // The button is hidden or has no room: open the menu from the bottom-right corner instead.
        if (passHost.style.display !== 'block' || !passHost.getBoundingClientRect().width) {
          passHost.removeAttribute('data-compact'); passHost.style.width = passHost.style.height = '40px';
          passHost.style.left = `${innerWidth - 64}px`; passHost.style.top = `${innerHeight - 64}px`; passHost.style.visibility = ''; passHost.style.display = 'block';
        }
        void openPassMenu().catch(() => {});
      }
    };
    const onMessage: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (message, _sender, sendResponse) => {
      if (message?.type === 'PING') { sendResponse({ ready: true, provider: id }); return; }
      if (message?.type === 'BATON_COMMAND' && typeof message.command === 'string') { runCommand(message.command); sendResponse({ ok: true }); return; }
      // Baton's side panel asks for this chat's suggestions, and can pass the baton from there.
      if (message?.type === 'SUGGEST') {
        void suggestNow(topics.includes(message.topic) ? message.topic : undefined).then(result => sendResponse({ ok: true, provider: id, asked: result.asked.slice(0, 200), topic: result.topic, options: result.options.map(option => ({ ...option, reason: result.reason(option.provider) })) })).catch(() => sendResponse({ ok: false }));
        return true;
      }
      if (message?.type === 'SAME_AI_OTHER_ACCOUNT') {
        void sameAiOtherAccount(typeof message.next === 'string' ? message.next : undefined).then(text => sendResponse({ ok: true, provider: id, text }), error => sendResponse({ ok: false, text: error instanceof Error ? error.message : 'That did not work.' }));
        return true;
      }
      if (message?.type === 'PASS_TO' && providerIds.includes(message.provider)) {
        void chrome.storage.local.get('taskPicks').then(stored => typeof message.topic === 'string' && topics.includes(message.topic) ? chrome.storage.local.set({ taskPicks: addPick(stored.taskPicks as TaskPicks | undefined, message.topic, message.provider) }) : undefined).catch(() => {});
        void passTo(message.provider, typeof message.next === 'string' ? message.next : undefined).then(text => sendResponse({ ok: true, text }), error => sendResponse({ ok: false, text: error instanceof Error ? error.message : 'That did not work.' }));
        return true;
      }
      if (message?.type === 'REFRESH_USAGE') {
        void observeUsage(true).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
        return true;
      }
      if (message?.type === 'EXTRACT') {
        void (async () => {
          const captureUrl = pageUrl();
          const { key, highWaterKey, archiveKey } = storageKeys();
          // The stored chat first (every message, no scrolling); scrolling through the page only where it isn't offered.
          const stored = await fetchStoredChat(id, location).catch(() => undefined);
          const onPage = extract(document, id, bundledSelectors);
          const result: Extraction = stored && stored.length >= onPage.turns.length ? { ...onPage, turns: stored, incomplete: false, warning: undefined } : message.includeOlder ? await captureOlderTurns() : onPage;
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
        // Some editors (Perplexity's) show the text a moment later, so judge by the box after a pause, not right away.
        if (!makeAdapter(id, bundledSelectors).injectDraft(document, message.text) && !findEditor(document, bundledSelectors.providers[id].editor)) { sendResponse({ ok: false }); return; }
        setTimeout(() => {
          const editor = findEditor(document, bundledSelectors.providers[id].editor);
          const actual = editor instanceof HTMLTextAreaElement ? editor.value : editor?.textContent;
          sendResponse({ ok: sameDraft(actual, message.text) });
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
