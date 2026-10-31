import { renderBrief, wrapHandoff, draftBudget, goalFromUserText, redact } from '../../src/core/brief';
import { textFile, transcriptName } from '../../src/core/files';
import { shouldNudge, type Meter } from '../../src/core/limits';
import { encode } from 'gpt-tokenizer';
import { addPick, optionLine, promptTopic, suggest, suggestionKeys, topicNames, topics, type ModelGuess, type TaskPicks, type Topic } from '../../src/core/task-fit';
import { bundledSelectors, providerIds, type ProviderId } from '../../src/core/selectors';
import { iconSvg, type IconName } from './icons';
import { listProjects, mergeBrief, pruneExpired, saveProject, deleteProject, listFolders, createFolder, moveToFolder } from '../../src/core/projects';
import { briefSchema, type Brief } from '../../src/core/brief';
import { captureCheck, type TurnArchive } from '../../src/core/capture';
import { isCurrentReading, isUsagePageUrl, usagePageUrl, windowLabel, type UsageWindow } from '../../src/core/usage-windows';
import { displayLabel, displayWindows, estimable, type DisplayWindow, type UsageHistory } from '../../src/core/usage-estimate';
import { messageSummary, type LimitHit } from '../../src/core/message-counts';
import { laneFor, laneInUse } from '../../src/core/usage-lanes';
import { providerEnabled } from '../../src/core/rescue';
import { meterSummary } from '../../src/core/usage-alerts';
import { isSupportedChatUrl, sendWithBootstrap } from '../../src/core/connection';
import { listRecentCaptures } from '../../src/core/recent';
import { saveCapturedCapsule } from '../../src/core/capsules';
import { readCheckSteps, readFields, usageCheckSummary, type CheckField, type UsageCheck } from '../../src/core/usage-refresh';
import { fillShortcutList, onMac, shortcutsPage } from '../../src/core/shortcuts';
import { fitToBox, fullContext } from '../../src/core/context-export';
import { createActiveChatTracker } from '../../src/core/active-chat';

