import { renderBrief, wrapHandoff, draftBudget, redact } from '../../src/core/brief';
import { shouldNudge, type Meter } from '../../src/core/limits';
import { encode } from 'gpt-tokenizer';
import { rankProviders, trainClassifier, providerTable, type Feedback, type Intent } from '../../src/core/router';
import { providerIds, type ProviderId } from '../../src/core/selectors';
import { listProjects, mergeBrief, pruneExpired, saveProject, deleteProject, listFolders, createFolder } from '../../src/core/projects';
import { briefSchema, type Brief } from '../../src/core/brief';
import type { TurnArchive } from '../../src/core/capture';
import { isCurrentReading, isUsagePageUrl, usagePageUrl, windowLabel, type UsageWindow } from '../../src/core/usage-windows';
import { displayLabel, displayWindows, type DisplayWindow, type UsageHistory } from '../../src/core/usage-estimate';
import { meterSummary } from '../../src/core/usage-alerts';
import { isSupportedChatUrl, sendWithBootstrap } from '../../src/core/connection';
import { listRecentCaptures } from '../../src/core/recent';
import { saveCapturedCapsule } from '../../src/core/capsules';
import { fullContext } from '../../src/core/context-export';
import { createActiveChatTracker } from '../../src/core/active-chat';

const status = document.querySelector('#status') as HTMLElement;
(document.querySelector('#build-version') as HTMLElement).textContent = `v${chrome.runtime.getManifest().version}`;
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
document.querySelector('#tab-capture')?.addEventListener('click', () => { flow.hidden = true; captureCard.hidden = false;  setView('capture'); status.textContent = 'Capture a chat or create a new context.'; });
document.querySelector('#tab-saved')?.addEventListener('click', () => setView('saved'));
const activeChatTab = async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
const sendToChat = async <T>(tab: { id?: number; url?: string }, message: unknown): Promise<T> => sendWithBootstrap(
  tab, message,
  (id, payload) => chrome.tabs.sendMessage(id, payload) as Promise<T>,
  async id => {
    const script = chrome.runtime.getManifest().content_scripts?.[0]?.js?.[0];
    if (!script) throw new Error('Handoff content script is missing from this build.');
    await chrome.scripting.executeScript({ target: { tabId: id }, files: [script] });
  }
);
let activeProvider: ProviderId | undefined;
let captureStarted = false;
let activeWindowId: number | undefined;
const refreshActiveChat = createActiveChatTracker(activeChatTab, tab => sendToChat(tab, { type: 'PING' }), (tab, provider) => {
  activeWindowId = tab?.windowId;
  activeProvider = provider;
  void showUsage();
// Opening Handoff acknowledges a reset reminder's toolbar mark.
void chrome.action.getBadgeText({}).then(text => { if (text === '✓') return chrome.action.setBadgeText({ text: '' }); }).catch(() => {});
  if (!captureStarted) {
    status.textContent = provider ? '' : isSupportedChatUrl(tab?.url) ? 'Connecting to your AI chat…' : 'Open an AI chat to get started.';
    (document.querySelector('#source-label') as HTMLElement).textContent = provider ? `${providerNames[provider]} · active tab` : 'Open a supported AI conversation';
  }
}, () => { if (!captureStarted) status.textContent = 'Could not connect yet. Try Capture Page or paste a capsule.'; });
const refreshChat = () => { void refreshActiveChat().catch(() => { /* Capture provides recovery guidance. */ }); };
refreshChat();
chrome.tabs.onActivated?.addListener(info => { if (activeWindowId === undefined || info.windowId === activeWindowId) refreshChat(); });
chrome.tabs.onUpdated?.addListener((_id, change, tab) => {
  if (tab.active && (activeWindowId === undefined || tab.windowId === activeWindowId) && (change.url || change.status === 'complete')) refreshChat();
});
const usageDialog = document.querySelector('#usage-dialog') as HTMLDialogElement;
document.querySelector('#show-usage')?.addEventListener('click', () => { usageDialog.showModal(); void showUsage(); });
document.querySelector('#close-usage')?.addEventListener('click', () => usageDialog.close());
// Shared by the Usage window's Refresh all and the dashboard's Refresh usage button.
async function refreshAllUsage(button: HTMLButtonElement, message: HTMLElement) {
  button.disabled = true; message.textContent = 'Checking open AI tabs and each service’s usage page…';
  try {
    const tabs = (await chrome.tabs.query({})).filter(tab => isSupportedChatUrl(tab.url));
    const results = await Promise.allSettled(tabs.map(tab => sendToChat<{ ok?: boolean }>(tab, { type: 'REFRESH_USAGE' })));
    const connected = results.filter(result => result.status === 'fulfilled' && result.value?.ok).length;
    const pages = await chrome.runtime.sendMessage({ type: 'REFRESH_ALL_USAGE' }) as { ok?: boolean; results?: { provider: ProviderId; status: string }[] } | undefined;
    await showUsage();
    const pageSummary = (pages?.results || []).map(result => `${providerNames[result.provider]} ${result.status === 'read' ? 'read' : 'not shown (signed out or page changed)'}`).join(', ');
    message.textContent = `${tabs.length ? `Checked ${connected} of ${tabs.length} open AI tabs. ` : ''}${pageSummary ? `Usage pages: ${pageSummary}.` : 'No usage pages to check.'} Services without a usage page update when they show a limit.`;
  } catch { message.textContent = 'Could not refresh. Try again.'; }
  finally { button.disabled = false; }
}
for (const [buttonId, statusId] of [['#refresh-all-usage', '#usage-refresh-status'], ['#dashboard-refresh-usage', '#dashboard-refresh-status']]) {
  const button = document.querySelector(buttonId) as HTMLButtonElement | null;
  button?.addEventListener('click', () => { void refreshAllUsage(button, document.querySelector(statusId) as HTMLElement); });
}
window.setInterval(() => { void showUsage(); }, 60000);
const providerNames: Record<ProviderId, string> = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', deepseek: 'DeepSeek', grok: 'Grok', perplexity: 'Perplexity' };
// Official readings plus, for windows chat draws from, an estimate moved forward by messages sent since.
const shownWindows = (saved: Record<string, any>, id: ProviderId): DisplayWindow[] => displayWindows((saved[`usageWindows:${id}`] || []) as UsageWindow[], (saved[`usageHistory:${id}`] || {}) as UsageHistory, (saved[`usageSends:${id}`] || []) as number[]);
async function showUsage() {
  const saved = await chrome.storage.local.get(providerIds.flatMap(id => [`meter:${id}`, `usageWindows:${id}`, `usageHistory:${id}`, `usageSends:${id}`]));
  usageList.replaceChildren();
  renderActiveUsage(saved);
  for (const id of providerIds) {
    const row = document.createElement('div'); row.className = 'usage-row';
    const name = document.createElement('strong'); name.textContent = providerNames[id];
    const value = document.createElement('span'); value.textContent = meterSummary(saved[`meter:${id}`] as Meter | undefined);
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
function renderActiveUsage(saved: Record<string, any>) {
  const card = document.querySelector('#active-usage') as HTMLElement;
  card.hidden = !activeProvider;
  if (!activeProvider) return;
  (document.querySelector('#active-usage-title') as HTMLElement).textContent = `${providerNames[activeProvider]} usage`;
  const container = document.querySelector('#active-usage-values') as HTMLElement;
  const note = document.querySelector('#active-usage-note') as HTMLElement;
  const windows = shownWindows(saved, activeProvider);
  const meter = saved[`meter:${activeProvider}`] as Meter | undefined;
  const readings = windows.length ? windows : isCurrentReading(meter) && (meter.percent !== undefined || meter.remainingTokens !== undefined) ? [meter] : [];
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
  if (!readings.length) { const empty = document.createElement('p'); empty.className = 'usage-unavailable'; empty.textContent = 'No percentage shared on this page'; container.append(empty); }
  note.textContent = readings.length ? `${readings.some(reading => (reading as DisplayWindow).estimate) ? 'Last service reading' : 'Service reading'} · ${new Date(Math.min(...readings.map(reading => reading.at!))).toLocaleTimeString()}.${readings.some(reading => (reading as DisplayWindow).estimate) ? ' Values marked ≈ are estimated from messages you sent since.' : ''} Refresh to check again.` : activeProvider === 'claude' ? 'Read Claude’s usage page to connect available session and weekly figures. Free accounts may not expose them.' : activeProvider === 'gemini' ? 'Read Gemini’s Usage limits page to show its 5-hour and weekly figures.' : activeProvider === 'chatgpt' ? 'Read ChatGPT’s Usage page for Codex and Work limits and credits. Chat itself has no usage page; Handoff shows chat limits when ChatGPT reports one.' : 'Usage will appear when the service displays a limit. Prompt tokens do not measure your remaining allowance.';
  (document.querySelector('#read-active-usage') as HTMLButtonElement).textContent = usagePageUrl(activeProvider) ? 'Read usage ↗' : 'Refresh';
}
document.querySelector('#read-active-usage')?.addEventListener('click', () => { void readVisibleUsage(); });
for (const provider of ['claude', 'gemini', 'chatgpt'] as const) document.querySelector(`#check-${provider}-usage`)?.addEventListener('click', () => { void chrome.tabs.create({ url: usagePageUrl(provider)! }); });
chrome.storage.onChanged.addListener(changes => { if (providerIds.some(id => changes[`meter:${id}`] || changes[`usageWindows:${id}`] || changes[`usageSends:${id}`] || changes[`usageHistory:${id}`])) void showUsage(); });
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
  const budget = draftBudget(draft.value);
  (document.querySelector('#use-compact') as HTMLButtonElement).hidden = budget.fits || contextMode.value !== 'full';
  saveBrief.disabled = !draft.value.trim();
  openDraft.disabled = !draft.value.trim() || (reviewed && !budget.fits);
  openDraft.textContent = reviewed ? 'Open draft in new chat ↗' : 'Review & continue ↗';
  captureCard.hidden = !flow.hidden;
  (document.querySelector('#tab-capture') as HTMLElement).hidden = flow.hidden && activeView === 'capture';
  destinationPanel.hidden = !reviewed;
  actionBar.hidden = activeView !== 'capture' || flow.hidden;
  (document.querySelector('#idle-footer') as HTMLElement).hidden = !actionBar.hidden;
  copyDraft.disabled = !draft.value.trim();
  draftBudgetLabel.dataset.state = !draft.value.trim() ? 'empty' : budget.fits ? 'ready' : 'over';
  draft.setAttribute('aria-invalid', draft.value.trim() && !budget.fits ? 'true' : 'false');
  draftBudgetLabel.textContent = draft.value.trim() ? `Whole draft: about ${budget.approximateTokens}/1,500 tokens. ${budget.fits ? 'Ready for review.' : 'Copy or download the full context, or choose a compact handoff for insertion.'}` : 'Draft is empty.';
  draftPreview.textContent = !draft.value.trim() ? 'Paste a brief to continue.' : !budget.fits ? 'All captured text is retained. This is too long for automatic insertion; copy or download it, or choose the compact handoff.' : reviewed ? 'Draft ready. You can open it in a new chat.' : 'Draft ready. Open it below to review before continuing.';
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
let currentIntent: Intent = 'planning';

const refreshContext = async () => {
  const archive = sourceUrl ? (await chrome.storage.local.get(`archive:brief:${sourceUrl}`))[`archive:brief:${sourceUrl}`] as TurnArchive | undefined : undefined;
  completeContext = archive?.turns.length ? fullContext(archive, sourceUrl) : undefined;
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
    ? `${archive.turns.length} messages saved · ${archive.truncated ? 'earlier text trimmed at storage cap' : archive.incomplete ? 'possible gaps — review full text' : 'rendered text only'}`
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
document.querySelector('#use-compact')?.addEventListener('click', () => { contextMode.value = 'compact'; contextMode.dispatchEvent(new Event('change')); status.textContent = 'Compact handoff selected. The full capsule is still saved.'; });
const showLibrary = async () => {
  const projects = (await listProjects()).sort((a, b) => b.updatedAt - a.updatedAt);
  const recent = await listRecentCaptures(5000);
  const dismissed = (await chrome.storage.local.get('dismissedRecentUrls')).dismissedRecentUrls;
  const dismissedUrls: string[] = Array.isArray(dismissed) ? dismissed.filter((url): url is string => typeof url === 'string') : [];
  const items = [
    ...projects.map(project => ({ id: project.id, snapshotText: project.snapshotText, draftMode: project.draftMode, name: project.name, brief: project.brief, url: project.threads.at(-1) || '', draft: project.draft, detail: `${project.folder ? `${project.folder} · ` : ''}Project · ${project.threads.length} chat${project.threads.length === 1 ? '' : 's'}` })),
    ...recent.filter(capture => !dismissedUrls.includes(capture.url) && !projects.some(project => project.threads.includes(capture.url))).map(capture => ({ id: '', snapshotText: undefined, draftMode: undefined, name: capture.title, brief: capture.brief, url: capture.url, draft: undefined, detail: `Recent chat · ${new Date(capture.savedAt).toLocaleString()}` }))
  ];
  (document.querySelector('#saved-count') as HTMLElement).textContent = String(items.length);
  (document.querySelector('#chat-count') as HTMLElement).textContent = String(items.length);
  (document.querySelector('#thread-count') as HTMLElement).textContent = String(recent.length);
  const folders = await listFolders();
  (document.querySelector('#folder-count') as HTMLElement).textContent = String(folders.length);
  const folderOptions = document.querySelector('#folder-options') as HTMLElement; folderOptions.replaceChildren();
  for (const folder of folders) { const option = document.createElement('option'); option.value = folder; folderOptions.append(option); }
  const recentList = document.querySelector('#recent-list') as HTMLElement; recentList.replaceChildren();
  (document.querySelector('#recent-empty') as HTMLElement).hidden = items.length > 0;
  const needle = librarySearch.value.trim().toLowerCase();
  const visible = items.filter(item => `${item.name} ${item.detail}`.toLowerCase().includes(needle));
  libraryList.replaceChildren();
  const empty = document.querySelector('#library-empty') as HTMLElement;
  empty.hidden = visible.length > 0;
  empty.textContent = items.length ? 'No saved chats match your search.' : 'No saved chats yet. Capture a conversation to find it here.';
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
          (document.querySelector('#capture-summary') as HTMLElement).textContent = 'Saved capsule snapshot · later chat updates do not overwrite this copy';
        } else modeDrafts.compact = item.draft;
        showDraftBudget();
      }
      setView('capture');
      status.textContent = `Loaded ${item.name}. Review before continuing.`;
    });
    const card = () => {
      const row = document.createElement('div'); row.className = 'capsule-row';
      const open = button.cloneNode(true) as HTMLButtonElement; open.className = 'capsule-open'; open.addEventListener('click', () => button.click());
      const actions = document.createElement('div'); actions.className = 'capsule-actions';
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'icon-button'; copy.textContent = '⧉'; copy.setAttribute('aria-label', `Copy ${item.name}`);
      copy.addEventListener('click', async () => { await navigator.clipboard.writeText(redact(item.draft || wrapHandoff(renderBrief(item.brief).text)).text); status.hidden = false; status.textContent = 'Capsule copied. Paste it into your next AI chat.'; });
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'icon-button danger'; remove.textContent = '×'; remove.setAttribute('aria-label', `Delete ${item.name}`);
      remove.addEventListener('click', async () => {
        if (!confirm(`Delete “${item.name}”? Other saved capsules and conversations are kept.`)) return;
        if (item.id) {
          await deleteProject(item.id);
          if (item.id.startsWith('capture:')) await chrome.storage.local.set({ dismissedRecentUrls: [...new Set([...dismissedUrls, item.url])].slice(-5000) });
        }
        else await chrome.storage.local.remove([`brief:${item.url}`, `savedAt:brief:${item.url}`, `archive:brief:${item.url}`, `visibleTurnsHighWater:brief:${item.url}`]);
        await showLibrary();
      });
      actions.append(copy, remove); row.append(open, actions); return row;
    };
    libraryList.append(card());
    if (recentList.children.length < 6 && !needle) recentList.append(card());
  }
};
librarySearch.addEventListener('input', () => { void showLibrary(); });

