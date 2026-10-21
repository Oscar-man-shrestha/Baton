import { z } from 'zod';
import { briefSchema } from './brief';
import { projectSchema, readProjects } from './projects';
import { isSupportedChatUrl } from './connection';

const turn = z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(500000), index: z.number().int().nonnegative(), id: z.string().optional() });
const archive = z.object({ turns: z.array(turn).max(10000), incomplete: z.boolean(), truncated: z.boolean().optional(), savedAt: z.number().optional(), selectorsVersion: z.number().optional() });
const dataSchema = z.object({ projects: z.array(projectSchema).max(5000), folders: z.array(z.string().max(80)).max(5000), captures: z.array(z.object({ url: z.string().refine(isSupportedChatUrl), brief: briefSchema, savedAt: z.number().finite().nonnegative(), archive: archive.optional() })).max(5000),
  // Optional so version 1 files made before deletions were recorded keep their checksum.
  dismissedRecentUrls: z.array(z.string().max(4096)).max(5000).optional() });
export type BackupData = z.infer<typeof dataSchema>;
async function checksum(data: unknown): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data))))].map(n => n.toString(16).padStart(2, '0')).join('');
}
const urlList = (value: unknown): string[] => z.array(z.string().max(4096)).catch([]).parse(value);
export async function exportBackup(saved: Record<string, unknown>): Promise<string> {
  const captures: BackupData['captures'] = [];
  // Deleted capsules stay out of uploads and downloads; only their URLs travel so restores do not resurrect them.
  const dismissed = urlList(saved.dismissedRecentUrls).slice(-5000);
  for (const [key, value] of Object.entries(saved)) {
    if (!key.startsWith('brief:') || !isSupportedChatUrl(key.slice(6)) || dismissed.includes(key.slice(6))) continue;
    const brief = briefSchema.safeParse(value); if (!brief.success) continue;
    const rawArchive = archive.safeParse(saved[`archive:${key}`]);
    captures.push({ url: key.slice(6), brief: brief.data, savedAt: Number(saved[`savedAt:${key}`]) || 0, ...(rawArchive.success ? { archive: rawArchive.data } : {}) });
  }
  const data = dataSchema.parse({ projects: readProjects(saved.projects).projects, folders: saved.folders || [], captures, ...(dismissed.length ? { dismissedRecentUrls: dismissed } : {}) });
  return JSON.stringify({ format: 'handoff-backup', version: 1, createdAt: new Date().toISOString(), data, sha256: await checksum(data) }, null, 2);
}
export async function previewBackup(text: string): Promise<{ data: BackupData; contexts: number; projects: number }> {
  if (text.length > 20000000) throw new Error('Backup exceeds 20 MB.');
  const envelope = z.object({ format: z.literal('handoff-backup'), version: z.literal(1), data: dataSchema, sha256: z.string() }).parse(JSON.parse(text));
  if (await checksum(envelope.data) !== envelope.sha256) throw new Error('Backup checksum does not match. The file may be damaged.');
  return { data: envelope.data, contexts: envelope.data.captures.length, projects: envelope.data.projects.length };
}
export function mergeBackup(local: Record<string, unknown>, incoming: BackupData): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  const local_ = readProjects(local.projects);
  const projects = new Map(local_.projects.map(project => [project.id, project]));
  for (const project of incoming.projects) if (!projects.has(project.id) || projects.get(project.id)!.updatedAt < project.updatedAt) projects.set(project.id, project);
  changes.projects = [...projects.values(), ...local_.unreadable];
  changes.folders = [...new Set([...z.array(z.string()).catch([]).parse(local.folders), ...incoming.folders])];
  const dismissed = [...new Set([...urlList(local.dismissedRecentUrls), ...(incoming.dismissedRecentUrls || [])])].slice(-5000);
  if (incoming.dismissedRecentUrls?.length) changes.dismissedRecentUrls = dismissed;
  for (const capture of incoming.captures) {
    const key = `brief:${capture.url}`;
    if (dismissed.includes(capture.url)) continue;
    if (local[key] && Number(local[`savedAt:${key}`] || 0) >= capture.savedAt) continue;
    changes[key] = capture.brief; changes[`savedAt:${key}`] = capture.savedAt;
    if (capture.archive) changes[`archive:${key}`] = capture.archive;
    else if (local[`archive:${key}`]) changes[`archive:${key}`] = { turns: [], incomplete: true };
  }
  return changes;
}