const status = document.querySelector('#status') as HTMLElement;
declare const __BATON_BUILT__: string | undefined;
const built = typeof __BATON_BUILT__ === 'string' ? new Date(__BATON_BUILT__) : undefined;
(document.querySelector('#build-version') as HTMLElement).textContent = `v${chrome.runtime.getManifest().version}${built ? ` · built ${built.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${built.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : ''}`;
const draft = document.querySelector('#draft') as HTMLTextAreaElement;
const receipt = document.querySelector('#receipt') as HTMLElement;
const destination = document.querySelector('#destination') as HTMLSelectElement;
const recommendation = document.querySelector('#recommendation') as HTMLElement;
const cost = document.querySelector('#cost') as HTMLElement;
const meterLabel = document.querySelector('#meter') as HTMLElement;
const intentLabel = document.querySelector('#intent') as HTMLElement;
const draftBudgetLabel = document.querySelector('#draft-budget') as HTMLElement;
const openDraft = document.querySelector('#open') as HTMLButtonElement;
const copyDraft = document.querySelector('#copy') as HTMLButtonElement;
const saveBrief = document.querySelector('#save') as HTMLButtonElement;
const positiveFeedback = document.querySelector('#positive') as HTMLButtonElement;
const negativeFeedback = document.querySelector('#negative') as HTMLButtonElement;
const flow = document.querySelector('#flow') as HTMLElement;
const reviewPanel = document.querySelector('#review-panel') as HTMLDetailsElement;
const draftPreview = document.querySelector('#draft-preview') as HTMLElement;
const captureButton = document.querySelector('#capture') as HTMLButtonElement;
const includeOlder = document.querySelector('#include-older') as HTMLInputElement;
const library = document.querySelector('#library') as HTMLElement;
const libraryList = document.querySelector('#library-list') as HTMLElement;
const googleAccount = document.querySelector('#google-account') as HTMLElement;
const copyTranscript = document.querySelector('#copy-transcript') as HTMLButtonElement;
const usageList = document.querySelector('#usage-list') as HTMLElement;
const desktopAlerts = document.querySelector('#desktop-alerts') as HTMLInputElement;
const usagePermission = document.querySelector('#usage-permission') as HTMLElement;
const contextMode = document.querySelector('#context-mode') as HTMLSelectElement;
const downloadContext = document.querySelector('#download-context') as HTMLButtonElement;
const librarySearch = document.querySelector('#library-search') as HTMLInputElement;
const captureView = document.querySelector('#capture-view') as HTMLElement;
const actionBar = document.querySelector('#action-bar') as HTMLElement;
const captureCard = document.querySelector('#capture-card') as HTMLElement;
const destinationPanel = document.querySelector('#destination-panel') as HTMLElement;
let activeView: 'capture' | 'saved' = 'capture';
let completeContext: ReturnType<typeof fullContext> | undefined;
let modeDrafts = { compact: '', full: '' };
let previousMode = 'compact';
const setView = (view: 'capture' | 'saved') => {
  activeView = view;
  captureView.hidden = view !== 'capture';
  library.hidden = view !== 'saved';
  status.hidden = view === 'saved';
  actionBar.hidden = view !== 'capture' || flow.hidden;
  (document.querySelector('#idle-footer') as HTMLElement).hidden = !actionBar.hidden;
  (document.querySelector('#tab-capture') as HTMLElement).hidden = view === 'capture' && flow.hidden;
  document.querySelector('#tab-capture')?.setAttribute('aria-pressed', String(view === 'capture'));
  document.querySelector('#tab-saved')?.setAttribute('aria-pressed', String(view === 'saved'));
};
document.querySelector('#tab-capture')?.addEventListener('click', () => { flow.hidden = true; captureCard.hidden = false;  setView('capture'); status.textContent = 'Save a chat or write your own.'; });
document.querySelector('#tab-saved')?.addEventListener('click', () => setView('saved'));
// The Baton logo and All Batons' Back button both lead home, like the ⌂ button.
const goHome = () => (document.querySelector('#tab-capture') as HTMLButtonElement).click();
document.querySelector('#library-back')?.addEventListener('click', goHome);
const brandHome = document.querySelector('#brand-home') as HTMLElement;
brandHome.addEventListener('click', goHome);
brandHome.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); goHome(); } });
const activeChatTab = async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
const sendToChat = async <T>(tab: { id?: number; url?: string }, message: unknown): Promise<T> => sendWithBootstrap(
  tab, message,
  (id, payload) => chrome.tabs.sendMessage(id, payload) as Promise<T>,
  async id => {
    const script = chrome.runtime.getManifest().content_scripts?.[0]?.js?.[0];
    if (!script) throw new Error('Baton content script is missing from this build.');
    await chrome.scripting.executeScript({ target: { tabId: id }, files: [script] });
  }
);
let activeProvider: ProviderId | undefined;
let captureStarted = false;
let activeWindowId: number | undefined;
const refreshActiveChat = createActiveChatTracker(activeChatTab, tab => sendToChat(tab, { type: 'PING' }), (tab, provider) => {
  activeWindowId = tab?.windowId;
  activeProvider = provider;
  nextChosen = undefined;
  void showUsage();
  void showNext();
// Opening Handoff acknowledges a reset reminder's toolbar mark.
void chrome.action.getBadgeText({}).then(text => { if (text === '✓') return chrome.action.setBadgeText({ text: '' }); }).catch(() => {});
  if (!captureStarted) {
    status.textContent = provider ? '' : isSupportedChatUrl(tab?.url) ? 'Connecting to your AI chat…' : 'Open an AI chat to get started.';
    (document.querySelector('#source-label') as HTMLElement).textContent = provider ? `${providerNames[provider]} · active tab` : 'Open a supported AI conversation';
  }
}, () => { if (!captureStarted) status.textContent = 'Could not connect yet. Try Save this chat, or write your own.'; });
// “Pass the baton to”: this chat's suggestions, live from the chat page (your latest message decides the task).
type NextOption = { provider: ProviderId; status: 'room' | 'unknown' | 'limited'; detail: string; reason?: string };
const nextSection = document.querySelector('#next-section') as HTMLElement;
const nextList = document.querySelector('#next-list') as HTMLOListElement;
const nextTasks = document.querySelector('#next-tasks') as HTMLElement;
const nextBasis = document.querySelector('#next-basis') as HTMLElement;
const nextStatus = document.querySelector('#next-status') as HTMLElement;
const nextColor: Record<ProviderId, string> = { claude: '#d97757', gemini: '#4c8df6', chatgpt: '#10a37f', deepseek: '#4d6bfe', grok: '#9aa3ad', perplexity: '#20b8cd' };
let nextChosen: Topic | undefined;
let nextBusy = false;
const showNext = async () => {
  if (!activeProvider || nextBusy) { if (!activeProvider) nextSection.hidden = true; return; }
  nextBusy = true;
  try {
    const tab = await activeChatTab();
    const reply = tab?.id ? await sendToChat<{ ok: boolean; asked: string; topic: Topic; options: NextOption[] }>(tab, { type: 'SUGGEST', topic: nextChosen }) : undefined;
    if (!reply?.ok) { nextSection.hidden = true; return; }
    nextSection.hidden = false;
    const sameAi = document.querySelector('#next-same-ai') as HTMLElement; sameAi.hidden = false;
    (document.querySelector('#next-same-ai-label') as HTMLElement).textContent = `Switch ${providerNames[activeProvider]} account`;
    nextBasis.textContent = reply.asked ? `${nextChosen ? 'Best for' : 'Looks like'} ${topicNames[reply.topic].toLowerCase()} · based on “${reply.asked.replace(/\s+/g, ' ').slice(0, 60)}${reply.asked.length > 60 ? '…' : ''}”` : 'Best for everyday use first. Pick a task to change the order.';
    nextTasks.replaceChildren(...topics.map(topic => {
      const chip = document.createElement('button'); chip.type = 'button'; chip.textContent = topicNames[topic]; chip.setAttribute('aria-pressed', String(topic === reply.topic));
      chip.addEventListener('click', () => { nextChosen = topic; void showNext(); });
      return chip;
    }));
    const usable = reply.options.filter(option => option.status !== 'limited');
    const shown = [...usable.slice(0, 3), ...reply.options.filter(option => option.status === 'limited').slice(0, Math.max(0, 3 - usable.length))];
    nextList.replaceChildren(...shown.map((option, index) => {
      const item = document.createElement('li'); if (option.status === 'limited') item.className = 'limited';
      const dot = document.createElement('i'); dot.className = 'dot'; dot.style.setProperty('--c', nextColor[option.provider]);
      const who = document.createElement('span'); who.className = 'who';
      const name = document.createElement('b'); name.textContent = providerNames[option.provider];
      const detail = document.createElement('small'); detail.textContent = optionLine(option, option.reason);
      who.append(name, detail); item.append(dot, who);
      if (index === 0 && option.status !== 'limited') { const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = 'Best'; item.append(tag); }
      if (option.status !== 'limited') {
        const go = document.createElement('button'); go.type = 'button'; go.className = 'go'; go.textContent = 'Pass →';
        go.setAttribute('aria-label', `Pass the baton to ${providerNames[option.provider]}`);
        go.addEventListener('click', async () => {
          go.disabled = true; nextStatus.textContent = 'Saving your chat and opening the next AI…';
          const result = await sendToChat<{ ok: boolean; text: string }>(tab!, { type: 'PASS_TO', provider: option.provider, topic: reply.topic, next: (document.querySelector('#next-step') as HTMLInputElement).value }).catch(() => undefined);
          nextStatus.textContent = result?.text || 'That did not work. Use Save this chat instead.'; go.disabled = false;
        });
        item.append(go);
      }
      return item;
    }));
  } catch { nextSection.hidden = true; } finally { nextBusy = false; }
};
document.querySelector('#next-refresh')?.addEventListener('click', () => { nextChosen = undefined; void showNext(); });
// Same AI, another account: the chat page saves the project and offers it on the next fresh chat after you switch.
const sameAiOther = async (status: HTMLElement) => {
  const tab = await activeChatTab();
  if (!tab?.id) { status.textContent = 'Open the AI chat you want to continue first.'; return; }
  status.textContent = 'Saving your project…';
  const reply = await sendToChat<{ ok: boolean; text: string }>(tab, { type: 'SAME_AI_OTHER_ACCOUNT', next: (document.querySelector('#next-step') as HTMLInputElement | null)?.value }).catch(() => undefined);
  status.textContent = reply?.text || 'That did not work. Refresh the chat tab and try again.';
};
document.querySelector('#next-same-ai')?.addEventListener('click', () => { void sameAiOther(nextStatus); });
document.querySelector('#same-ai-other')?.addEventListener('click', () => { void sameAiOther(status); });
// The box text changes as you type: refresh while Baton is open, and when you come back to it.
setInterval(() => { if (!document.hidden && !nextChosen) void showNext(); }, 15000);
window.addEventListener('focus', () => { if (!nextChosen) void showNext(); });
const refreshChat = () => { void refreshActiveChat().catch(() => { /* Capture provides recovery guidance. */ }); };
refreshChat();
chrome.tabs.onActivated?.addListener(info => { if (activeWindowId === undefined || info.windowId === activeWindowId) refreshChat(); });
chrome.tabs.onUpdated?.addListener((_id, change, tab) => {
  if (tab.active && (activeWindowId === undefined || tab.windowId === activeWindowId) && (change.url || change.status === 'complete')) refreshChat();
});
const usageDialog = document.querySelector('#usage-dialog') as HTMLDialogElement;
// The page never scrolls (only the inner list does): undo any scroll a browser forces on it, from a focus jump to
// scroll-into-view, so the popup can't slide away and go black.
const keepPageStill = () => { for (const element of [document.documentElement, document.body]) if (element.scrollTop || element.scrollLeft) { element.scrollTop = 0; element.scrollLeft = 0; } };
document.addEventListener('scroll', event => { if (event.target === document) keepPageStill(); }, { capture: true, passive: true });
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('focusin', () => requestAnimationFrame(keepPageStill)));
document.querySelector('#show-usage')?.addEventListener('click', () => { usageDialog.showModal(); void showUsage(); });
document.querySelector('#close-usage')?.addEventListener('click', () => usageDialog.close());
// Shared by the Usage window's Refresh all and the dashboard's Refresh usage button.
async function refreshAllUsage(button: HTMLButtonElement, message: HTMLElement, compact = false) {
  button.disabled = true; message.textContent = compact ? 'Checking usage pages…' : 'Checking open AI tabs and each service’s usage page…';
  try {
    const tabs = (await chrome.tabs.query({})).filter(tab => isSupportedChatUrl(tab.url));
    const results = await Promise.allSettled(tabs.map(tab => sendToChat<{ ok?: boolean }>(tab, { type: 'REFRESH_USAGE' })));
    const connected = results.filter(result => result.status === 'fulfilled' && result.value?.ok).length;
    const pages = await chrome.runtime.sendMessage({ type: 'REFRESH_ALL_USAGE', openTabs: true }) as { ok?: boolean; results?: { provider: ProviderId; status: string }[] } | undefined;
    await showUsage();
    if (compact) {
      const marks = (pages?.results || []).map(result => `${providerNames[result.provider]} ${result.status === 'read' ? '✓' : '✗'}`).join('  ');
      message.textContent = marks ? `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${marks}` : 'No usage pages to check.';
      message.title = (pages?.results || []).filter(result => result.status !== 'read').map(result => `${providerNames[result.provider]}: not shown (signed out or page changed)`).join('\n');
      return;
    }
    const pageSummary = (pages?.results || []).map(result => `${providerNames[result.provider]} ${result.status === 'read' ? 'read' : 'not shown (signed out or page changed)'}`).join(', ');
    message.textContent = `${connected ? `Refreshed ${connected} open AI tab${connected === 1 ? '' : 's'}. ` : ''}${pageSummary ? `Usage pages: ${pageSummary}.` : 'No usage pages to check.'} Services without a usage page update when they show a limit.`;
  } catch { message.textContent = 'Could not refresh. Try again.'; }
  finally { button.disabled = false; }
}
for (const [buttonId, statusId] of [['#refresh-all-usage', '#usage-refresh-status'], ['#dashboard-refresh-usage', '#dashboard-refresh-status']]) {
  const button = document.querySelector(buttonId) as HTMLButtonElement | null;
  button?.addEventListener('click', () => { void refreshAllUsage(button, document.querySelector(statusId) as HTMLElement, buttonId === '#dashboard-refresh-usage'); });
}
window.setInterval(() => { void showUsage(); }, 60000);
// Each service's own brand colour marks its lane and its batons.
const laneColors: Record<ProviderId, string> = { claude: '#d97757', gemini: '#4c8df6', chatgpt: '#10a37f', deepseek: '#4d6bfe', grok: '#9aa3ad', perplexity: '#20b8cd' };
const providerNames: Record<ProviderId, string> = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', deepseek: 'DeepSeek', grok: 'Grok', perplexity: 'Perplexity' };
// Messages Handoff counted in the service's window, with the limit learned from past limit notices.
const countedLine = (saved: Record<string, any>, id: ProviderId): string => { const summary = messageSummary(id, (saved[`usageSends:${id}`] || []) as number[], (saved[`limitHits:${id}`] || []) as LimitHit[], Date.now(), saved[`statedLimit:${id}`]); return summary.count || summary.learnedLimit !== undefined ? `${summary.text} · counted by Baton` : ''; };
// Official readings plus, for windows chat draws from, an estimate moved forward by messages sent since.
const shownWindows = (saved: Record<string, any>, id: ProviderId): DisplayWindow[] => displayWindows((saved[`usageWindows:${id}`] || []) as UsageWindow[], (saved[`usageHistory:${id}`] || {}) as UsageHistory, (saved[`usageSends:${id}`] || []) as number[]);
// Usage: the current AI's card stays on top; every other AI is in the “Other AIs” drop-down,
// services used this week first and the rest behind “＋ N more”.
let showAllLanes = false;
let otherLanesTouched = false;
function renderLanes(saved: Record<string, any>) {
  const lanes = document.querySelector('#lanes') as HTMLElement | null;
  if (!lanes) return;
  const enabled = (saved.enabledProviders || {}) as Record<string, boolean>;
  const order = providerIds.filter(id => providerEnabled(id, enabled) && id !== activeProvider);
  const used = order.filter(id => laneInUse(saved, id));
  const box = document.querySelector('#other-lanes') as HTMLDetailsElement | null;
  if (box) {
    (document.querySelector('#other-lanes-title') as HTMLElement).textContent = activeProvider ? 'Other AIs' : 'All AIs';
    (document.querySelector('#other-lanes-summary') as HTMLElement).textContent = (used.length ? used : order).slice(0, 2).map(id => `${providerNames[id]} ${laneFor(saved, id).value}`).join(' · ');
    // Starts closed; the summary line shows the top two, and the list stays however the user leaves it.
    if (!otherLanesTouched) box.open = false;
    if (!box.dataset.wired) { box.dataset.wired = 'true'; box.addEventListener('toggle', () => { otherLanesTouched = true; }); }
  }
  const rest = order.filter(id => !used.includes(id));
  const shown = showAllLanes || !used.length ? order : used;
  const more = document.createElement('button'); more.type = 'button'; more.className = 'link-button lanes-more';
  more.textContent = showAllLanes ? 'Show only services I use' : `＋ ${rest.length} more service${rest.length === 1 ? '' : 's'}`;
  more.setAttribute('aria-expanded', String(showAllLanes));
  more.addEventListener('click', () => { showAllLanes = !showAllLanes; renderLanes(saved); });
  lanes.replaceChildren(...shown.map(id => {
    const lane = laneFor(saved, id);
    const row = document.createElement('div'); row.className = 'lane'; row.setAttribute('role', 'listitem'); row.style.setProperty('--lane', laneColors[id]);
    const name = document.createElement('b'); name.textContent = providerNames[id];
    if (id === activeProvider) { const here = document.createElement('span'); here.className = 'here'; here.textContent = 'here'; name.append(here); }
    const track = document.createElement('span'); track.className = `track${lane.left === undefined ? ' unknown' : lane.left < 20 ? ' low' : ''}`;
    if (lane.left !== undefined) { const fill = document.createElement('span'); fill.style.width = `${Math.max(2, lane.left)}%`; track.append(fill); }
    const value = document.createElement('em'); value.textContent = lane.value;
    const detail = document.createElement('small'); detail.textContent = lane.detail;
    // Other allowances (ChatGPT's Work/Codex, credits) sit behind a small hover note, so the row stays about chat.
    if (lane.extras.length) {
      const note = document.createElement('span'); note.className = 'lane-extras'; note.tabIndex = 0;
      note.textContent = lane.extras.every(text => /work|codex|credit|reset/i.test(text)) ? '＋ Work & credits' : '＋ Other limits';
      note.title = lane.extras.join('\n'); note.setAttribute('aria-label', lane.extras.join(', '));
      detail.append(' ', note);
    }
    row.setAttribute('aria-label', `${providerNames[id]}: ${lane.value}${lane.detail ? `, ${lane.detail}` : ''}`);
    row.append(name, track, value, detail);
    return row;
  }), ...(rest.length && used.length ? [more] : []));
}
async function showUsage() {
  const saved = await chrome.storage.local.get([...providerIds.flatMap(id => [`meter:${id}`, `usageWindows:${id}`, `usageHistory:${id}`, `usageSends:${id}`, `limitHits:${id}`, `statedLimit:${id}`, `usageApiCheck:${id}`, `usageTapCheck:${id}`]), 'enabledProviders', 'usageApiRefresh']);
  renderLanes(saved);
  usageList.replaceChildren();
  renderActiveUsage(saved);
  for (const id of providerIds) {
    const row = document.createElement('div'); row.className = 'usage-row';
    const name = document.createElement('strong'); name.textContent = providerNames[id];
    const value = document.createElement('span'); value.textContent = meterSummary(saved[`meter:${id}`] as Meter | undefined);
    const counted = countedLine(saved, id);
    if (counted) { const line = document.createElement('small'); line.className = 'usage-window'; line.textContent = counted; value.append(line); }
    const windows = shownWindows(saved, id);
    if (windows.length) {
      value.className = 'usage-detail'; value.replaceChildren();
      for (const win of windows) {
        const bucket = document.createElement('span'); bucket.className = 'usage-window'; bucket.textContent = displayLabel(win) || windowLabel(win);
        if (win.percent !== undefined) { const progress = document.createElement('progress'); progress.className = 'usage-gauge'; progress.max = 100; progress.value = win.percent; progress.setAttribute('aria-label', `${win.feature}: ${win.percent}% used`); bucket.append(progress); }
        const source = document.createElement('small'); source.textContent = win.estimate ? 'Estimated from messages you sent since the last service reading' : `Shown on service page · ${win.at ? new Date(win.at).toLocaleTimeString() : ''}`; bucket.append(source); value.append(bucket);
      }
    }
    row.append(name, value); usageList.append(row);
  }
}
void showUsage();
async function readVisibleUsage() {
  const button = document.querySelector('#read-active-usage') as HTMLButtonElement;
  button.disabled = true;
  const note = document.querySelector('#active-usage-note') as HTMLElement;
  note.textContent = 'Checking visible service readings…';
  try {
    const provider = activeProvider || 'claude';
    const page = usagePageUrl(provider);
    if (page) {
      const usageTab = (await chrome.tabs.query({})).find(tab => isUsagePageUrl(provider, tab.url));
      if (usageTab?.id && usageTab.status !== 'loading') {
        await sendToChat(usageTab, { type: 'REFRESH_USAGE' });
        await showUsage();
        note.textContent += ' Checked the open usage page.';
      } else {
        await chrome.tabs.create({ url: page });
      }
    } else {
      const tab = await activeChatTab();
      await sendToChat(tab, { type: 'REFRESH_USAGE' });
      await showUsage();
    }
  } catch {
    note.textContent = 'Could not read this page. Open the service’s usage screen and try again.';
  } finally { button.disabled = false; }
}
// The usage card redraws whenever usage changes; an opened Details stays open.
let usageDetailsOpen = false;
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', ...children: (Node | string)[]) => { const node = document.createElement(tag); if (className) node.className = className; node.append(...children); return node; };
function renderActiveUsage(saved: Record<string, any>) {
  const card = document.querySelector('#active-usage') as HTMLElement;
  card.hidden = !activeProvider;
  if (!activeProvider) return;
  (document.querySelector('#active-usage-title') as HTMLElement).textContent = `${providerNames[activeProvider]} usage`;
  const container = document.querySelector('#active-usage-values') as HTMLElement;
  const note = document.querySelector('#active-usage-note') as HTMLElement;
  const windows = shownWindows(saved, activeProvider);
  const meter = saved[`meter:${activeProvider}`] as Meter | undefined;
  const readings = windows.length ? windows : isCurrentReading(meter) && (meter.percent !== undefined || meter.remainingTokens !== undefined || meter.remainingCount !== undefined) ? [meter] : [];
  container.replaceChildren();
  for (const reading of readings) {
    const row = document.createElement('div'); row.className = 'active-usage-reading';
    const label = document.createElement('span'); label.textContent = reading.feature;
    const count = (reading as UsageWindow).remainingCount;
    const guess = (reading as DisplayWindow).estimate?.perMessage !== undefined && (reading as DisplayWindow).estimate!.sends ? '≈' : '';
    const value = document.createElement('strong'); value.textContent = reading.percent !== undefined ? `${guess}${Number((100 - reading.percent).toFixed(1))}% left` : count !== undefined ? `${count.toLocaleString()} left` : reading.remainingTokens !== undefined ? `${reading.remainingTokens.toLocaleString()} tokens left` : 'Balance unknown';
    row.append(label, value);
    if (reading.percent !== undefined) { const bar = document.createElement('progress'); bar.max = 100; bar.value = reading.percent; bar.setAttribute('aria-label', `${reading.feature}: ${reading.percent}% used`); row.append(bar); }
    const detail = document.createElement('small'); detail.textContent = displayLabel(reading as DisplayWindow) || windowLabel(reading as UsageWindow); row.append(detail);
    container.append(row);
  }
  // ChatGPT's page covers Codex/Work and credits only; say plainly that chat itself shows no limit.
  if (activeProvider === 'chatgpt' && readings.length && !readings.some(reading => estimable(reading))) { const line = document.createElement('p'); line.className = 'usage-unavailable'; line.textContent = 'ChatGPT has no limit on text chat. The 5-hour and weekly limits below are for Codex and Work.'; container.prepend(line); }
  const counted = countedLine(saved, activeProvider);
  if (counted) { const line = document.createElement('p'); line.className = 'usage-unavailable'; line.textContent = counted; container.append(line); }
  if (!readings.length && !counted) { const empty = document.createElement('p'); empty.className = 'usage-unavailable'; empty.textContent = 'Send a message and your usage will appear'; container.append(empty); }
  note.textContent = readings.length ? `${readings.some(reading => (reading as DisplayWindow).estimate) ? 'Last service reading' : 'Service reading'} · ${new Date(Math.min(...readings.map(reading => reading.at!))).toLocaleTimeString()}.${readings.some(reading => (reading as DisplayWindow).estimate) ? ' Values marked ≈ are estimated from messages you sent since.' : ''} Refresh to check again.` : activeProvider === 'claude' ? 'Claude reports your session and weekly use with each reply.' : activeProvider === 'gemini' ? 'Gemini’s usage page shows its 5-hour and weekly limits.' : activeProvider === 'chatgpt' ? 'ChatGPT has no limit on text chat. Its usage page covers Codex and Work.' : 'Usage appears when the AI shows a limit.';
  (document.querySelector('#read-active-usage') as HTMLButtonElement).textContent = usagePageUrl(activeProvider) ? `Open ${providerNames[activeProvider]}’s usage page ↗` : 'Refresh';
  // Baton's own usage check with the user's sign-in: when it last ran and what the service answered.
  const check = saved[`usageApiCheck:${activeProvider}`] as UsageCheck | undefined;
  if (['chatgpt', 'claude', 'gemini'].includes(activeProvider)) {
    const name = providerNames[activeProvider];
    const lastReading = readings.length ? Math.min(...readings.map(reading => reading.at!)) : undefined;
    // A status box in plain words; what the service actually answered is tidied under Details.
    const status = usageCheckSummary(name, check, { off: saved.usageApiRefresh === false, lastReading });
    const box = element('div', 'usage-status'); box.dataset.tone = status.tone;
    box.append(element('i', 'usage-dot'), element('span', '', element('b', '', status.headline), element('small', '', status.detail)));
    container.append(box);
    // The status box already says when the figures are from.
    if (lastReading && !readings.some(reading => (reading as DisplayWindow).estimate)) note.textContent = '';
    const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const tap = saved[`usageTapCheck:${activeProvider}`] as { at: number; kind: string; fields: string } | undefined;
    const showTap = !!tap && (!check || tap.at > check.at - 600000);
    if (!check && !showTap) return;
    const details = document.createElement('details'); details.className = 'usage-details';
    details.open = usageDetailsOpen; details.addEventListener('toggle', () => { usageDetailsOpen = details.open; });
    details.append(element('summary', '', 'Details'));
    // One plain sentence; the service's field names (useful only when debugging a changed format) stay in the tooltip.
    const fieldRow = (fields: CheckField[]) => {
      const empty = fields.filter(field => !field.filled).length;
      const answer = element('dd', 'usage-answer', !fields.length ? `${name} sent nothing Baton could read.` : empty === fields.length ? `${name} replied, but without any usage numbers.` : `${name} replied in a form Baton can’t read yet.`);
      if (fields.length) answer.title = `Fields ${name} sent: ${fields.map(field => `${field.name}${field.filled ? '' : ' (empty)'}`).join(', ')}`;
      return [element('dt', '', 'Answer'), answer];
    };
    const block = (title: string, at: number, rows: HTMLElement[]) => {
      const head = element('div', 'check-head', element('b', '', title), element('time', '', time(at)));
      details.append(element('section', 'check-block', head, element('dl', '', ...rows)));
    };
    if (check) {
      const parts = readCheckSteps(check.steps);
      const rows: HTMLElement[] = [element('dt', '', 'Asked'), element('dd', '', check.route === 'tab' ? `${name}, from your open tab` : check.route === 'background' ? `${name}, from the background` : 'No chat tab to ask from')];
      // Only worth showing when something went wrong (an error, or a sign-in the service refused).
      if (parts.requests.some(request => !request.ok)) rows.push(element('dt', '', 'Replies'), element('dd', 'request-chips', ...parts.requests.map(request => element('span', request.ok ? 'ok' : 'bad', `${request.ok ? '✓' : '✕'} ${request.name}${request.ok && !request.tab ? '' : ` (${[request.ok ? '' : request.status, request.tab ? 'open tab' : ''].filter(Boolean).join(', ')})`}`))));
      if (parts.fields.length || !check.readings) rows.push(...fieldRow(parts.fields));
      if (parts.notes.length) rows.push(element('dt', '', 'Note'), element('dd', '', parts.notes.join(' · ')));
      if (check.retryAt && check.retryAt > Date.now()) rows.push(element('dt', '', 'Next try'), element('dd', '', time(check.retryAt)));
      block('Sign-in check', check.at, rows);
    }
    if (tap && showTap) {
      const fields = tap.kind === 'claude-stream' ? [] : readFields(tap.fields);
      const same = check && JSON.stringify(fields) === JSON.stringify(readCheckSteps(check.steps).fields) && fields.length;
      block('From the page', tap.at, tap.kind === 'claude-stream' ? [element('dt', '', 'Reply note'), element('dd', '', tap.fields)] : same ? [element('dt', '', 'Answer'), element('dd', '', 'The same as above.')] : fieldRow(fields));
    }
    container.append(details);
  }
}
document.querySelector('#read-active-usage')?.addEventListener('click', () => { void readVisibleUsage(); });
for (const provider of ['claude', 'gemini', 'chatgpt'] as const) document.querySelector(`#check-${provider}-usage`)?.addEventListener('click', () => { void chrome.tabs.create({ url: usagePageUrl(provider)! }); });
chrome.storage.onChanged.addListener(changes => { if (providerIds.some(id => changes[`meter:${id}`] || changes[`usageWindows:${id}`] || changes[`usageSends:${id}`] || changes[`usageHistory:${id}`] || changes[`limitHits:${id}`] || changes[`statedLimit:${id}`] || changes[`usageApiCheck:${id}`] || changes[`usageTapCheck:${id}`])) void showUsage(); });
desktopAlerts.checked = !!(await chrome.storage.local.get('desktopUsageAlerts')).desktopUsageAlerts;
desktopAlerts.addEventListener('change', async () => {
  if (desktopAlerts.checked) {
    const granted = await chrome.permissions.request({ permissions: ['notifications'] }).catch(() => false);
    if (!granted) { desktopAlerts.checked = false; usagePermission.textContent = 'Notification permission was not granted.'; return; }
  }
  await chrome.storage.local.set({ desktopUsageAlerts: desktopAlerts.checked });
  usagePermission.textContent = desktopAlerts.checked ? 'Alerts are on. Each threshold is shown once per observed limit window.' : 'Desktop alerts are off.';
  if (desktopAlerts.checked) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) void chrome.tabs.sendMessage(tab.id, { type: 'REFRESH_USAGE' }).catch(() => {});
  }
});
let reviewed = false;
const showDraftBudget = () => {
  // The limit of the AI chosen below (how much its chat box takes in one go).
  const budget = draftBudget(draft.value, destination.value as ProviderId);
  (document.querySelector('#use-compact') as HTMLButtonElement).hidden = budget.fits || contextMode.value !== 'full';
  saveBrief.disabled = !draft.value.trim();
  // Any length can be passed: the button never refuses (see fitToBox).
  openDraft.disabled = !draft.value.trim();
  openDraft.textContent = reviewed ? 'Pass the baton ↗' : 'Review & continue ↗';
  captureCard.hidden = !flow.hidden;
  (document.querySelector('#tab-capture') as HTMLElement).hidden = flow.hidden && activeView === 'capture';
  destinationPanel.hidden = !reviewed;
  actionBar.hidden = activeView !== 'capture' || flow.hidden;
  (document.querySelector('#idle-footer') as HTMLElement).hidden = !actionBar.hidden;
  copyDraft.disabled = !draft.value.trim();
  draftBudgetLabel.dataset.state = !draft.value.trim() ? 'empty' : 'ready';
  draft.setAttribute('aria-invalid', 'false');
  const into = providerNames[destination.value as ProviderId];
  draftBudgetLabel.textContent = !draft.value.trim() ? 'Draft is empty.' : budget.fits
    ? `About ${budget.approximateTokens.toLocaleString('en-US')} tokens. It goes into ${into} whole.`
    : `About ${budget.approximateTokens.toLocaleString('en-US')} tokens, more than ${into}'s chat box takes at once (${budget.limit.toLocaleString('en-US')} characters). Baton types the summary and attaches all of it as a file, so nothing is lost.`;
  draftPreview.textContent = !draft.value.trim() ? 'Paste a brief to continue.' : reviewed ? 'Draft ready. You can open it in a new chat.' : 'Draft ready. Open it below to review before continuing.';
};
draft.addEventListener('input', () => { saveBrief.disabled = !draft.value.trim(); showDraftBudget(); });
reviewPanel.addEventListener('toggle', () => { if (reviewPanel.open) { reviewed = true; showDraftBudget(); } });
const urls: Record<ProviderId, string> = { chatgpt: 'https://chatgpt.com/', claude: 'https://claude.ai/new', gemini: 'https://gemini.google.com/app', deepseek: 'https://chat.deepseek.com/', grok: 'https://grok.com/', perplexity: 'https://www.perplexity.ai/' };
const showAccountHelp = () => { googleAccount.hidden = destination.value !== 'gemini'; };
document.querySelector('#open-gemini-account')?.addEventListener('click', () => { void chrome.tabs.create({ url: urls.gemini }); });
await pruneExpired();
let source: ProviderId = 'chatgpt';
let currentBrief: Brief | undefined;
let sourceUrl = '';
let currentTopic: Topic = 'general';

