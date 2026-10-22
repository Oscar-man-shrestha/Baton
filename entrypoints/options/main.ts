import { providerIds, bundledSelectors, type ProviderId } from '../../src/core/selectors';
import { deleteAll, deleteProject, exportProjects, importProjects, listProjects, pruneExpired, saveProject, type Project } from '../../src/core/projects';
import { providerNames } from '../../src/core/rescue';
import { activeRankings, topicNames, topicOrder, topics, type TaskPicks, type Topic, type UserOrder } from '../../src/core/task-fit';
import { renderBrief, wrapHandoff, redact } from '../../src/core/brief';
import { isSupportedChatUrl, sendWithBootstrap } from '../../src/core/connection';

const providers = document.querySelector('#providers') as HTMLElement;
const projectsElement = document.querySelector('#projects') as HTMLElement;
const health = document.querySelector('#health') as HTMLElement;
const projectSearch = document.querySelector('#project-search') as HTMLInputElement;
const retention = document.querySelector('#retention') as HTMLSelectElement;
const folderDialog = document.querySelector('#folder-dialog') as HTMLDialogElement;
const folderName = document.querySelector('#folder-name') as HTMLInputElement;
let editingProject: Project | undefined;
folderDialog.querySelector('form')?.addEventListener('submit', async event => {
  if ((event as SubmitEvent).submitter?.getAttribute('value') !== 'save' || !editingProject) return;
  event.preventDefault();
  await saveProject({ ...editingProject, folder: folderName.value.trim().slice(0, 80) || undefined, updatedAt: Date.now() });
  health.textContent = `Folder updated for ${editingProject.name}.`;
  folderDialog.close(); await showProjects();
});
const retained = await chrome.storage.local.get('retentionDays');
retention.value = String(retained.retentionDays || 0);
retention.addEventListener('change', async () => { await chrome.storage.local.set({ retentionDays: Number(retention.value) }); const removed = await pruneExpired(); health.textContent = `Retention saved. ${removed} expired item(s) removed.`; await showProjects(); });
await pruneExpired();
const lastInsertion = (await chrome.storage.local.get('lastDraftInsertion')).lastDraftInsertion as { at?: number; ok?: boolean; attempts?: number } | undefined;
if (lastInsertion?.at) health.textContent = `Last draft insertion: ${lastInsertion.ok ? 'editor confirmed' : 'failed; use Copy draft'} after ${lastInsertion.attempts || '?'} attempt(s), ${new Date(lastInsertion.at).toLocaleString()}.`;
else health.textContent = '';
const settings = await chrome.storage.local.get(['enabledProviders']);
const enabled: Record<string, boolean> = (settings.enabledProviders && typeof settings.enabledProviders === 'object' ? settings.enabledProviders : {}) as Record<string, boolean>;
for (const id of providerIds) {
  const label = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox'; checkbox.checked = enabled[id] ?? true;
  checkbox.addEventListener('change', () => { enabled[id] = checkbox.checked; void chrome.storage.local.set({ enabledProviders: enabled }); });
  label.append(checkbox, document.createTextNode(` ${providerNames[id]}`)); providers.append(label);
}
// Order per task: Baton's list (from GitHub when newer), nudged by your picks, unless you set your own order here.
const rankingTopic = document.querySelector('#ranking-topic') as HTMLSelectElement;
const rankingList = document.querySelector('#ranking-list') as HTMLOListElement;
const rankingSource = document.querySelector('#ranking-source') as HTMLElement;
const rankingHint = document.querySelector('#ranking-hint') as HTMLElement;
for (const topic of topics) rankingTopic.append(new Option(topicNames[topic], topic));
const showRanking = async () => {
  const saved = await chrome.storage.local.get(['rankingsRemote', 'rankingsUser', 'taskPicks']);
  const { rankings, online, fetchedAt } = activeRankings(saved.rankingsRemote);
  const userOrder = (saved.rankingsUser || {}) as UserOrder;
  const picks = saved.taskPicks as TaskPicks | undefined;
  const topic = rankingTopic.value as Topic;
  const order = topicOrder(topic, rankings, userOrder, picks);
  rankingSource.textContent = online ? `Baton's list updated ${rankings.updated}, checked ${new Date(fetchedAt!).toLocaleString()}.` : `Baton's built-in list (${rankings.updated}). Updates are checked once a day.`;
  rankingHint.textContent = userOrder[topic]?.length ? 'Your own order is used for this task.' : Object.values(picks?.[topic] || {}).some(Boolean) ? "Baton's order, adjusted by the AIs you picked for this task." : "Baton's order. Move an AI up or down to set your own.";
  rankingList.replaceChildren(...order.map((id, index) => {
    const item = document.createElement('li');
    const name = document.createElement('span'); name.className = 'name'; name.textContent = providerNames[id];
    const why = document.createElement('span'); why.className = 'why'; why.textContent = rankings.reasons[topic]?.[id] || '';
    const move = (delta: number, label: string, symbol: string) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = symbol; button.setAttribute('aria-label', `Move ${providerNames[id]} ${label}`);
      button.disabled = index + delta < 0 || index + delta >= order.length;
      button.addEventListener('click', async () => {
        const next = [...order]; [next[index], next[index + delta]] = [next[index + delta], next[index]];
        await chrome.storage.local.set({ rankingsUser: { ...userOrder, [topic]: next } }); await showRanking();
        (rankingList.children[index + delta]?.querySelector(`button[aria-label^="Move ${providerNames[id]} ${label}"]`) as HTMLButtonElement | null)?.focus();
      });
      return button;
    };
    item.append(name, why, move(-1, 'up', '↑'), move(1, 'down', '↓'));
    return item;
  }));
};
rankingTopic.addEventListener('change', () => { void showRanking(); });
document.querySelector('#ranking-reset')?.addEventListener('click', async () => {
  const userOrder = { ...((await chrome.storage.local.get('rankingsUser')).rankingsUser || {}) } as UserOrder;
  delete userOrder[rankingTopic.value as Topic];
  await chrome.storage.local.set({ rankingsUser: userOrder }); await showRanking();
});
document.querySelector('#ranking-forget')?.addEventListener('click', async () => { await chrome.storage.local.remove('taskPicks'); await showRanking(); });
document.querySelector('#ranking-update')?.addEventListener('click', async event => {
  const button = event.currentTarget as HTMLButtonElement; button.disabled = true; rankingSource.textContent = 'Checking…';
  const result = await chrome.runtime.sendMessage({ type: 'REFRESH_RANKINGS' }).catch(() => undefined);
  await showRanking(); if (!result?.ok) rankingSource.textContent += ' No newer list was found; nothing changed.';
  button.disabled = false;
});
await showRanking();
async function showProjects() {
  projectsElement.replaceChildren();
  const projects = (await listProjects()).sort((a, b) => b.updatedAt - a.updatedAt);
  const visible = projects.filter(project => `${project.name} ${project.folder || ''}`.toLowerCase().includes(projectSearch.value.trim().toLowerCase()));
  if (!visible.length) { const empty = document.createElement('li'); empty.textContent = projects.length ? 'No matching projects.' : 'No projects saved yet.'; projectsElement.append(empty); }
  for (const project of visible) {
    const li = document.createElement('li');
    const summary = document.createElement('span'); summary.textContent = `${project.folder ? `${project.folder} / ` : ''}${project.name} — ${project.threads.length} chat(s), ${project.brief.open_tasks.length} open task(s)`;
    const actions = document.createElement('div');
    const resume = document.createElement('button'); resume.textContent = 'Copy brief'; resume.setAttribute('aria-label', `Copy ${project.name} brief`);
    resume.addEventListener('click', async () => { await navigator.clipboard.writeText(redact(project.draft || wrapHandoff(renderBrief(project.brief).text)).text); health.textContent = `Copied ${project.name} as a readable handoff draft.`; });
    const remove = document.createElement('button'); remove.textContent = 'Delete'; remove.className = 'danger'; remove.setAttribute('aria-label', `Delete ${project.name}`);
    remove.addEventListener('click', async () => { if (!confirm(`Delete ${project.name} from saved projects?`)) return; await deleteProject(project.id); health.textContent = `${project.name} deleted.`; await showProjects(); });
    const move = document.createElement('button'); move.textContent = 'Folder'; move.setAttribute('aria-label', `Change folder for ${project.name}`);
    move.addEventListener('click', () => {
      editingProject = project; folderName.value = project.folder || '';
      (document.querySelector('#folder-project-name') as HTMLElement).textContent = project.name;
      folderDialog.showModal(); folderName.focus();
    });
    actions.append(resume, move, remove); li.append(summary, actions); projectsElement.append(li);
  }
}
projectSearch.addEventListener('input', () => { void showProjects(); });
void showProjects();
document.querySelector('#export')?.addEventListener('click', async () => {
  const blob = new Blob([exportProjects(await listProjects())], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'handoff-projects.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
(document.querySelector('#import') as HTMLInputElement).addEventListener('change', async event => {
  try { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; for (const project of importProjects(await file.text())) await saveProject(project); health.textContent = 'Projects imported.'; await showProjects(); }
  catch (error) { health.textContent = `Import failed: ${String(error)}`; }
});
document.querySelector('#selftest')?.addEventListener('click', async () => {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const tab = tabs.find(tab => tab.active && isSupportedChatUrl(tab.url)) || tabs.filter(tab => isSupportedChatUrl(tab.url)).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
    if (!tab?.id) throw new Error('No supported chat');
    const result = await sendWithBootstrap<any>(tab, { type: 'EXTRACT' }, (id, message) => chrome.tabs.sendMessage(id, message), async id => {
      const script = chrome.runtime.getManifest().content_scripts?.[0]?.js?.[0];
      if (!script) throw new Error('Missing content script');
      await chrome.scripting.executeScript({ target: { tabId: id }, files: [script] });
    });
    health.textContent = result?.error ? result.error : `${result.provider}: ${result.turnCount} captured messages, ${result.artifactCount} artifacts. Selectors v${bundledSelectors.version}. ${result.warning || ''}`;
  }
  catch { health.textContent = 'Open a supported AI chat and run the check there.'; }
});
document.querySelector('#export-diagnostic')?.addEventListener('click', async () => {
  const saved = await chrome.storage.local.get(null);
  const selectorHealth = Object.fromEntries(Object.entries(saved).filter(([key]) => key.startsWith('health:')).map(([key, value]) => {
    const data = value as { at?: number; turns?: number; selectorsVersion?: number };
    return [key, { at: data?.at, turns: data?.turns, selectorsVersion: data?.selectorsVersion }];
  }));
  const insertion = saved.lastDraftInsertion as { at?: number; ok?: boolean; attempts?: number } | undefined;
  const diagnostic = { generatedAt: new Date().toISOString(), extensionVersion: chrome.runtime.getManifest().version, selectorsVersion: bundledSelectors.version, selectorHealth, lastDraftInsertion: insertion ? { at: insertion.at, ok: insertion.ok, attempts: insertion.attempts } : null };
  const blob = new Blob([JSON.stringify(diagnostic, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'handoff-diagnostic.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  health.textContent = 'Diagnostic exported without chat text. Review the file before sharing it.';
});
document.querySelector('#delete')?.addEventListener('click', async () => { if (!confirm('Delete all locally saved Baton projects and settings?')) return; await deleteAll(); health.textContent = 'Local Baton data deleted.'; await showProjects(); });
