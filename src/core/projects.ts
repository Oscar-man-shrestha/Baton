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

/** Each saved project is checked on its own. One unreadable record must never hide or erase the others. */
export function readProjects(value: unknown): { projects: Project[]; unreadable: unknown[] } {
  const projects: Project[] = []; const unreadable: unknown[] = [];
  for (const item of Array.isArray(value) ? value : []) {
    const parsed = projectSchema.safeParse(item);
    if (parsed.success) projects.push(parsed.data); else unreadable.push(item);
  }
  return { projects, unreadable };
}
const rawId = (item: unknown) => item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined;
export async function listProjects(): Promise<Project[]> {
  return readProjects((await chrome.storage.local.get('projects')).projects).projects;
}
// Writes start from the stored list, so records this version cannot read are carried over unchanged.
export async function saveProject(project: Project): Promise<void> {
  const stored = (await chrome.storage.local.get('projects')).projects;
  const projects = Array.isArray(stored) ? [...stored] : [];
  const index = projects.findIndex(item => rawId(item) === project.id);
  if (index < 0) projects.push(project); else projects[index] = project;
  await chrome.storage.local.set({ projects });
}
export async function deleteProject(id: string): Promise<void> {
  const stored = (await chrome.storage.local.get('projects')).projects;
  await chrome.storage.local.set({ projects: (Array.isArray(stored) ? stored : []).filter(item => rawId(item) !== id) });
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
  const { projects, unreadable } = readProjects(saved.projects);
  const kept = projects.filter(project => project.updatedAt >= cutoff);
  if (kept.length !== projects.length) await chrome.storage.local.set({ projects: [...kept, ...unreadable] });
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

/** A baton to file: a saved project (id) or a recent chat (url only), which becomes a project so it can hold a folder. */
export type FileTarget = { id: string; url: string; name: string; brief: Brief };
/** Matches an existing folder whatever the case, so “school” files into “School”. Blank means no folder. */
export function resolveFolder(name: string, folders: string[]): string | undefined {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) return undefined;
  return folders.find(folder => folder.toLocaleLowerCase() === trimmed.toLocaleLowerCase()) || trimmed;
}
// Records this version cannot read are carried over unchanged, as in saveProject.
export function fileIntoFolder(stored: unknown, targets: FileTarget[], folder: string | undefined, now = Date.now()): unknown[] {
  const projects = Array.isArray(stored) ? [...stored] : [];
  for (const target of targets) {
    if (target.id) {
      const index = projects.findIndex(item => rawId(item) === target.id);
      const parsed = projectSchema.safeParse(projects[index]);
      if (index < 0 || !parsed.success) continue;
      const { folder: _old, ...rest } = parsed.data;
      projects[index] = folder ? { ...rest, folder } : rest;
    } else if (folder && target.url) {
      // Prefixed “capture:” so deleting it later also hides the recent chat it came from.
      const id = `capture:${target.url}`;
      if (projects.some(item => rawId(item) === id)) continue;
      projects.push({ id, name: target.name.trim().slice(0, 160) || 'Saved chat', folder, updatedAt: now, threads: [target.url], brief: target.brief });
    }
  }
  return projects;
}
export async function moveToFolder(targets: FileTarget[], name: string): Promise<string | undefined> {
  const folders = await listFolders();
  const folder = resolveFolder(name, folders);
  const stored = (await chrome.storage.local.get('projects')).projects;
  await chrome.storage.local.set({ projects: fileIntoFolder(stored, targets, folder), ...(folder && !folders.includes(folder) ? { folders: [...folders, folder] } : {}) });
  return folder;
}