const refreshContext = async () => {
  const archive = sourceUrl ? (await chrome.storage.local.get(`archive:brief:${sourceUrl}`))[`archive:brief:${sourceUrl}`] as TurnArchive | undefined : undefined;
  completeContext = archive?.turns.length ? fullContext(archive, sourceUrl, undefined, currentBrief) : undefined;
  copyTranscript.disabled = !completeContext;
  downloadContext.disabled = !completeContext;
  contextMode.options[1].disabled = !completeContext;
  modeDrafts = { compact: currentBrief ? wrapHandoff(renderBrief(currentBrief).text) : draft.value, full: completeContext?.draft || '' };
  contextMode.value = 'compact'; previousMode = 'compact';
  draft.value = modeDrafts.compact;
  (document.querySelector('#context-goal') as HTMLElement).textContent = currentBrief?.goal || 'Your pasted context';
  (document.querySelector('#summary-goal') as HTMLElement).textContent = currentBrief?.goal || 'Your pasted context';
  (document.querySelector('#summary-progress') as HTMLElement).textContent = currentBrief?.status || currentBrief?.last_exchange.assistant || 'Review the context before continuing.';
  (document.querySelector('#summary-next') as HTMLElement).textContent = currentBrief?.next_step || 'Choose your next step in the destination chat.';
  (document.querySelector('#capture-summary') as HTMLElement).textContent = archive?.turns.length
    ? `${captureCheck(archive.turns).text}${archive.truncated ? ' · earlier text trimmed at storage cap' : archive.incomplete ? ' · possible gaps, review the full text' : ''}`
    : currentBrief ? 'Project brief loaded · full transcript unavailable' : 'Manual context · save it to a project to keep it';
  showDraftBudget();
};
contextMode.addEventListener('change', () => {
  modeDrafts[previousMode as keyof typeof modeDrafts] = draft.value;
  previousMode = contextMode.value;
  draft.value = modeDrafts[previousMode as keyof typeof modeDrafts];
  reviewed = false; reviewPanel.open = false;
  showDraftBudget();
});
document.querySelector('#use-compact')?.addEventListener('click', () => { contextMode.value = 'compact'; contextMode.dispatchEvent(new Event('change')); status.textContent = 'Short summary selected. The whole chat is still saved.'; });
// Batons can be deleted one at a time, a selection, or all at once. Every delete first shows what it removes.
type LibraryItem = { id: string; url: string; variants?: string[]; name: string; brief: Brief; folder?: string };
let libraryItems: LibraryItem[] = [];
let libraryDismissed: string[] = [];
const selectedBatons = new Set<string>();
let selectingBatons = false;
// The folder open in All Batons (undefined: the top level; '': not in a folder, wide layout only), and the batons it shows.
let openFolder: string | undefined;
let shownItems: LibraryItem[] = [];
const batonKey = (item: LibraryItem) => item.id || item.url;
const deleteBatons = async (list: LibraryItem[]) => {
  const dismiss: string[] = [];
  for (const item of list) {
    if (item.id) { await deleteProject(item.id); if (item.id.startsWith('capture:')) dismiss.push(item.url); }
    else await chrome.storage.local.remove((item.variants || [item.url]).flatMap(url => [`brief:${url}`, `savedAt:brief:${url}`, `archive:brief:${url}`, `visibleTurnsHighWater:brief:${url}`]));
  }
  if (dismiss.length) await chrome.storage.local.set({ dismissedRecentUrls: [...new Set([...libraryDismissed, ...dismiss])].slice(-5000) });
};
const deleteDialog = document.querySelector('#delete-dialog') as HTMLDialogElement;
let pendingDelete: LibraryItem[] = [];
const askDelete = (list: LibraryItem[]) => {
  if (!list.length) return;
  pendingDelete = list;
  (document.querySelector('#delete-title') as HTMLElement).textContent = list.length === 1 ? 'Delete this saved chat?' : list.length === libraryItems.length ? `Delete all ${list.length} saved chats?` : `Delete ${list.length} saved chats?`;
  (document.querySelector('#delete-what') as HTMLElement).textContent = list.length === 1 ? `“${list[0].name}”` : list.slice(0, 3).map(item => `“${item.name.slice(0, 40)}”`).join(', ') + (list.length > 3 ? ` and ${list.length - 3} more` : '');
  (document.querySelector('#delete-confirm') as HTMLElement).textContent = list.length === 1 ? 'Delete' : `Delete ${list.length}`;
  deleteDialog.showModal();
  (deleteDialog.querySelector('button[value="cancel"]') as HTMLButtonElement).focus();
};
deleteDialog.addEventListener('close', async () => {
  if (deleteDialog.returnValue !== 'delete' || !pendingDelete.length) return;
  const count = pendingDelete.length;
  await deleteBatons(pendingDelete);
  pendingDelete = []; selectedBatons.clear(); selectingBatons = false;
  await showLibrary();
  status.hidden = false; status.textContent = `${count} saved chat${count === 1 ? '' : 's'} deleted from this browser.`;
});
document.querySelector('#delete-backup-first')?.addEventListener('click', () => { (document.querySelector('#backup-all') as HTMLButtonElement | null)?.click(); });
const updateBatonTools = () => {
  for (const tools of Array.from(document.querySelectorAll<HTMLElement>('.baton-tools'))) {
    tools.hidden = !libraryItems.length;
    const show = (selector: string, visible: boolean) => { (tools.querySelector(selector) as HTMLElement).hidden = !visible; };
    show('.sel-start', !selectingBatons); show('.del-all', !selectingBatons);
    show('.sel-count', selectingBatons); show('.sel-all', selectingBatons); show('.sel-delete', selectingBatons); show('.sel-move', selectingBatons); show('.sel-cancel', selectingBatons);
    (tools.querySelector('.sel-count') as HTMLElement).textContent = `${selectedBatons.size} selected`;
    const remove = tools.querySelector('.sel-delete') as HTMLButtonElement; remove.disabled = !selectedBatons.size; remove.textContent = selectedBatons.size ? `Delete ${selectedBatons.size}` : 'Delete selected';
    (tools.querySelector('.sel-move') as HTMLButtonElement).disabled = !selectedBatons.size;
  }
  for (const list of ['#recent-list', '#library-list']) document.querySelector(list)?.classList.toggle('selecting', selectingBatons);
  for (const row of Array.from(document.querySelectorAll<HTMLElement>('.capsule-row[data-key]'))) {
    const picked = selectedBatons.has(row.dataset.key!);
    row.classList.toggle('picked', picked); (row.querySelector('.pick') as HTMLInputElement).checked = picked;
  }
};
const toggleBaton = (key: string) => { if (selectedBatons.has(key)) selectedBatons.delete(key); else selectedBatons.add(key); updateBatonTools(); };
for (const tools of Array.from(document.querySelectorAll<HTMLElement>('.baton-tools'))) {
  tools.querySelector('.sel-start')?.addEventListener('click', () => { selectingBatons = true; updateBatonTools(); });
  tools.querySelector('.sel-cancel')?.addEventListener('click', () => { selectingBatons = false; selectedBatons.clear(); updateBatonTools(); });
  tools.querySelector('.sel-all')?.addEventListener('click', () => { for (const item of tools.dataset.list === 'library' ? shownItems : libraryItems) selectedBatons.add(batonKey(item)); updateBatonTools(); });
  tools.querySelector('.sel-delete')?.addEventListener('click', () => { askDelete(libraryItems.filter(item => selectedBatons.has(batonKey(item)))); });
  tools.querySelector('.sel-move')?.addEventListener('click', () => { void askMove(libraryItems.filter(item => selectedBatons.has(batonKey(item)))); });
  tools.querySelector('.del-all')?.addEventListener('click', () => { askDelete(libraryItems); });
}
// Filing: pick batons (Select, or the ▤ button on one), then an existing folder, “No folder”, or a new name.
const moveDialog = document.querySelector('#move-dialog') as HTMLDialogElement;
const moveFolders = document.querySelector('#move-folders') as HTMLFieldSetElement;
const moveNew = document.querySelector('#move-new') as HTMLInputElement;
const moveError = document.querySelector('#move-error') as HTMLElement;
let pendingMove: LibraryItem[] = [];
const askMove = async (list: LibraryItem[]) => {
  if (!list.length) return;
  pendingMove = list;
  (document.querySelector('#move-title') as HTMLElement).textContent = list.length === 1 ? 'Move this saved chat to a folder' : `Move ${list.length} saved chats to a folder`;
  (document.querySelector('#move-what') as HTMLElement).textContent = list.length === 1 ? `“${list[0].name}”` : list.slice(0, 3).map(item => `“${item.name.slice(0, 40)}”`).join(', ') + (list.length > 3 ? ` and ${list.length - 3} more` : '');
  const current = new Set(list.map(item => item.folder || ''));
  const only = current.size === 1 ? [...current][0] : undefined;
  for (const option of Array.from(moveFolders.querySelectorAll('label'))) option.remove();
  for (const folder of ['', ...await listFolders()]) {
    const label = document.createElement('label'); label.className = 'move-option';
    const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'move-folder'; radio.value = folder; radio.checked = folder === only;
    radio.addEventListener('change', () => { moveNew.value = ''; moveError.textContent = ''; });
    const text = document.createElement('span'); text.textContent = folder || 'No folder';
    if (folder === only) { const note = document.createElement('small'); note.textContent = ' (now)'; text.append(note); }
    label.append(radio, text); moveFolders.append(label);
  }
  moveNew.value = ''; moveError.textContent = '';
  moveDialog.showModal();
  if (moveFolders.querySelectorAll('label').length === 1) moveNew.focus();
};
moveNew.addEventListener('input', () => { moveError.textContent = ''; if (moveNew.value.trim()) for (const radio of Array.from(moveFolders.querySelectorAll<HTMLInputElement>('input'))) radio.checked = false; });
document.querySelector('#cancel-move')?.addEventListener('click', () => moveDialog.close());
moveDialog.querySelector('form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const picked = moveFolders.querySelector<HTMLInputElement>('input:checked');
  if (!moveNew.value.trim() && !picked) { moveError.textContent = 'Choose a folder or type a new folder name.'; return; }
  try { await fileBatons(pendingMove, moveNew.value.trim() || picked!.value); moveDialog.close(); pendingMove = []; }
  catch { moveError.textContent = 'Could not move these chats. Try again.'; }
});
const fileBatons = async (list: LibraryItem[], name: string) => {
  const folder = await moveToFolder(list, name);
  selectedBatons.clear(); selectingBatons = false;
  await showLibrary();
  status.hidden = false; status.textContent = `${list.length} saved chat${list.length === 1 ? '' : 's'} ${folder ? `moved to ${folder}` : `taken out of ${list.length === 1 ? 'its folder' : 'their folders'}`}.`;
};
// Drag a baton (or, while selecting, every ticked baton) onto a folder to file it, or onto “All batons” to take it out.
const dragType = 'application/x-baton-keys';
const dropTarget = (target: HTMLElement, folder: string) => {
  target.addEventListener('dragover', event => { if (!event.dataTransfer?.types.includes(dragType)) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; target.classList.add('drop'); });
  target.addEventListener('dragleave', () => target.classList.remove('drop'));
  target.addEventListener('drop', event => {
    event.preventDefault(); target.classList.remove('drop');
    const keys: unknown = JSON.parse(event.dataTransfer?.getData(dragType) || '[]');
    const list = libraryItems.filter(item => Array.isArray(keys) && keys.includes(batonKey(item)) && (item.folder || '') !== folder);
    if (list.length) void fileBatons(list, folder).catch(() => { status.hidden = false; status.textContent = 'Could not move these chats. Try again.'; });
  });
};
const folderRow = (folder: string, count: number) => {
  const row = document.createElement('button'); row.type = 'button'; row.className = 'folder-row'; row.dataset.folder = folder;
  const text = document.createElement('span'); const name = document.createElement('strong'); name.textContent = folder;
  const meta = document.createElement('small'); meta.textContent = count ? `${count} saved` : 'Empty · drag saved chats here';
  text.append(name, meta);
  row.insertAdjacentHTML('afterbegin', iconSvg('folder', 20)); row.append(text); row.insertAdjacentHTML('beforeend', iconSvg('chevron', 16));
  row.setAttribute('aria-label', `Open folder ${folder}, ${meta.textContent}`);
  row.addEventListener('click', () => { openFolder = folder; void showLibrary(); });
  dropTarget(row, folder); return row;
};
const folderCrumb = (folder: string, count: number) => {
  const bar = document.createElement('div'); bar.className = 'folder-crumb';
  const back = document.createElement('button'); back.type = 'button'; back.className = 'link-button folder-back'; back.innerHTML = iconSvg('back', 14);
  back.append('All batons'); back.title = 'Back to all saved chats. Drop one here to take it out of this folder.';
  back.addEventListener('click', () => { openFolder = undefined; void showLibrary(); });
  dropTarget(back, '');
  const name = document.createElement('strong'); name.insertAdjacentHTML('afterbegin', iconSvg('folder', 16)); name.append(folder);
  const meta = document.createElement('small'); meta.textContent = `${count} saved`;
  bar.append(back, name, meta); return bar;
};
const draggable = (row: HTMLElement, item: LibraryItem) => {
  row.draggable = true;
  row.addEventListener('dragstart', event => {
    const keys = selectingBatons && selectedBatons.has(batonKey(item)) ? [...selectedBatons] : [batonKey(item)];
    event.dataTransfer?.setData(dragType, JSON.stringify(keys)); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    row.classList.add('dragging'); document.body.classList.add('dragging-baton');
  });
  row.addEventListener('dragend', () => { row.classList.remove('dragging'); document.body.classList.remove('dragging-baton'); });
  return row;
};
// Wide screens (the side panel, opened wide) show All Batons as two panes, like Finder: folders on the left, batons on the right.
const wideLibrary = matchMedia('(min-width: 560px)');
wideLibrary.addEventListener('change', () => { void showLibrary(); });
const folderNav = document.querySelector('#folder-nav') as HTMLElement;
const navItem = (label: string, count: number, folder: string | undefined, icon: IconName) => {
  const item = document.createElement('button'); item.type = 'button'; item.className = 'folder-nav-item'; if (folder !== undefined) item.dataset.folder = folder;
  if (openFolder === folder) item.setAttribute('aria-current', 'true');
  const name = document.createElement('span'); name.textContent = label;
  const meta = document.createElement('small'); meta.textContent = String(count);
  item.insertAdjacentHTML('afterbegin', iconSvg(icon, 16)); item.append(name, meta);
  item.addEventListener('click', () => { openFolder = folder; void showLibrary(); });
  if (folder !== undefined) dropTarget(item, folder);
  return item;
};
// Home: a chip per folder above the latest batons. Drop a baton on a chip to file it; tap a chip to open the folder.
const folderChip = (folder: string, count: number) => {
  const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'folder-chip'; chip.dataset.folder = folder;
  const name = document.createElement('span'); name.textContent = folder; const meta = document.createElement('small'); meta.textContent = String(count);
  chip.insertAdjacentHTML('afterbegin', iconSvg('folder', 14)); chip.append(name, meta);
  chip.title = `Open ${folder}. Drop a saved chat here to file it.`;
  chip.addEventListener('click', () => { openFolder = folder; void showLibrary(); setView('saved'); });
  dropTarget(chip, folder); return chip;
};
const showLibrary = async () => {
  const projects = (await listProjects()).sort((a, b) => b.updatedAt - a.updatedAt);
  const recent = await listRecentCaptures(5000);
  const dismissed = (await chrome.storage.local.get('dismissedRecentUrls')).dismissedRecentUrls;
  const dismissedUrls: string[] = Array.isArray(dismissed) ? dismissed.filter((url): url is string => typeof url === 'string') : [];
  const items = [
    ...projects.map(project => ({ id: project.id, folder: project.folder, snapshotText: project.snapshotText, draftMode: project.draftMode, name: project.name, brief: project.brief, url: project.threads.at(-1) || '', variants: undefined as string[] | undefined, draft: project.draft, detail: `${project.folder ? `${project.folder} · ` : ''}${project.id.startsWith('selection:') ? 'Selected part of a chat' : `Project · ${project.threads.length} chat${project.threads.length === 1 ? '' : 's'}`}` })),
    ...recent.filter(capture => !dismissedUrls.includes(capture.url) && !projects.some(project => !project.id.startsWith('selection:') && project.threads.includes(capture.url))).map(capture => ({ id: '', folder: undefined as string | undefined, snapshotText: undefined, draftMode: undefined, name: capture.title, brief: capture.brief, url: capture.url, variants: capture.variants, draft: undefined, detail: `Recent chat · ${new Date(capture.savedAt).toLocaleString()}` }))
  ];
  libraryItems = items; libraryDismissed = dismissedUrls;
  for (const key of [...selectedBatons]) if (!items.some(item => batonKey(item) === key)) selectedBatons.delete(key);
  (document.querySelector('#saved-count') as HTMLElement).textContent = String(items.length);
  (document.querySelector('#chat-count') as HTMLElement).textContent = String(items.length);
  (document.querySelector('#thread-count') as HTMLElement).textContent = String(recent.length);
  const folders = await listFolders();
  (document.querySelector('#folder-count') as HTMLElement).textContent = String(folders.length);
  // “1 folder”, “2 folders”: the word after each count follows its number.
  for (const [id, one, many] of [['#chat-count', 'saved', 'saved'], ['#folder-count', 'folder', 'folders'], ['#thread-count', 'chat', 'chats']] as const) {
    const count = document.querySelector(id) as HTMLElement; const label = count.nextSibling;
    if (label?.nodeType === 3) label.textContent = ` ${count.textContent === '1' ? one : many}`;
  }
  const folderOptions = document.querySelector('#folder-options') as HTMLElement; folderOptions.replaceChildren();
  for (const folder of folders) { const option = document.createElement('option'); option.value = folder; folderOptions.append(option); }
  const recentList = document.querySelector('#recent-list') as HTMLElement; recentList.replaceChildren();
  (document.querySelector('#recent-empty') as HTMLElement).hidden = items.length > 0;
  const needle = librarySearch.value.trim().toLowerCase();
  const visible = items.filter(item => `${item.name} ${item.detail}`.toLowerCase().includes(needle));
  libraryList.replaceChildren();
  // Folders sit on top and open in place; unfiled batons follow. A search looks through every baton at once.
  const wide = wideLibrary.matches;
  if (openFolder && !folders.includes(openFolder)) openFolder = undefined;
  if (openFolder === '' && !wide) openFolder = undefined;
  const countIn = (folder: string) => items.filter(item => (item.folder || '') === folder).length;
  const inView = needle || (wide && openFolder === undefined) ? visible : visible.filter(item => (item.folder || '') === (openFolder || ''));
  shownItems = inView;
  folderNav.replaceChildren();
  if (wide) {
    folderNav.append(navItem('All batons', items.length, undefined, 'stack'), navItem('Not in a folder', countIn(''), '', 'tray'));
    const heading = document.createElement('p'); heading.className = 'folder-nav-heading'; heading.textContent = 'Folders'; folderNav.append(heading);
    for (const folder of folders) folderNav.append(navItem(folder, countIn(folder), folder, 'folder'));
    const add = document.createElement('button'); add.type = 'button'; add.className = 'folder-nav-item folder-nav-add'; add.insertAdjacentHTML('afterbegin', iconSvg('folderPlus', 16)); add.append('New folder');
    add.addEventListener('click', () => (document.querySelector('#new-folder') as HTMLButtonElement).click());
    folderNav.append(add);
  } else if (!needle && openFolder) libraryList.append(folderCrumb(openFolder, inView.length));
  else if (!needle) for (const folder of folders) libraryList.append(folderRow(folder, countIn(folder)));
  const homeFolders = document.querySelector('#home-folders') as HTMLElement; homeFolders.replaceChildren();
  for (const folder of folders) homeFolders.append(folderChip(folder, countIn(folder)));
  homeFolders.hidden = !folders.length || !items.length;
  const empty = document.querySelector('#library-empty') as HTMLElement;
  empty.hidden = inView.length > 0 || (!needle && !wide && !openFolder && folders.length > 0 && items.length > 0);
  empty.textContent = !items.length ? 'No saved chats yet. Capture a conversation to find it here.' : needle ? 'No saved chats match your search.' : openFolder === '' ? 'Every baton is in a folder.' : 'This folder is empty. Drag a baton onto it, or use Select → Move to folder.';
  for (const item of visible) {
    const button = document.createElement('button'); button.type = 'button';
    const title = document.createElement('strong'); title.textContent = item.name;
    const detail = document.createElement('small'); detail.textContent = item.detail;
    button.append(title, detail);
    button.addEventListener('click', async () => {
      currentBrief = item.brief; sourceUrl = item.url;
      reviewed = false; reviewPanel.open = false; flow.hidden = false;
      saveBrief.disabled = false;
      recommendation.textContent = 'Choose a service you use. Availability is checked there.';
      positiveFeedback.disabled = true; negativeFeedback.disabled = true;
      await refreshContext();
      if (item.snapshotText) {
        completeContext = { text: item.snapshotText, draft: wrapHandoff(item.snapshotText), tokens: encode(wrapHandoff(item.snapshotText)).length, redactions: [] };
        modeDrafts.full = completeContext.draft; contextMode.options[1].disabled = false; copyTranscript.disabled = false; downloadContext.disabled = false;
      }
      if (item.draft) {
        draft.value = item.draft;
        if (item.draftMode === 'full') {
          modeDrafts.full = item.draft; contextMode.options[1].disabled = false; contextMode.value = 'full'; previousMode = 'full';
          if (item.snapshotText) completeContext = { text: item.snapshotText, draft: item.draft, tokens: encode(item.draft).length, redactions: [] };
          copyTranscript.disabled = !item.snapshotText; downloadContext.disabled = !item.snapshotText;
          (document.querySelector('#capture-summary') as HTMLElement).textContent = 'Saved copy · later changes to the chat don’t change it';
        } else modeDrafts.compact = item.draft;
        showDraftBudget();
      }
      setView('capture');
      status.textContent = `Loaded ${item.name}. Review before continuing.`;
    });
    const card = () => {
      const row = document.createElement('div'); row.className = 'capsule-row'; row.dataset.key = batonKey(item);
      const pick = document.createElement('input'); pick.type = 'checkbox'; pick.className = 'pick'; pick.setAttribute('aria-label', `Select ${item.name}`);
      pick.addEventListener('change', () => toggleBaton(batonKey(item)));
      const laneHost = (() => { try { return new URL(item.url).hostname; } catch { return ''; } })();
      const laneId = providerIds.find(id => bundledSelectors.providers[id].hosts.includes(laneHost));
      if (laneId) row.style.setProperty('--lane', laneColors[laneId]);
      const open = button.cloneNode(true) as HTMLButtonElement; open.className = 'capsule-open'; open.addEventListener('click', () => { if (selectingBatons) toggleBaton(batonKey(item)); else button.click(); });
      const actions = document.createElement('div'); actions.className = 'capsule-actions';
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'icon-button'; copy.innerHTML = iconSvg('copy'); copy.title = 'Copy'; copy.setAttribute('aria-label', `Copy ${item.name}`);
      copy.addEventListener('click', async () => { await navigator.clipboard.writeText(redact(item.draft || wrapHandoff(renderBrief(item.brief).text)).text); status.hidden = false; status.textContent = 'Copied. Paste it into your next AI chat.'; });
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'icon-button danger'; remove.innerHTML = iconSvg('trash'); remove.title = 'Delete'; remove.setAttribute('aria-label', `Delete ${item.name}`);
      remove.addEventListener('click', () => askDelete([item]));
      const file = document.createElement('button'); file.type = 'button'; file.className = 'icon-button'; file.innerHTML = iconSvg('folderMove'); file.title = 'Move to folder'; file.setAttribute('aria-label', `Move ${item.name} to a folder`);
      file.addEventListener('click', () => { void askMove([item]); });
      actions.append(file, copy, remove); row.append(pick, open, actions); return row;
    };
    if (inView.includes(item)) libraryList.append(draggable(card(), item));
    if (recentList.children.length < 6 && !needle) recentList.append(draggable(card(), item));
  }
  updateBatonTools();
};
librarySearch.addEventListener('input', () => { void showLibrary(); });

