import { providerIds, bundledSelectors, type ProviderId } from '../../src/core/selectors';
import { deleteAll, exportProjects, importProjects, listProjects, saveProject } from '../../src/core/projects';

const providers = document.querySelector('#providers') as HTMLElement;
const projectsElement = document.querySelector('#projects') as HTMLElement;
const health = document.querySelector('#health') as HTMLElement;
const settings = await chrome.storage.local.get('enabledProviders');
const enabled: Record<string, boolean> = (settings.enabledProviders && typeof settings.enabledProviders === 'object' ? settings.enabledProviders : {}) as Record<string, boolean>;
for (const id of providerIds) {
  const label = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox'; checkbox.checked = enabled[id] ?? !['grok', 'perplexity', 'deepseek'].includes(id);
  checkbox.addEventListener('change', () => { enabled[id] = checkbox.checked; void chrome.storage.local.set({ enabledProviders: enabled }); });
  label.append(checkbox, document.createTextNode(` ${id} `)); providers.append(label);
}
async function showProjects() {
  projectsElement.replaceChildren();
  for (const project of await listProjects()) {
    const li = document.createElement('li'); li.textContent = `${project.name} — ${project.threads.length} chat(s), ${project.brief.open_tasks.length} open task(s)`;
    const resume = document.createElement('button'); resume.textContent = 'Copy resume brief';
    resume.addEventListener('click', () => { void navigator.clipboard.writeText(JSON.stringify(project.brief, null, 2)); health.textContent = `Copied ${project.name} brief. Paste it as a draft in a new chat.`; });
    li.append(resume); projectsElement.append(li);
  }
}
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
  try { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (!tab?.id) throw new Error('No active tab'); const result = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT' }); health.textContent = `${result.provider}: ${result.turns.length} visible turns, ${result.artifacts.length} artifacts. Selectors v${bundledSelectors.version}. ${result.warning || ''}`; }
  catch { health.textContent = 'Open a supported AI chat and run the check there.'; }
});
document.querySelector('#delete')?.addEventListener('click', async () => { if (!confirm('Delete all locally saved Handoff projects and settings?')) return; await deleteAll(); health.textContent = 'Local Handoff data deleted.'; await showProjects(); });
