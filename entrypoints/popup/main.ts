import { renderBrief, wrapHandoff, draftBudget } from '../../src/core/brief';
import { shouldNudge, type Meter } from '../../src/core/limits';
import { encode } from 'gpt-tokenizer';
import { rankProviders, trainClassifier, providerTable, type Feedback, type Intent } from '../../src/core/router';
import { providerIds, type ProviderId } from '../../src/core/selectors';
import { listProjects, mergeBrief, pruneExpired, saveProject } from '../../src/core/projects';
import { briefSchema, type Brief } from '../../src/core/brief';
import type { TurnArchive } from '../../src/core/capture';
import { meterSummary } from '../../src/core/usage-alerts';
import { isSupportedChatUrl, sendWithBootstrap } from '../../src/core/connection';

const status = document.querySelector('#status') as HTMLElement;
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
let captureStarted = false;
void activeChatTab().then(async tab => {
  if (!tab || !isSupportedChatUrl(tab.url)) return;
  const response = await sendToChat<{ ready?: boolean; provider?: ProviderId }>(tab, { type: 'PING' });
  if (response.ready && !captureStarted) status.textContent = `Ready on ${providerNames[response.provider || 'chatgpt']}. Capture this chat when you want to move it.`;
}).catch(() => { /* The capture button will show a useful error if connection fails. */ });
const providerNames: Record<ProviderId, string> = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', deepseek: 'DeepSeek', grok: 'Grok', perplexity: 'Perplexity' };
async function showUsage() {
  const saved = await chrome.storage.local.get(providerIds.map(id => `meter:${id}`));
  usageList.replaceChildren();
  for (const id of providerIds) {
    const row = document.createElement('div'); row.className = 'usage-row';
    const name = document.createElement('strong'); name.textContent = providerNames[id];
    const value = document.createElement('span'); value.textContent = meterSummary(saved[`meter:${id}`] as Meter | undefined);
    row.append(name, value); usageList.append(row);
  }
}
void showUsage();
chrome.storage.onChanged.addListener(changes => { if (providerIds.some(id => changes[`meter:${id}`])) void showUsage(); });
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
  openDraft.disabled = !budget.fits || !reviewed;
  copyDraft.disabled = !draft.value.trim();
  draftBudgetLabel.dataset.state = !draft.value.trim() ? 'empty' : budget.fits ? 'ready' : 'over';
  draft.setAttribute('aria-invalid', draft.value.trim() && !budget.fits ? 'true' : 'false');
  draftBudgetLabel.textContent = draft.value.trim() ? `Whole draft: about ${budget.approximateTokens}/1,500 tokens. ${budget.fits ? 'Ready for review.' : 'Shorten it before opening a destination.'}` : 'Draft is empty.';
  draftPreview.textContent = !draft.value.trim() ? 'Paste a brief to continue.' : !budget.fits ? 'Draft is too long. Open it below and shorten it.' : reviewed ? 'Draft ready. You can open it in a new chat.' : 'Draft ready. Open it below to review before continuing.';
};
draft.addEventListener('input', showDraftBudget);
reviewPanel.addEventListener('toggle', () => { if (reviewPanel.open) { reviewed = true; showDraftBudget(); } });
const urls: Record<ProviderId, string> = { chatgpt: 'https://chatgpt.com/', claude: 'https://claude.ai/new', gemini: 'https://gemini.google.com/app', deepseek: 'https://chat.deepseek.com/', grok: 'https://grok.com/', perplexity: 'https://www.perplexity.ai/' };
const showAccountHelp = () => { googleAccount.hidden = destination.value !== 'gemini'; };
document.querySelector('#open-gemini-account')?.addEventListener('click', () => { void chrome.tabs.create({ url: urls.gemini }); });
await pruneExpired();
let source: ProviderId = 'chatgpt';
let currentBrief: Brief | undefined;
let sourceUrl = '';
let currentIntent: Intent = 'planning';