void showLibrary();

const settings = await chrome.storage.local.get(['enabledProviders']);
const capsuleDialog = document.querySelector('#new-capsule-dialog') as HTMLDialogElement;
document.querySelector('#manual')?.addEventListener('click', () => { capsuleDialog.showModal(); (document.querySelector('#capsule-name') as HTMLInputElement).focus(); });
document.querySelector('#cancel-capsule')?.addEventListener('click', () => capsuleDialog.close());
capsuleDialog.querySelector('form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const name = (document.querySelector('#capsule-name') as HTMLInputElement).value.trim();
  const text = (document.querySelector('#capsule-content') as HTMLTextAreaElement).value.trim();
  const folder = (document.querySelector('#capsule-folder') as HTMLInputElement).value.trim();
  if (!name || !text) return;
  try {
    await saveProject({ id: crypto.randomUUID(), name, folder: folder || undefined, threads: [], updatedAt: Date.now(), draft: redact(text).text, draftMode: 'compact', brief: briefSchema.parse({ goal: name, status: 'User-written baton', next_step: 'Continue from the saved context.' }) });
    capsuleDialog.close(); capsuleDialog.querySelector('form')?.reset(); await showLibrary(); status.textContent = `Saved ${name}.`;
  } catch { (document.querySelector('#capsule-error') as HTMLElement).textContent = 'Could not save this. Your text is still here; try again.'; }
});
const enabled = (settings.enabledProviders && typeof settings.enabledProviders === 'object' ? settings.enabledProviders : {}) as Record<string, boolean>;
for (const option of Array.from(destination.options)) {
  const id = option.value;
  option.disabled = !providerEnabled(id as ProviderId, enabled);
}
destination.addEventListener('change', () => { recommendation.textContent = `Selected ${destination.selectedOptions[0].text}. Check availability in that service.`; showAccountHelp(); showDraftBudget(); });