void showLibrary();

const settings = await chrome.storage.local.get(['enabledProviders', 'providerIntents', 'routerFeedback']);
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
    await saveProject({ id: crypto.randomUUID(), name, folder: folder || undefined, threads: [], updatedAt: Date.now(), draft: redact(text).text, draftMode: 'compact', brief: briefSchema.parse({ goal: name, status: 'User-written capsule', next_step: 'Continue from the saved context.' }) });
    capsuleDialog.close(); capsuleDialog.querySelector('form')?.reset(); await showLibrary(); status.textContent = `Saved ${name}.`;
  } catch { (document.querySelector('#capsule-error') as HTMLElement).textContent = 'Could not save this capsule. Your text is still here; try again.'; }
});
const enabled = (settings.enabledProviders && typeof settings.enabledProviders === 'object' ? settings.enabledProviders : {}) as Record<string, boolean>;
const providerIntents = (settings.providerIntents && typeof settings.providerIntents === 'object' ? settings.providerIntents : {}) as Record<string, Intent[]>;
let feedback = Array.isArray(settings.routerFeedback) ? settings.routerFeedback as Feedback[] : [];
for (const option of Array.from(destination.options)) {
  const id = option.value;
  option.disabled = enabled[id] === false || (enabled[id] === undefined && ['grok', 'perplexity', 'deepseek'].includes(id));
}
destination.addEventListener('change', () => { recommendation.textContent = `Selected ${destination.selectedOptions[0].text}. Check availability in that service.`; showAccountHelp(); });

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
      status.textContent = 'Connected. This chat has no messages yet. Handoff is watching from here; send a message, then capture again.';
      return;
    }
    if (!data?.hasUserTurn && data?.provider === 'gemini' && tab.url && new URL(tab.url).pathname === '/app') {
      status.textContent = 'Connected to Gemini. No user message is visible yet. Handoff is watching from here; send a message, then capture again.';
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
    const intent = trainClassifier()(data.pendingPrompt || brief.last_exchange.user);
    currentIntent = intent;
    intentLabel.textContent = `Task type: ${intent}. Suggestions are approximate.`;
    const table = providerTable.map(p => ({ ...p, enabled: enabled[p.id] ?? p.enabled, intents: providerIntents[p.id] ?? p.intents }));
    const savedMeters = await chrome.storage.local.get(providerIds.map(id => `meter:${id}`));
    const meters: Partial<Record<ProviderId, Meter>> = {};
    for (const id of providerIds) {
      const observed = savedMeters[`meter:${id}`] as (Meter & { at?: number }) | undefined;
      const age = Date.now() - Number(observed?.at);
      if (observed && Number.isFinite(age) && age >= 0 && age < 3600000 && observed.provider === id) meters[id] = observed;
    }
    const choices = rankProviders(intent, source, table, meters, feedback);
    positiveFeedback.disabled = choices.length === 0;
    negativeFeedback.disabled = choices.length === 0;
    destination.value = choices[0]?.id || 'chatgpt';
    showAccountHelp();
    recommendation.textContent = choices[0] ? `Suggested: ${destination.selectedOptions[0].text} for ${intent}. You can change this.` : 'No other service is enabled. You can copy the draft.';
    const visibleWarnings = [data.warning, ...rendered.receipt.warnings].filter(Boolean);
    status.textContent = `${data.turnCount} visible messages captured. ${visibleWarnings.length ? visibleWarnings.join(' ') : 'Review the draft before continuing.'}`;
    meterLabel.textContent = `Usage balance: ${meter.tier === 'banner' && meter.remainingPercent !== undefined ? `${meter.remainingPercent}% shown by ${source}` : meter.tier === 'banner' && meter.remainingTokens !== undefined ? `${meter.remainingTokens.toLocaleString()} tokens shown by ${source}` : meter.tier === 'banner' && meter.percent === 100 ? 'limit reached, shown by service' : 'unknown'}. ${meter.resetAt ? `Approximate reset: ${new Date(meter.resetAt).toLocaleString()}.` : 'Reset time unknown.'}`;
    receipt.textContent = `Brief: about ${rendered.receipt.approximateTokens} tokens. Dropped: ${rendered.receipt.dropped.join(', ') || 'none'}. Redactions: ${rendered.receipt.redactions.join(', ') || 'none'}. ${rendered.receipt.warnings.join(' ')}`;
    const promptTokens = encode(data.pendingPrompt || '').length;
    cost.textContent = promptTokens ? `Unsent prompt: about ${promptTokens} tokens. ${meter.estimatedReplyCost === undefined ? 'Share of remaining allowance unknown.' : `A rough reply may equal about ${meter.estimatedReplyCost}% of the token count in a past chat that showed a limit; actual allowance unknown.`} ${shouldNudge(meter) ? 'Consider preparing a brief before the limit.' : ''}` : 'No unsent prompt found. Reply cost is unknown.';
  } catch (error) { status.textContent = `Capture failed: ${String(error)}. You can paste a brief instead.`; }
  finally { captureButton.disabled = false; captureButton.textContent = '✧ Capture Page'; showDraftBudget(); }
});

