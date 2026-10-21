import { providerIds, bundledSelectors, type ProviderId } from '../../src/core/selectors';
import { deleteAll, deleteProject, exportProjects, importProjects, listProjects, pruneExpired, saveProject } from '../../src/core/projects';
import { providerTable, type Intent } from '../../src/core/router';
import { renderBrief, wrapHandoff } from '../../src/core/brief';

const providers = document.querySelector('#providers') as HTMLElement;
const projectsElement = document.querySelector('#projects') as HTMLElement;
const health = document.querySelector('#health') as HTMLElement;
const projectSearch = document.querySelector('#project-search') as HTMLInputElement;
const retention = document.querySelector('#retention') as HTMLSelectElement;
const retained = await chrome.storage.local.get('retentionDays');
retention.value = String(retained.retentionDays || 0);
retention.addEventListener('change', async () => { await chrome.storage.local.set({ retentionDays: Number(retention.value) }); const removed = await pruneExpired(); health.textContent = `Retention saved. ${removed} expired item(s) removed.`; await showProjects(); });
await pruneExpired();
const lastInsertion = (await chrome.storage.local.get('lastDraftInsertion')).lastDraftInsertion as { at?: number; ok?: boolean; attempts?: number } | undefined;
if (lastInsertion?.at) health.textContent = `Last draft insertion: ${lastInsertion.ok ? 'editor confirmed' : 'failed; use Copy draft'} after ${lastInsertion.attempts || '?'} attempt(s), ${new Date(lastInsertion.at).toLocaleString()}.`;
else health.textContent = 'No recent checks yet.';
const settings = await chrome.storage.local.get(['enabledProviders', 'providerIntents']);
const enabled: Record<string, boolean> = (settings.enabledProviders && typeof settings.enabledProviders === 'object' ? settings.enabledProviders : {}) as Record<string, boolean>;
const providerIntents = (settings.providerIntents && typeof settings.providerIntents === 'object' ? settings.providerIntents : {}) as Partial<Record<ProviderId, Intent[]>>;
const intents: Intent[] = ['planning', 'coding', 'writing', 'research', 'reasoning'];
for (const id of providerIds) {
  const row = document.createElement('div');
  row.style.marginBottom = '12px';
  const label = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox'; checkbox.checked = enabled[id] ?? !['grok', 'perplexity', 'deepseek'].includes(id);
  checkbox.addEventListener('change', () => { enabled[id] = checkbox.checked; void chrome.storage.local.set({ enabledProviders: enabled }); });
  const defaults = providerTable.find(provider => provider.id === id);
  label.append(checkbox, document.createTextNode(` ${id} — last verified: ${defaults?.lastVerified || 'unverified'}`)); row.append(label);
  const fits = document.createElement('div'); fits.style.marginLeft = '20px';
  for (const intent of intents) {
    const fitLabel = document.createElement('label'); fitLabel.style.marginRight = '8px';
    const fit = document.createElement('input'); fit.type = 'checkbox'; fit.checked = (providerIntents[id] || defaults?.intents || []).includes(intent);
    fit.addEventListener('change', () => {
      const selected = new Set(providerIntents[id] || defaults?.intents || []);
      if (fit.checked) selected.add(intent); else selected.delete(intent);
      providerIntents[id] = [...selected]; void chrome.storage.local.set({ providerIntents });
    });
    fitLabel.append(fit, document.createTextNode(` ${intent}`)); fits.append(fitLabel);
  }
  row.append(fits); providers.append(row);
}
async function showProjects() {
  projectsElement.replaceChildren();
  const projects = (await listProjects()).sort((a, b) => b.updatedAt - a.updatedAt);
  const visible = projects.filter(project => project.name.toLowerCase().includes(projectSearch.value.trim().toLowerCase()));
  if (!visible.length) { const empty = document.createElement('li'); empty.textContent = projects.length ? 'No matching projects.' : 'No projects saved yet.'; projectsElement.append(empty); }
  for (const project of visible) {
    const li = document.createElement('li');
    const summary = document.createElement('span'); summary.textContent = `${project.folder ? `${project.folder} / ` : ''}${project.name} — ${project.threads.length} chat(s), ${project.brief.open_tasks.length} open task(s)`;
    const actions = document.createElement('div');
    const resume = document.createElement('button'); resume.textContent = 'Copy brief'; resume.setAttribute('aria-label', `Copy ${project.name} brief`);
    resume.addEventListener('click', async () => { await navigator.clipboard.writeText(wrapHandoff(renderBrief(project.brief).text)); health.textContent = `Copied ${project.name} as a readable handoff draft.`; });
    const remove = document.createElement('button'); remove.textContent = 'Delete'; remove.className = 'danger'; remove.setAttribute('aria-label', `Delete ${project.name}`);
    remove.addEventListener('click', async () => { if (!confirm(`Delete ${project.name} from saved projects?`)) return; await deleteProject(project.id); health.textContent = `${project.name} deleted.`; await showProjects(); });
    const move = document.createElement('button'); move.textContent = 'Folder'; move.setAttribute('aria-label', `Change folder for ${project.name}`);
    move.addEventListener('click', async () => {
      const folder = prompt(`Folder for ${project.name} (leave blank for none)`, project.folder || '');
      if (folder === null) return;
      await saveProject({ ...project, folder: folder.trim().slice(0, 80) || undefined, updatedAt: Date.now() });
      health.textContent = `Folder updated for ${project.name}.`;
      await showProjects();
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
  try { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (!tab?.id) throw new Error('No active tab'); const result = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT' }); health.textContent = `${result.provider}: ${result.turnCount} visible turns, ${result.artifactCount} artifacts. Selectors v${bundledSelectors.version}. ${result.warning || ''}`; }
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
document.querySelector('#delete')?.addEventListener('click', async () => { if (!confirm('Delete all locally saved Handoff projects and settings?')) return; await deleteAll(); health.textContent = 'Local Handoff data deleted.'; await showProjects(); });
