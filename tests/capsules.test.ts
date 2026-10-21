import { describe, it, expect, vi } from 'vitest';
import { saveCapturedCapsule } from '../src/core/capsules';
import { briefSchema } from '../src/core/brief';
import { listProjects, saveProject } from '../src/core/projects';
import { exportBackup, previewBackup } from '../src/core/backup';
import type { TurnArchive } from '../src/core/capture';

describe('durable captured capsules', () => {
  it('retains the full tail, deduplicates unchanged captures, and keeps user edits', async () => {
    const store: Record<string, unknown> = {};
    vi.stubGlobal('chrome', { storage: { local: { get: async (key: string) => ({ [key]: store[key] }), set: async (value: object) => Object.assign(store, value) } } });
    try {
      const brief = briefSchema.parse({ goal: 'Build a to-do app' });
      const archive: TurnArchive = { turns: [{ role: 'user', text: 'Build a to-do app', index: 0, id: 'u' }, { role: 'assistant', text: 'Keep this code. '.repeat(600) + 'FINAL_EDGE_CASE', index: 1, id: 'a' }], incomplete: false, truncated: false, savedAt: Date.now() };
      const first = await saveCapturedCapsule(archive, brief, 'https://gemini.google.com/app/1', 'To-do app');
      expect(first.draft).toContain('FINAL_EDGE_CASE');
      expect(first.draftMode).toBe('full');
      await saveProject({ ...first, name: 'My renamed capsule', draft: 'My exact reviewed edit' });
      const repeated = await saveCapturedCapsule({ ...archive, savedAt: Date.now() + 1000 }, brief, 'https://gemini.google.com/app/1', 'To-do app');
      expect(repeated.draft).toBe('My exact reviewed edit'); expect(await listProjects()).toHaveLength(1);
      const changed = { ...archive, turns: [...archive.turns, { role: 'user' as const, text: 'Now add offline storage', index: 2, id: 'u2' }] };
      const second = await saveCapturedCapsule(changed, brief, 'https://gemini.google.com/app/1', 'To-do app');
      expect(second.id).not.toBe(first.id); expect(await listProjects()).toHaveLength(2);
      expect((await listProjects())[0].snapshotText).not.toContain('Now add offline storage');
      const backup = await previewBackup(await exportBackup(store));
      expect(backup.data.projects[0].snapshotText).toContain('FINAL_EDGE_CASE');
    } finally { vi.unstubAllGlobals(); }
  });
});