for (const [selector, positive] of [['#positive', true], ['#negative', false]] as const) document.querySelector(selector)?.addEventListener('click', async () => {
  feedback = [...feedback, { intent: currentIntent, provider: destination.value as ProviderId, positive }];
  await chrome.storage.local.set({ routerFeedback: feedback });
  status.textContent = 'Recommendation feedback saved locally.';
});

document.querySelector('#save')?.addEventListener('click', async () => {
  const name = (document.querySelector('#project') as HTMLInputElement).value.trim();
  const folder = (document.querySelector('#folder') as HTMLInputElement).value.trim().slice(0, 80);
  if (!name || !draft.value.trim()) { status.textContent = 'Enter a project name and some context first.'; return; }
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
  if (!draftBudget(draft.value).fits) { status.textContent = 'Shorten the reviewed draft to 1,500 approximate tokens before opening a destination.'; return; }
  const target = destination.value as ProviderId;
  const response = await chrome.runtime.sendMessage({ type: 'OPEN_DRAFT', url: urls[target], text: draft.value });
  status.textContent = response?.ok ? `Opened ${target}. Check the destination editor before sending.` : 'Could not open destination.';
});
document.querySelector('#copy')?.addEventListener('click', async () => { const safe = redact(draft.value); draft.value = safe.text; showDraftBudget(); await navigator.clipboard.writeText(safe.text); status.textContent = safe.kinds.length ? 'Draft copied with sensitive patterns redacted.' : 'Draft copied.'; });
copyTranscript.addEventListener('click', async () => {
  if (!completeContext) return;
  await navigator.clipboard.writeText(completeContext.text);
  status.textContent = 'Full captured text copied, with secret redaction. Review it before sharing.';
});
downloadContext.addEventListener('click', () => {
  if (!completeContext) return;
  const url = URL.createObjectURL(new Blob([completeContext.text], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'handoff-context.md'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = 'Captured context downloaded as Markdown.';
});

document.querySelector('#view-all')?.addEventListener('click', () => setView('saved'));
const folderDialog = document.querySelector('#new-folder-dialog') as HTMLDialogElement;
const newFolderName = document.querySelector('#new-folder-name') as HTMLInputElement;
document.querySelector('#new-folder')?.addEventListener('click', () => { newFolderName.value = ''; folderDialog.showModal(); newFolderName.focus(); });
document.querySelector('#cancel-folder')?.addEventListener('click', () => folderDialog.close());
folderDialog.querySelector('form')?.addEventListener('submit', async event => {
  event.preventDefault();
  try { await createFolder(newFolderName.value); folderDialog.close(); status.textContent = 'Folder created. Choose it when saving a project.'; await showLibrary(); }
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
async function refreshGoogleSetup() {
  if (!cloudReady || !cloudConfigured) return;
  const button = document.querySelector('#google-sign-in') as HTMLButtonElement;
  button.disabled = true;
  cloudStatus.textContent = 'Checking Google sign-in setup…';
  try {
    const cloud = await import('../../src/core/cloud');
    const setup = cloud.googleOAuthSetup();
    (document.querySelector('#google-callback') as HTMLInputElement).value = setup.googleCallback;
    (document.querySelector('#extension-callback') as HTMLInputElement).value = setup.extensionCallback;
    const available = await cloud.googleSignInAvailable();
    button.disabled = !available;
    (document.querySelector('#google-setup') as HTMLDetailsElement).open = !available;
    cloudStatus.textContent = available ? 'Google is enabled. Confirm the extension callback is allowlisted, then sign in.' : 'Enable Google in Supabase Authentication → Providers. Paste your Google client ID and secret there, then add the extension callback under URL Configuration. Local capsules are already saved.';
  } catch { button.disabled = false; cloudStatus.textContent = 'Could not check Google setup. Try Check Google setup again. Local capsules are safe.'; }
}
document.querySelector('#account')?.addEventListener('click', () => { accountDialog.showModal(); void refreshGoogleSetup(); });
document.querySelector('#retry-google-setup')?.addEventListener('click', () => { void refreshGoogleSetup(); });
document.querySelector('#copy-extension-callback')?.addEventListener('click', async () => {
  try { const setup = (await import('../../src/core/cloud')).googleOAuthSetup(); await navigator.clipboard.writeText(setup.extensionCallback); cloudStatus.textContent = 'Extension callback copied. Add it to Supabase Authentication → URL Configuration → Redirect URLs.'; }
  catch { cloudStatus.textContent = 'Callback unavailable. Reload the configured Handoff build and try again.'; }
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

const cloudStatus = document.querySelector('#cloud-status') as HTMLElement;
const { cloudConfigured, accountLabel } = await import('../../src/core/cloud');
cloudReady = true;
const cloudActions = document.querySelector('#cloud-actions') as HTMLElement;
cloudActions.hidden = !cloudConfigured;
cloudStatus.textContent = cloudConfigured ? 'Connect Google to back up saved contexts to your Handoff cloud account. Uploads happen only when you press Back up now.' : 'Google backup is waiting for your Supabase project setup. Local saving and full backup work without an account.';
const cloudCard = document.querySelector('#cloud-card') as HTMLElement;
const cloudCardStatus = document.querySelector('#cloud-card-status') as HTMLElement;
const cloudCardAction = document.querySelector('#cloud-card-action') as HTMLButtonElement;
let cloudAccount: string | undefined;
// Sign-in sits on the dashboard and at the top of the account dialog, not behind a collapsed section.
async function showCloudAccount(label: string | undefined, message?: string) {
  cloudAccount = label;
  (document.querySelector('#account') as HTMLElement).textContent = label ? 'Connected' : 'Local';
  (document.querySelector('#google-sign-in') as HTMLElement).hidden = !!label;
  (document.querySelector('#cloud-connected-actions') as HTMLElement).hidden = !label;
  cloudCardAction.textContent = label ? 'Back up now' : 'Sign in with Google';
  const last = Number((await chrome.storage.local.get('lastCloudBackup')).lastCloudBackup) || 0;
  cloudCardStatus.textContent = message || (label ? `${label} · ${last ? `last backup ${new Date(last).toLocaleString()}` : 'not backed up yet'}` : 'Off · saved on this device only');
  if (label && !message) cloudStatus.textContent = `Connected as ${label}.`;
}
cloudCard.hidden = !cloudConfigured;
if (cloudConfigured) await showCloudAccount(await accountLabel());
cloudCardAction.addEventListener('click', () => (document.querySelector(cloudAccount ? '#cloud-backup' : '#google-sign-in') as HTMLButtonElement).click());
for (const [id, action] of [
  ['google-sign-in', async () => { const result = await chrome.runtime.sendMessage({ type: 'CLOUD_SIGN_IN' }); if (!result?.ok) throw new Error(result?.error || 'Sign-in could not finish. Reopen Handoff after authorization.'); await showCloudAccount(result.email, `${result.email} · not backed up yet`); return `Connected as ${result.email}. Nothing uploaded yet.`; }],
  ['cloud-backup', async () => { await (await import('../../src/core/cloud')).backupCloud(); await showCloudAccount(cloudAccount); return 'Saved contexts backed up to your account.'; }],
  ['cloud-restore', async () => { const cloud = await import('../../src/core/cloud'); const preview = await cloud.inspectCloud(); if (!confirm(`Restore ${preview.contexts} conversations and ${preview.projects} projects from ${preview.updatedAt}? Newer local copies will be kept.`)) return 'Restore cancelled.'; await cloud.restoreCloud(preview); await showLibrary(); return 'Cloud backup restored.'; }],
  ['cloud-disconnect', async () => { await (await import('../../src/core/cloud')).disconnectCloud(); await showCloudAccount(undefined); return 'Disconnected. Local data and cloud backup were kept.'; }],
  ['cloud-delete', async () => { if (!confirm('Delete the cloud backup for this account? Local data will be kept.')) return 'Deletion cancelled.'; await (await import('../../src/core/cloud')).deleteCloudBackup(); return 'Cloud backup deleted. Local data kept.'; }]
] as const) {
  const button = document.querySelector(`#${id}`) as HTMLButtonElement;
  button.addEventListener('click', async () => {
    button.disabled = true; cloudCardAction.disabled = true; cloudStatus.textContent = 'Working…';
    try { cloudStatus.textContent = await action(); }
    catch (error) { cloudStatus.textContent = cloudCardStatus.textContent = error instanceof Error ? error.message : 'Could not complete the cloud action. Try again.'; }
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