captureButton.addEventListener('click', async () => {
  captureStarted = true;
  setView('capture');
  captureButton.disabled = true;
  flow.hidden = true;
  showDraftBudget();
  captureButton.textContent = includeOlder.checked ? 'Loading older messages…' : 'Capturing…';
  status.textContent = includeOlder.checked ? 'Collecting visible and older messages. Your chat will return to its place.' : 'Capturing visible messages…';
  try {
    const tab = await activeChatTab();
    if (!tab?.id) throw new Error('No active chat tab');
    const data = await sendToChat<any>(tab, { type: 'EXTRACT', includeOlder: includeOlder.checked });
    if (data?.error) throw new Error(data.error);
    if (!data?.turnCount && !data?.artifactCount) {
      status.textContent = 'Connected. This chat has no messages yet. Baton is watching from here; send a message, then save again.';
      return;
    }
    if (!data?.hasUserTurn && data?.provider === 'gemini' && tab.url && new URL(tab.url).pathname === '/app') {
      status.textContent = 'Connected to Gemini. No user message is visible yet. Baton is watching from here; send a message, then save again.';
      return;
    }
    if (!data?.hasUserTurn) throw new Error('The original user message was not captured. Try older-message capture, or paste your request into the draft yourself.');
    source = data.provider;
    sourceUrl = data.url;
    copyTranscript.disabled = data.archiveSaved === false;
    const brief = briefSchema.parse(data.brief);
    currentBrief = brief;
    saveBrief.disabled = false;
    const rendered = renderBrief(brief);
    draft.value = wrapHandoff(rendered.text);
    reviewed = false;
    reviewPanel.open = false;
    flow.hidden = false;
    await refreshContext();
    if (completeContext) {
      const archive = (await chrome.storage.local.get(`archive:brief:${sourceUrl}`))[`archive:brief:${sourceUrl}`] as TurnArchive | undefined;
      if (archive) {
        await saveCapturedCapsule(archive, brief, sourceUrl, tab.title || brief.goal);
        contextMode.value = 'full'; previousMode = 'full'; draft.value = modeDrafts.full; showDraftBudget();
      }
    }
    await showLibrary();
    const meter = data.meter as Meter;
    // Same suggestions as the Baton button: the task's topic, Baton's rankings list, your order and picks, then usage left.
    const asked = data.pendingPrompt || goalFromUserText(brief.last_exchange.user);
    // Keywords first; the on-device model only when they can't tell (it answers in well under a second once loaded).
    const guess = promptTopic(asked) === 'general' ? await Promise.race([chrome.runtime.sendMessage({ type: 'CLASSIFY', text: asked }).then(reply => reply?.ok ? reply.guess as ModelGuess : undefined, () => undefined), new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), 4000))]) : undefined;
    const suggestion = suggest(asked, source, await chrome.storage.local.get(suggestionKeys()), Date.now(), undefined, guess);
    currentTopic = suggestion.topic;
    intentLabel.textContent = `Task type: ${topicNames[suggestion.topic]}. Suggestions are approximate.`;
    const choices = suggestion.options.filter(option => option.status !== 'limited').map(option => ({ id: option.provider }));
    positiveFeedback.disabled = choices.length === 0;
    negativeFeedback.disabled = choices.length === 0;
    destination.value = choices[0]?.id || 'chatgpt';
    showAccountHelp();
    (document.querySelector('#same-ai-other') as HTMLElement).hidden = false;
    (document.querySelector('#same-ai-other-label') as HTMLElement).textContent = `Continue in ${providerNames[source as ProviderId] || 'this AI'} with another account`;
    recommendation.textContent = choices[0] ? `Suggested: ${destination.selectedOptions[0].text} for ${topicNames[currentTopic].toLowerCase()}. You can change this.` : 'No other service is enabled. You can copy the draft.';
    const visibleWarnings = [data.warning, ...rendered.receipt.warnings].filter(Boolean);
    status.textContent = `${data.turnCount} messages saved. ${visibleWarnings.length ? visibleWarnings.join(' ') : 'Review the draft before continuing.'}`;
    meterLabel.textContent = `Usage balance: ${meter.tier === 'banner' && meter.remainingPercent !== undefined ? `${meter.remainingPercent}% shown by ${source}` : meter.tier === 'banner' && meter.remainingTokens !== undefined ? `${meter.remainingTokens.toLocaleString()} tokens shown by ${source}` : meter.tier === 'banner' && meter.percent === 100 ? 'limit reached, shown by service' : 'unknown'}. ${meter.resetAt ? `Approximate reset: ${new Date(meter.resetAt).toLocaleString()}.` : 'Reset time unknown.'}`;
    receipt.textContent = `Brief: about ${rendered.receipt.approximateTokens} tokens. Dropped: ${rendered.receipt.dropped.join(', ') || 'none'}. Redactions: ${rendered.receipt.redactions.join(', ') || 'none'}. ${rendered.receipt.warnings.join(' ')}`;
    const promptTokens = encode(data.pendingPrompt || '').length;
    cost.textContent = promptTokens ? `Unsent prompt: about ${promptTokens} tokens. ${meter.estimatedReplyCost === undefined ? 'Share of remaining allowance unknown.' : `A rough reply may equal about ${meter.estimatedReplyCost}% of the token count in a past chat that showed a limit; actual allowance unknown.`} ${shouldNudge(meter) ? 'Consider preparing a brief before the limit.' : ''}` : 'No unsent prompt found. Reply cost is unknown.';
  } catch (error) { status.textContent = `Could not save this chat: ${String(error)}. You can write your own instead.`; }
  finally { captureButton.disabled = false; captureButton.textContent = 'Save this chat →'; showDraftBudget(); }
});

