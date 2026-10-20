import { updateBrief, renderBrief, wrapHandoff } from '../../src/core/brief';
import { estimateMeter } from '../../src/core/limits';
import { rankProviders, trainClassifier, providerTable, type Feedback, type Intent } from '../../src/core/router';
import type { ProviderId } from '../../src/core/selectors';
import { listProjects, mergeBrief, saveProject } from '../../src/core/projects';
import { briefSchema, type Brief } from '../../src/core/brief';

const status = document.querySelector('#status') as HTMLElement;
const draft = document.querySelector('#draft') as HTMLTextAreaElement;
const receipt = document.querySelector('#receipt') as HTMLElement;
const destination = document.querySelector('#destination') as HTMLSelectElement;
const recommendation = document.querySelector('#recommendation') as HTMLElement;
const urls: Record<ProviderId, string> = { chatgpt: 'https://chatgpt.com/', claude: 'https://claude.ai/new', gemini: 'https://gemini.google.com/app', deepseek: 'https://chat.deepseek.com/', grok: 'https://grok.com/', perplexity: 'https://www.perplexity.ai/' };
let source: ProviderId = 'chatgpt';
let currentBrief: Brief | undefined;
let sourceUrl = '';
let currentIntent: Intent = 'planning';

const settings = await chrome.storage.local.get(['enabledProviders', 'routerFeedback']);
const enabled = (settings.enabledProviders && typeof settings.enabledProviders === 'object' ? settings.enabledProviders : {}) as Record<string, boolean>;
let feedback = Array.isArray(settings.routerFeedback) ? settings.routerFeedback as Feedback[] : [];
for (const option of Array.from(destination.options)) {
  const id = option.value;
  option.disabled = enabled[id] === false || (enabled[id] === undefined && ['grok', 'perplexity', 'deepseek'].includes(id));
}
destination.addEventListener('change', () => { recommendation.textContent = `Selected ${destination.value}; review its current capacity in that service.`; });

document.querySelector('#capture')?.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active chat tab');
    const data = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT' });
    source = data.provider;
    sourceUrl = data.url;
    const brief = data.brief || updateBrief(undefined, data.turns, data.artifacts);
    currentBrief = brief;
    const rendered = renderBrief(brief);
    draft.value = wrapHandoff(rendered.text);
    const meter = estimateMeter(source, data.limit.text, data.turns.map((t: { text: string }) => t.text));
    const intent = trainClassifier()(brief.last_exchange.user);
    currentIntent = intent;
    const table = providerTable.map(p => ({ ...p, enabled: enabled[p.id] ?? p.enabled }));
    const choices = rankProviders(intent, source, table, {}, feedback);
    destination.value = choices[0]?.id || 'chatgpt';
    recommendation.textContent = choices[0] ? `${choices[0].id}: ${choices[0].reason}. Last verified: ${choices[0].lastVerified}.` : 'No enabled alternative; use Copy draft.';
    status.textContent = `${data.turns.length} visible turns. ${data.incomplete ? data.warning : 'Review the brief before continuing.'}`;
    receipt.textContent = `Brief: about ${rendered.receipt.approximateTokens} tokens. Dropped: ${rendered.receipt.dropped.join(', ') || 'none'}. Redactions: ${rendered.receipt.redactions.join(', ') || 'none'}. Meter: ${meter.tier}, ${meter.confidence} confidence. ${rendered.receipt.warnings.join(' ')}`;
  } catch (error) { status.textContent = `Capture failed: ${String(error)}. Paste a plain-text brief into the editor to continue.`; }
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
});
document.querySelector('#settings')?.addEventListener('click', () => { void chrome.runtime.openOptionsPage(); });

document.querySelector('#open')?.addEventListener('click', async () => {
  if (!draft.value.trim()) { status.textContent = 'Add a draft first.'; return; }
  const target = destination.value as ProviderId;
  const response = await chrome.runtime.sendMessage({ type: 'OPEN_DRAFT', url: urls[target], text: draft.value });
  status.textContent = response?.ok ? `Opened ${target}. Check the destination editor before sending.` : 'Could not open destination.';
});
document.querySelector('#copy')?.addEventListener('click', async () => { await navigator.clipboard.writeText(draft.value); status.textContent = 'Draft copied.'; });