const showLibrary = async () => {
  const projects = (await listProjects()).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);
  library.hidden = projects.length === 0;
  libraryList.replaceChildren();
  for (const project of projects) {
    const button = document.createElement('button');
    button.type = 'button';
    const title = document.createElement('strong'); title.textContent = project.name;
    const detail = document.createElement('small'); detail.textContent = `${project.brief.open_tasks.length} open task${project.brief.open_tasks.length === 1 ? '' : 's'}`;
    button.append(title, detail);
    button.addEventListener('click', () => {
      currentBrief = project.brief;
      sourceUrl = project.threads.at(-1) || '';
      copyTranscript.disabled = !sourceUrl;
      draft.value = wrapHandoff(renderBrief(project.brief).text);
      reviewed = false;
      reviewPanel.open = false;
      flow.hidden = false;
      saveBrief.disabled = false;
      recommendation.textContent = 'Choose a service you use. Availability is checked there.';
      positiveFeedback.disabled = true;
      negativeFeedback.disabled = true;
      showDraftBudget();
      status.textContent = `Loaded ${project.name}. Review the draft before continuing.`;
    });
    libraryList.append(button);
  }
};
void showLibrary();

const settings = await chrome.storage.local.get(['enabledProviders', 'providerIntents', 'routerFeedback']);
document.querySelector('#manual')?.addEventListener('click', () => {
  flow.hidden = false;
  reviewPanel.open = true;
  status.textContent = 'Paste your brief, then choose where to continue.';
  draft.focus();
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
  captureButton.disabled = true;
  flow.hidden = true;
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
    showDraftBudget();
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
  finally { captureButton.disabled = false; captureButton.textContent = 'Capture this chat'; }
});

for (const [selector, positive] of [['#positive', true], ['#negative', false]] as const) document.querySelector(selector)?.addEventListener('click', async () => {
  feedback = [...feedback, { intent: currentIntent, provider: destination.value as ProviderId, positive }];
  await chrome.storage.local.set({ routerFeedback: feedback });
  status.textContent = 'Recommendation feedback saved locally.';
});

document.querySelector('#save')?.addEventListener('click', async () => {
  const name = (document.querySelector('#project') as HTMLInputElement).value.trim();
  if (!name || !currentBrief) { status.textContent = 'Capture a chat and enter a project name first.'; return; }
  const projects = await listProjects();
  const existing = projects.find(p => p.name.toLowerCase() === name.toLowerCase());
  const brief = existing ? mergeBrief(existing.brief, currentBrief) : briefSchema.parse(currentBrief);
  await saveProject({ id: existing?.id || crypto.randomUUID(), name, updatedAt: Date.now(), threads: [...new Set([...(existing?.threads || []), sourceUrl])], brief });
  status.textContent = `Saved brief to ${name}.`;
  await showLibrary();
});
document.querySelector('#settings')?.addEventListener('click', () => { void chrome.runtime.openOptionsPage(); });

document.querySelector('#open')?.addEventListener('click', async () => {
  if (!draftBudget(draft.value).fits) { status.textContent = 'Shorten the reviewed draft to 1,500 approximate tokens before opening a destination.'; return; }
  const target = destination.value as ProviderId;
  const response = await chrome.runtime.sendMessage({ type: 'OPEN_DRAFT', url: urls[target], text: draft.value });
  status.textContent = response?.ok ? `Opened ${target}. Check the destination editor before sending.` : 'Could not open destination.';
});
document.querySelector('#copy')?.addEventListener('click', async () => { await navigator.clipboard.writeText(draft.value); status.textContent = 'Draft copied.'; });
copyTranscript.addEventListener('click', async () => {
  if (!sourceUrl) return;
  const archive = (await chrome.storage.local.get(`archive:brief:${sourceUrl}`))[`archive:brief:${sourceUrl}`] as TurnArchive | undefined;
  if (!archive?.turns.length) { status.textContent = 'No captured text is saved for this chat.'; return; }
  const text = archive.turns.map((turn, index) => `${index + 1}. ${turn.role === 'user' ? 'You' : 'Assistant'}\n${turn.text}`).join('\n\n');
  await navigator.clipboard.writeText(text);
  status.textContent = `Copied ${archive.turns.length} captured text turns. ${archive.incomplete || archive.truncated ? 'This transcript may be incomplete.' : 'Review before sharing.'}`;
});