for (const [selector, positive] of [['#positive', true], ['#negative', false]] as const) document.querySelector(selector)?.addEventListener('click', async () => {
  const stored = await chrome.storage.local.get('taskPicks');
  await chrome.storage.local.set({ taskPicks: addPick(stored.taskPicks as TaskPicks | undefined, currentTopic, destination.value as ProviderId, positive ? 1 : -1) });
  status.textContent = 'Thanks. Baton will lean this way for this kind of task (saved on this device).';
});

document.querySelector('#save')?.addEventListener('click', async () => {
  const name = (document.querySelector('#project') as HTMLInputElement).value.trim();
  const folder = (document.querySelector('#folder') as HTMLInputElement).value.trim().slice(0, 80);
  if (!name || !draft.value.trim()) { status.textContent = 'Enter a name and some notes first.'; return; }
  const projects = await listProjects();
  const existing = projects.find(p => p.name.toLowerCase() === name.toLowerCase() && (p.folder || '').toLowerCase() === folder.toLowerCase());
  const captured = currentBrief || briefSchema.parse({ goal: name, status: 'User-written context. Review the saved draft.', next_step: 'Continue using the user-reviewed context.' });
  const brief = existing ? mergeBrief(existing.brief, captured) : captured;
  await saveProject({ id: existing?.id || crypto.randomUUID(), name, folder: folder || undefined, updatedAt: Date.now(), threads: [...new Set([...(existing?.threads || []), sourceUrl].filter(Boolean))], draft: redact(draft.value).text, draftMode: contextMode.value as 'full' | 'compact', ...(completeContext ? { snapshotText: completeContext.text } : existing?.snapshotText ? { snapshotText: existing.snapshotText } : {}), brief });
  status.textContent = `Saved brief to ${name}.`;
  await showLibrary();
});
document.querySelector('#recapture')?.addEventListener('click', () => captureButton.click());
document.querySelector('#manage-projects')?.addEventListener('click', () => { void chrome.runtime.openOptionsPage(); });
document.querySelector('#settings')?.addEventListener('click', () => { void chrome.runtime.openOptionsPage(); });

