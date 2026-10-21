import { z } from 'zod';
import { briefSchema, type Brief } from './brief';

export const projectSchema = z.object({ id: z.string(), name: z.string(), folder: z.string().max(80).optional(), updatedAt: z.number(), threads: z.array(z.string()), draft: z.string().max(500000).optional(), draftMode: z.enum(['full', 'compact']).optional(), snapshotText: z.string().max(500000).optional(), brief: briefSchema });
export type Project = z.infer<typeof projectSchema>;

export function mergeBrief(a: Brief, b: Brief): Brief {
  const decisions = [...a.decisions];
  for (const incoming of b.decisions) {
    const existing = decisions.find(d => d.text === incoming.text);
    if (existing) Object.assign(existing, incoming);
    else decisions.push(incoming);
  }
  const artifacts = [...a.artifacts];
  for (const incoming of b.artifacts) {
    const existing = artifacts.find(x => x.name === incoming.name && x.version === incoming.version);
    if (existing) Object.assign(existing, incoming); else artifacts.push(incoming);
  }
  return briefSchema.parse({
    ...a, ...b,
    goal: b.goal || a.goal, status: b.status || a.status,
    preferences: [...new Set([...a.preferences, ...b.preferences])], decisions,
    assumptions: [...a.assumptions, ...b.assumptions], weak_spots: [...new Set([...a.weak_spots, ...b.weak_spots])],
    artifacts, open_tasks: [...new Set([...a.open_tasks, ...b.open_tasks])], rejected_approaches: [...new Set([...a.rejected_approaches, ...b.rejected_approaches])],
    next_step: b.next_step || a.next_step
  });
}

export async function listProjects(): Promise<Project[]> {
  const value = (await chrome.storage.local.get('projects')).projects;
  return z.array(projectSchema).catch([]).parse(value);
}
export async function saveProject(project: Project): Promise<void> {
  const projects = await listProjects();
  const index = projects.findIndex(p => p.id === project.id);
  if (index < 0) projects.push(project); else projects[index] = project;
  await chrome.storage.local.set({ projects });
}
export async function deleteProject(id: string): Promise<void> {
  const projects = await listProjects();
  await chrome.storage.local.set({ projects: projects.filter(project => project.id !== id) });
}
export async function deleteAll(): Promise<void> { await chrome.storage.local.clear(); }
export async function pruneExpired(now = Date.now()): Promise<number> {
  const saved = await chrome.storage.local.get(null);
  const days = Number(saved.retentionDays || 0);
  if (![7, 30, 90].includes(days)) return 0;
  const cutoff = now - days * 86400000;
  const remove: string[] = [];
  for (const key of Object.keys(saved)) {
    if (!key.startsWith('brief:')) continue;
    const timestampKey = `savedAt:${key}`;
    const timestamp = Number(saved[timestampKey]);
    if (!Number.isFinite(timestamp) || timestamp < cutoff) remove.push(key, timestampKey, `visibleTurnsHighWater:${key}`, `archive:${key}`);
  }
  const projects = z.array(projectSchema).catch([]).parse(saved.projects);
  const kept = projects.filter(project => project.updatedAt >= cutoff);
  if (kept.length !== projects.length) await chrome.storage.local.set({ projects: kept });
  if (remove.length) await chrome.storage.local.remove(remove);
  return (projects.length - kept.length) + remove.length / 4;
}
export function exportProjects(projects: Project[]): string { return JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), projects }, null, 2); }
export function importProjects(text: string): Project[] { return z.object({ schemaVersion: z.literal(1), projects: z.array(projectSchema) }).parse(JSON.parse(text)).projects; }

export async function listFolders(): Promise<string[]> {
  const saved = (await chrome.storage.local.get('folders')).folders;
  const explicit = z.array(z.string().max(80)).catch([]).parse(saved);
  return [...new Set([...explicit, ...(await listProjects()).map(p => p.folder || '').filter(Boolean)])].sort();
}
export async function createFolder(name: string): Promise<void> {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) throw new Error('Enter a folder name.');
  const folders = await listFolders();
  if (folders.some(folder => folder.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) throw new Error('That folder already exists.');
  await chrome.storage.local.set({ folders: [...folders, trimmed] });
}
