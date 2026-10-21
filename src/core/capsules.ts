import type { Brief } from './brief';
import type { TurnArchive } from './capture';
import { fullContext } from './context-export';
import { listProjects, saveProject, type Project } from './projects';

/** A capture is a durable snapshot. Later background observations cannot rewrite it. */
export async function saveCapturedCapsule(archive: TurnArchive, brief: Brief, sourceUrl: string, title: string): Promise<Project> {
  const bytes = new TextEncoder().encode(JSON.stringify([sourceUrl, archive.turns.map(turn => [turn.role, turn.text]), archive.incomplete, archive.truncated]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const id = `capture:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
  const existing = (await listProjects()).find(project => project.id === id);
  if (existing) return existing;
  const context = fullContext(archive, sourceUrl);
  const capsule: Project = { id, name: title.trim().slice(0, 160) || brief.goal.slice(0, 160) || 'Captured conversation', updatedAt: Date.now(), threads: [sourceUrl], brief, draft: context.draft, draftMode: 'full', snapshotText: context.text };
  await saveProject(capsule);
  return capsule;
}