document.querySelector('#open')?.addEventListener('click', async () => {
  if (!reviewed) { reviewPanel.open = true; reviewPanel.scrollIntoView({ block: 'start' }); draft.focus(); return; }
  const safe = redact(draft.value);
  if (safe.text !== draft.value) { draft.value = safe.text; reviewed = false; reviewPanel.open = true; showDraftBudget(); status.textContent = 'Sensitive patterns were redacted. Review the updated draft before opening it.'; return; }
  const target = destination.value as ProviderId;
  // Any length: typed whole when it fits this AI's chat box; otherwise the summary is typed and all of it attached.
  const summary = modeDrafts.compact && modeDrafts.compact !== draft.value ? modeDrafts.compact : undefined;
  const fitted = fitToBox(draft.value, summary, target, { name: transcriptName('', currentBrief?.goal || ''), text: draft.value });
  // Copied first, so a page that doesn't take the text (or a sign-in screen) never loses the draft.
  await navigator.clipboard.writeText(draft.value).catch(() => {});
  const files = fitted.attach ? [textFile(fitted.attach.name, fitted.attach.text, 'text/markdown')] : [];
  const response = await chrome.runtime.sendMessage({ type: 'OPEN_DRAFT', url: urls[target], text: fitted.draft, files });
  status.textContent = !response?.ok ? 'Could not open destination. The draft is copied: paste it into any AI chat.'
    : fitted.attach ? `Opened ${providerNames[target]} with the summary typed and the whole draft attached as “${fitted.attach.name}”. Check it before sending; the whole draft is also copied.`
    : `Opened ${providerNames[target]}. Check the draft before sending; it is also copied, in case the page doesn't show it.`;
});
document.querySelector('#copy')?.addEventListener('click', async () => { const safe = redact(draft.value); draft.value = safe.text; showDraftBudget(); await navigator.clipboard.writeText(safe.text); status.textContent = safe.kinds.length ? 'Draft copied with sensitive patterns redacted.' : 'Draft copied.'; });
copyTranscript.addEventListener('click', async () => {
  if (!completeContext) return;
  await navigator.clipboard.writeText(completeContext.text);
  status.textContent = 'Whole chat copied. Passwords and keys are hidden. Check it before sharing.';
});
downloadContext.addEventListener('click', () => {
  if (!completeContext) return;
  const url = URL.createObjectURL(new Blob([completeContext.text], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'handoff-context.md'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = 'Chat downloaded as a Markdown file.';
});

document.querySelector('#view-all')?.addEventListener('click', () => setView('saved'));
const folderDialog = document.querySelector('#new-folder-dialog') as HTMLDialogElement;
const newFolderName = document.querySelector('#new-folder-name') as HTMLInputElement;
document.querySelector('#new-folder')?.addEventListener('click', () => { newFolderName.value = ''; folderDialog.showModal(); newFolderName.focus(); });
document.querySelector('#cancel-folder')?.addEventListener('click', () => folderDialog.close());
folderDialog.querySelector('form')?.addEventListener('submit', async event => {
  event.preventDefault();
  try { await createFolder(newFolderName.value); folderDialog.close(); status.textContent = 'Folder created. Press Select on your saved chats, then Move to folder.'; await showLibrary(); }
  catch (error) { newFolderName.setCustomValidity(String(error)); newFolderName.reportValidity(); }
});
newFolderName.addEventListener('input', () => newFolderName.setCustomValidity(''));
document.querySelector('#sidebar')?.addEventListener('click', async () => {
  try {
    if (!chrome.sidePanel?.open) throw new Error('Sidebar unavailable');
    if (activeWindowId === undefined) throw new Error('No active window');
    await chrome.sidePanel.open({ windowId: activeWindowId });
    window.close();
  } catch { status.textContent = 'This browser cannot open the sidebar here. Opening a full workspace instead.'; await chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') }); }
});
const accountDialog = document.querySelector('#account-dialog') as HTMLDialogElement;
let cloudReady = false;
const backupStatus = document.querySelector('#backup-status') as HTMLElement;
// Why the last Google sign-in failed, kept until the account dialog has shown it.
let signInError: string | undefined;
// The Google/Supabase setup panel and its detailed errors are for whoever runs the build (npm run dev), not for users.
const developerBuild = import.meta.env.DEV;
const googleSetup = document.querySelector('#google-setup') as HTMLDetailsElement;
googleSetup.hidden = !developerBuild;
async function refreshGoogleSetup() {
  if (!cloudReady || !cloudConfigured) return;
  const button = document.querySelector('#google-sign-in') as HTMLButtonElement;
  button.disabled = true;
  cloudStatus.textContent = developerBuild ? 'Checking Google sign-in setup…' : 'Checking Google backup…';
  try {
    const cloud = await import('../../src/core/cloud');
    const available = await cloud.googleSignInAvailable();
    button.disabled = !available;
    if (developerBuild) {
      const setup = cloud.googleOAuthSetup();
      (document.querySelector('#google-callback') as HTMLInputElement).value = setup.googleCallback;
      (document.querySelector('#extension-callback') as HTMLInputElement).value = setup.extensionCallback;
      googleSetup.open = !available || !!signInError;
      cloudStatus.textContent = available ? signInError || 'Google is enabled. Confirm the extension callback is allowlisted, then sign in.' : 'Enable Google in Supabase Authentication → Providers. Paste your Google client ID and secret there, then add the extension callback under URL Configuration. Local batons are already saved.';
    } else cloudStatus.textContent = available ? (signInError ? cloud.signInMessage(signInError, false) : 'Sign in with Google to back up your batons and restore them in another browser.') : cloud.backupUnavailable;
    signInError = undefined;
  } catch { button.disabled = false; cloudStatus.textContent = developerBuild ? 'Could not check Google setup. Try Check Google setup again. Local batons are safe.' : 'Couldn’t reach Google backup right now. Your batons are saved on this device; try again later.'; }
}
const openAccountDialog = () => { accountDialog.showModal(); void refreshGoogleSetup(); };
document.querySelector('#retry-google-setup')?.addEventListener('click', () => { void refreshGoogleSetup(); });
document.querySelector('#copy-extension-callback')?.addEventListener('click', async () => {
  try { const setup = (await import('../../src/core/cloud')).googleOAuthSetup(); await navigator.clipboard.writeText(setup.extensionCallback); cloudStatus.textContent = 'Extension callback copied. Add it to Supabase Authentication → URL Configuration → Redirect URLs.'; }
  catch { cloudStatus.textContent = 'Callback unavailable. Reload the configured Baton build and try again.'; }
});
document.querySelector('#open-google-provider')?.addEventListener('click', async () => { const setup = (await import('../../src/core/cloud')).googleOAuthSetup(); await chrome.tabs.create({ url: setup.providerSettings }); });
document.querySelector('#close-account')?.addEventListener('click', () => accountDialog.close());
document.querySelector('#backup-all')?.addEventListener('click', async () => {
  const { exportBackup } = await import('../../src/core/backup');
  const data = await exportBackup(await chrome.storage.local.get(null));
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `handoff-backup-${new Date().toISOString().slice(0,10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); backupStatus.textContent = 'Backup downloaded. It contains saved chat text; keep it private.';
});
(document.querySelector('#restore-all') as HTMLInputElement).addEventListener('change', async event => {
  try {
    const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
    if (file.size > 20000000) throw new Error('Backup exceeds 20 MB.');
    const { previewBackup, mergeBackup } = await import('../../src/core/backup');
    const incoming = await previewBackup(await file.text());
    if (!confirm(`Restore ${incoming.contexts} captured conversations and ${incoming.projects} projects? Newer local copies will be kept. Nothing is uploaded.`)) return;
    await chrome.storage.local.set(mergeBackup(await chrome.storage.local.get(null), incoming.data));
    backupStatus.textContent = 'Backup restored. Newer local items were kept.'; await showLibrary();
  } catch (error) { backupStatus.textContent = `Could not restore: ${String(error)}`; }
});

// On by default (user can switch off): opening Handoff refreshes usage pages, at most every 10 minutes (signed-out services never update).
const afterSend = document.querySelector('#refresh-after-send') as HTMLInputElement;
afterSend.checked = (await chrome.storage.local.get('refreshAfterSend')).refreshAfterSend !== false;
afterSend.addEventListener('change', () => { void chrome.storage.local.set({ refreshAfterSend: afterSend.checked }); });
// On by default: Baton's own usage requests with the user's sign-in (the page's own usage responses are read either way).
const usageApi = document.querySelector('#refresh-usage-api') as HTMLInputElement;
usageApi.checked = (await chrome.storage.local.get('usageApiRefresh')).usageApiRefresh !== false;
usageApi.addEventListener('change', () => { void chrome.storage.local.set({ usageApiRefresh: usageApi.checked }); });
const autoRefresh = document.querySelector('#auto-refresh-usage') as HTMLInputElement;
const autoSettings = await chrome.storage.local.get(['autoRefreshUsage', 'lastAutoUsageRefresh']);
autoRefresh.checked = autoSettings.autoRefreshUsage !== false;
autoRefresh.addEventListener('change', () => { void chrome.storage.local.set({ autoRefreshUsage: autoRefresh.checked }); });
if (autoRefresh.checked && Date.now() - (Number(autoSettings.lastAutoUsageRefresh) || 0) >= 600000) {
  void chrome.storage.local.set({ lastAutoUsageRefresh: Date.now() })
    .then(() => chrome.runtime.sendMessage({ type: 'REFRESH_ALL_USAGE' }))
    .then(() => showUsage()).catch(() => {});
}
const composerToggle = document.querySelector('#composer-usage') as HTMLInputElement;
composerToggle.checked = (await chrome.storage.local.get('composerUsageEnabled')).composerUsageEnabled !== false;
composerToggle.addEventListener('change', async () => { await chrome.storage.local.set({ composerUsageEnabled: composerToggle.checked }); });
document.querySelector('#send-feedback')?.addEventListener('click', () => { void chrome.tabs.create({ url: chrome.runtime.getURL('feedback.html') }); });
// Check-in after the 5th successful pass (then never again; “Later” waits 10 more passes). The answer is sent only on a tap.
const checkin = document.querySelector('#checkin') as HTMLElement;
const checkinState = await chrome.storage.local.get(['passCount', 'checkinDone', 'checkinAt']);
const passCount = Number(checkinState.passCount) || 0;
if (!checkinState.checkinDone && passCount >= (Number(checkinState.checkinAt) || 5)) {
  checkin.hidden = false;
  (document.querySelector('#checkin-sub') as HTMLElement).textContent = `You've passed ${passCount} batons.`;
}
const answerCheckin = async (up: boolean) => {
  await chrome.storage.local.set({ checkinDone: true });
  const { sendFeedback, browserName } = await import('../../src/core/feedback');
  void sendFeedback({ kind: 'checkin', reason: up ? 'up' : 'down', version: chrome.runtime.getManifest().version, browser: browserName(navigator.userAgent, 'brave' in navigator) });
  (document.querySelector('.checkin-row') as HTMLElement).hidden = true;
  const thanks = document.querySelector('#checkin-thanks') as HTMLElement; thanks.hidden = false;
  thanks.textContent = up ? 'Thank you! That helps a lot.' : 'Sorry about that. Tell us what went wrong and we\'ll fix it.';
  if (!up) void chrome.tabs.create({ url: chrome.runtime.getURL('feedback.html?kind=bug') });
};
document.querySelector('#checkin-up')?.addEventListener('click', () => { void answerCheckin(true); });
document.querySelector('#checkin-down')?.addEventListener('click', () => { void answerCheckin(false); });
document.querySelector('#checkin-later')?.addEventListener('click', () => { checkin.hidden = true; void chrome.storage.local.set({ checkinAt: passCount + 10 }); });
// Google Drive backup (Backups and data): shown once a Drive OAuth client is configured.
const { driveConfigured } = await import('../../src/core/drive');
const driveSection = document.querySelector('#drive-backup') as HTMLElement;
const driveStatus = document.querySelector('#drive-status') as HTMLElement;
driveSection.hidden = !driveConfigured;
const lastDrive = Number((await chrome.storage.local.get('lastDriveBackup')).lastDriveBackup) || 0;
if (driveConfigured && lastDrive) driveStatus.textContent = `Last backup to Google Drive: ${new Date(lastDrive).toLocaleString()}.`;
const driveCall = async (type: string) => {
  const reply = await chrome.runtime.sendMessage({ type }).catch(() => undefined) as { ok: boolean; result?: any; error?: string } | undefined;
  if (!reply?.ok) throw new Error(reply?.error || 'Google Drive did not respond. Try again.');
  return reply.result;
};
for (const [id, run] of [
  ['drive-backup-now', async () => driveCall('DRIVE_BACKUP') as Promise<string>],
  ['drive-restore', async () => {
    const preview = await driveCall('DRIVE_INSPECT') as { contexts: number; projects: number; updatedAt: string };
    if (!confirm(`Restore ${preview.contexts} conversations and ${preview.projects} projects from your Google Drive backup (${new Date(preview.updatedAt).toLocaleString()})? Newer copies on this device are kept.`)) return 'Restore cancelled.';
    const done = await driveCall('DRIVE_RESTORE') as string; await showLibrary(); return done;
  }],
  ['drive-disconnect', async () => { await driveCall('DRIVE_DISCONNECT'); return 'Google Drive disconnected on this device. Your backup file stays in Drive.'; }]
] as const) {
  const button = document.querySelector(`#${id}`) as HTMLButtonElement;
  button.addEventListener('click', async () => {
    button.disabled = true; driveStatus.textContent = 'Working…';
    try { driveStatus.textContent = await run(); } catch (error) { driveStatus.textContent = error instanceof Error ? error.message : 'Something went wrong. Try again.'; }
    finally { button.disabled = false; }
  });
}
// Help: the guide lives on the welcome page.
document.querySelector('#help')?.addEventListener('click', () => { void chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html#guide') }); });
// Keyboard shortcuts: the keys the browser assigned, changed on its own shortcuts page.
const shortcutList = document.querySelector('#shortcut-list') as HTMLElement | null;
if (shortcutList) void chrome.commands?.getAll().then(commands => fillShortcutList(shortcutList, commands, onMac(navigator))).catch(() => {});
document.querySelector('#change-shortcuts')?.addEventListener('click', () => { void chrome.tabs.create({ url: shortcutsPage }); });
// “Take the quick tour again”: it runs on the AI chat page, so queue it and tell the user where to look.
document.querySelector('#replay-tour')?.addEventListener('click', async event => {
  await chrome.storage.local.set({ tourReplay: true });
  (event.currentTarget as HTMLButtonElement).textContent = activeProvider ? `Starting on ${providerNames[activeProvider]}…` : 'Open any AI chat and the tour starts there.';
});
// Always-visible switches for what Baton adds to chat pages; the × on the bar and “Hide” in the Baton menu turn them off.
const chatSwitches = { composerUsageEnabled: document.querySelector('#toggle-bar') as HTMLInputElement | null, passButtonEnabled: document.querySelector('#toggle-pass') as HTMLInputElement | null, selectionButtonEnabled: document.querySelector('#toggle-selection') as HTMLInputElement | null, longChatTipEnabled: document.querySelector('#toggle-longchat') as HTMLInputElement | null };
const switchState = await chrome.storage.local.get(Object.keys(chatSwitches));
for (const [key, input] of Object.entries(chatSwitches)) {
  if (!input) continue;
  input.checked = switchState[key] !== false;
  input.addEventListener('change', () => { void chrome.storage.local.set({ [key]: input.checked }); });
}
composerToggle.addEventListener('change', () => { if (chatSwitches.composerUsageEnabled) chatSwitches.composerUsageEnabled.checked = composerToggle.checked; });
chrome.storage.onChanged.addListener(changes => {
  for (const [key, input] of Object.entries(chatSwitches)) if (changes[key] && input) input.checked = changes[key].newValue !== false;
  if (changes.composerUsageEnabled) composerToggle.checked = changes.composerUsageEnabled.newValue !== false;
});

const cloudStatus = document.querySelector('#cloud-status') as HTMLElement;
const { cloudConfigured, accountLabel } = await import('../../src/core/cloud');
cloudReady = true;
const cloudActions = document.querySelector('#cloud-actions') as HTMLElement;
cloudActions.hidden = !cloudConfigured;
cloudStatus.textContent = cloudConfigured ? 'Connect Google to back up saved contexts to your Baton cloud account. Uploads happen only when you press Back up now.' : developerBuild ? 'Google backup is waiting for your Supabase project setup. Local saving and full backup work without an account.' : 'Google backup isn’t available in this copy of Baton. Your batons are saved on this device, and Download full backup below works anytime.';
const cloudCard = document.querySelector('#cloud-card') as HTMLElement;
const cloudCardStatus = document.querySelector('#cloud-card-status') as HTMLElement;
const cloudCardAction = document.querySelector('#cloud-card-action') as HTMLButtonElement;
let cloudAccount: string | undefined;
// Sign-in sits on the dashboard and at the top of the account dialog, not behind a collapsed section.
async function showCloudAccount(label: string | undefined, message?: string) {
  cloudAccount = label;
  await showAccountButton(label);
  (document.querySelector('#google-sign-in') as HTMLElement).hidden = !!label;
  (document.querySelector('#cloud-connected-actions') as HTMLElement).hidden = !label;
  cloudCardAction.textContent = label ? 'Back up now' : 'Sign in with Google';
  const last = Number((await chrome.storage.local.get('lastCloudBackup')).lastCloudBackup) || 0;
  cloudCardStatus.textContent = message || (label ? `${label} · ${last ? `last backup ${new Date(last).toLocaleString()}` : 'not backed up yet'}` : 'Off · saved on this device only');
  if (label && !message) cloudStatus.textContent = `Connected as ${label}.`;
}
// Top-right account button: “Sign in” when signed out; your Google photo when signed in, with a menu to back up,
// switch account or sign out. Without a configured cloud it opens Backups (files on this device).
const accountButton = document.querySelector('#account') as HTMLButtonElement;
const accountMenu = document.querySelector('#account-menu') as HTMLElement;
const avatarInto = (element: HTMLElement, profile: { email?: string; name?: string; avatar?: string } | undefined) => {
  element.replaceChildren();
  if (profile?.avatar) { const image = document.createElement('img'); image.src = profile.avatar; image.alt = ''; image.referrerPolicy = 'no-referrer'; image.addEventListener('error', () => { element.textContent = (profile.name || profile.email || 'B').slice(0, 1).toUpperCase(); }); element.append(image); }
  else element.textContent = profile ? (profile.name || profile.email || 'B').slice(0, 1).toUpperCase() : 'G';
};
async function showAccountButton(label: string | undefined) {
  const profile = label ? await (await import('../../src/core/cloud')).accountProfile() : undefined;
  accountButton.classList.toggle('signed-in', !!label);
  avatarInto(document.querySelector('#account-avatar') as HTMLElement, label ? profile || { email: label } : undefined);
  (document.querySelector('#account-label') as HTMLElement).textContent = cloudConfigured ? 'Sign in' : 'Backups';
  accountButton.setAttribute('aria-label', label ? `Account: ${label}` : cloudConfigured ? 'Sign in with Google' : 'Backups');
  accountButton.setAttribute('aria-haspopup', label ? 'menu' : 'false');
  if (label) {
    avatarInto(document.querySelector('#account-menu-avatar') as HTMLElement, profile || { email: label });
    (document.querySelector('#account-menu-name') as HTMLElement).textContent = profile?.name || 'Signed in';
    (document.querySelector('#account-menu-email') as HTMLElement).textContent = profile?.email || label;
    const last = Number((await chrome.storage.local.get('lastCloudBackup')).lastCloudBackup) || 0;
    (document.querySelector('#account-menu-backup') as HTMLElement).textContent = last ? `Last backup ${new Date(last).toLocaleString()}` : 'Not backed up yet';
  } else closeAccountMenu();
}
const closeAccountMenu = () => { accountMenu.hidden = true; accountButton.setAttribute('aria-expanded', 'false'); };
accountButton.addEventListener('click', event => {
  event.stopPropagation();
  if (!cloudConfigured) { openAccountDialog(); return; }
  if (!cloudAccount) { (document.querySelector('#google-sign-in') as HTMLButtonElement).click(); return; }
  accountMenu.hidden = !accountMenu.hidden; accountButton.setAttribute('aria-expanded', String(!accountMenu.hidden));
  if (!accountMenu.hidden) (accountMenu.querySelector('button') as HTMLButtonElement | null)?.focus();
});
document.addEventListener('click', event => { if (!accountMenu.hidden && !accountMenu.contains(event.target as Node)) closeAccountMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !accountMenu.hidden) { closeAccountMenu(); accountButton.focus(); } });
for (const [id, target] of [['menu-backup', '#cloud-backup'], ['menu-signout', '#cloud-disconnect']] as const) document.querySelector(`#${id}`)?.addEventListener('click', () => { closeAccountMenu(); (document.querySelector(target) as HTMLButtonElement).click(); });
document.querySelector('#menu-backups')?.addEventListener('click', () => { closeAccountMenu(); openAccountDialog(); });
// Switch account: sign out here (local copies and the cloud backup stay), then Google's own account chooser.
document.querySelector('#menu-switch')?.addEventListener('click', async () => {
  closeAccountMenu();
  try { await (await import('../../src/core/cloud')).disconnectCloud(); await showCloudAccount(undefined); } catch { /* Sign-in below still offers the chooser. */ }
  (document.querySelector('#google-sign-in') as HTMLButtonElement).click();
});
cloudCard.hidden = !cloudConfigured;
await showAccountButton(undefined);
if (cloudConfigured) await showCloudAccount(await accountLabel());
// The toolbar popup closes when Google's window takes focus, so a sign-in that failed meanwhile is shown on the next open.
const storedSignInError = (await chrome.storage.session.get('cloudSignInError')).cloudSignInError as string | undefined;
if (storedSignInError) {
  await chrome.storage.session.remove('cloudSignInError');
  if (cloudConfigured && !cloudAccount) { signInError = storedSignInError; cloudCardStatus.textContent = (await import('../../src/core/cloud')).signInMessage(storedSignInError, developerBuild); openAccountDialog(); }
}
cloudCardAction.addEventListener('click', () => (document.querySelector(cloudAccount ? '#cloud-backup' : '#google-sign-in') as HTMLButtonElement).click());
for (const [id, action] of [
  ['google-sign-in', async () => { const result = await chrome.runtime.sendMessage({ type: 'CLOUD_SIGN_IN' }); if (!result?.ok) throw new Error(result?.error || 'Sign-in could not finish. Reopen Baton after authorization.'); await showCloudAccount(result.email, `${result.email} · not backed up yet`); return `Connected as ${result.email}. Nothing uploaded yet.`; }],
  ['cloud-backup', async () => { await (await import('../../src/core/cloud')).backupCloud(); await showCloudAccount(cloudAccount); return 'Saved chats backed up to your account.'; }],
  ['cloud-restore', async () => { const cloud = await import('../../src/core/cloud'); const preview = await cloud.inspectCloud(); if (!confirm(`Restore ${preview.contexts} conversations and ${preview.projects} projects from ${preview.updatedAt}? Newer local copies will be kept.`)) return 'Restore cancelled.'; await cloud.restoreCloud(preview); await showLibrary(); return 'Cloud backup restored.'; }],
  ['cloud-disconnect', async () => { await (await import('../../src/core/cloud')).disconnectCloud(); await showCloudAccount(undefined); return 'Disconnected. Local data and cloud backup were kept.'; }],
  ['cloud-delete', async () => { if (!confirm('Delete the cloud backup for this account? Local data will be kept.')) return 'Deletion cancelled.'; await (await import('../../src/core/cloud')).deleteCloudBackup(); return 'Cloud backup deleted. Local data kept.'; }]
] as const) {
  const button = document.querySelector(`#${id}`) as HTMLButtonElement;
  button.addEventListener('click', async () => {
    button.disabled = true; cloudCardAction.disabled = true; cloudStatus.textContent = 'Working…';
    try { cloudStatus.textContent = await action(); }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Could not complete the cloud action. Try again.';
      cloudStatus.textContent = cloudCardStatus.textContent = id === 'google-sign-in' ? (await import('../../src/core/cloud')).signInMessage(message, developerBuild) : message;
      // The top Sign in button starts this with the dialog closed; open it so the reason is visible.
      if (id === 'google-sign-in') { await chrome.storage.session.remove('cloudSignInError'); if (!accountDialog.open) { signInError = message; openAccountDialog(); } }
    }
    finally { button.disabled = false; cloudCardAction.disabled = false; }
  });
}

document.querySelector('#apply-next-task')?.addEventListener('click', () => {
  const task = (document.querySelector('#next-task') as HTMLInputElement).value.trim();
  if (!task) { status.textContent = 'Enter the task you want to continue with.'; return; }
  draft.value = `${draft.value}\n\nNext task from the user: ${redact(task).text}`;
  (document.querySelector('#summary-next') as HTMLElement).textContent = task;
  if (currentBrief) currentBrief = { ...currentBrief, next_step: task };
  reviewed = false; showDraftBudget();
  status.textContent = 'Next step added. Review the updated draft before continuing.';
});
