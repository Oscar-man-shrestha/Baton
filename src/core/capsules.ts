import { updateBrief, type Brief } from './brief';
import { archiveWindow, type TurnArchive } from './capture';
import type { Turn } from './adapter';
import { fullContext } from './context-export';
import { listFolders, listProjects, resolveFolder, saveProject, type Project } from './projects';

const digest = async (value: unknown) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))), byte => byte.toString(16).padStart(2, '0')).join('');

/** A capture is a durable snapshot. Later background observations cannot rewrite it. */
export async function saveCapturedCapsule(archive: TurnArchive, brief: Brief, sourceUrl: string, title: string): Promise<Project> {
  const id = `capture:${await digest([sourceUrl, archive.turns.map(turn => [turn.role, turn.text]), archive.incomplete, archive.truncated])}`;
  const existing = (await listProjects()).find(project => project.id === id);
  if (existing) return existing;
  const context = fullContext(archive, sourceUrl);
  const capsule: Project = { id, name: title.trim().slice(0, 160) || brief.goal.slice(0, 160) || 'Captured conversation', updatedAt: Date.now(), threads: [sourceUrl], brief, draft: context.draft, draftMode: 'full', snapshotText: context.text };
  await saveProject(capsule);
  return capsule;
}

/**
 * Part of a chat, saved as a baton of its own (one per topic of a long chat). Stored like a captured chat, so it lists,
 * files and passes the same way. “selection:” ids keep the chat it came from listed in Recent.
 * Saving the same selection again renames or refiles it instead of adding a copy.
 */
export async function saveSelectionCapsule(turns: Turn[], sourceUrl: string, name: string, folder?: string): Promise<Project> {
  const archive = archiveWindow(undefined, turns);
  const id = `selection:${await digest([sourceUrl, archive.turns.map(turn => [turn.role, turn.text])])}`;
  const brief = updateBrief(undefined, archive.turns, []);
  const context = fullContext(archive, sourceUrl, 'selection');
  const filed = resolveFolder(folder || '', await listFolders());
  const capsule: Project = { id, name: name.trim().slice(0, 160) || brief.goal.slice(0, 160) || 'Selected part of a chat', ...(filed ? { folder: filed } : {}), updatedAt: Date.now(), threads: [sourceUrl], brief, draft: context.draft, draftMode: 'full', snapshotText: context.text };
  await saveProject(capsule);
  return capsule;
}
