import { expect, it, vi } from 'vitest';
import { briefSchema } from '../src/core/brief';
import { deleteProject, fileIntoFolder, listFolders, listProjects, mergeBrief, moveToFolder, pruneExpired, resolveFolder, saveProject } from '../src/core/projects';
import { exportBackup, mergeBackup, previewBackup } from '../src/core/backup';

it('merges tasks and preserves versioned artifacts', () => {
  const a = briefSchema.parse({ open_tasks: ['A'], artifacts: [{ name: 'doc', kind: 'text', content_verbatim: 'v1', version: 1 }] });
  const b = briefSchema.parse({ open_tasks: ['B'], artifacts: [{ name: 'doc', kind: 'text', content_verbatim: 'v2', version: 2 }] });
  const merged = mergeBrief(a, b);
  expect(merged.open_tasks).toEqual(['A', 'B']);
  expect(merged.artifacts).toHaveLength(2);
});

it('prunes expired local briefs and projects but keeps recent ones', async () => {
  const now = Date.UTC(2026, 9, 20);
  const brief = briefSchema.parse({ goal: 'test' });
  const store: Record<string, unknown> = {
    retentionDays: 7,
    'brief:old': brief, 'savedAt:brief:old': now - 8 * 86400000,
    'brief:new': brief, 'savedAt:brief:new': now - 2 * 86400000,
    projects: [
      { id: 'old', name: 'Old', updatedAt: now - 8 * 86400000, threads: [], brief },
      { id: 'new', name: 'New', updatedAt: now - 2 * 86400000, threads: [], brief }
    ]
  };
  vi.stubGlobal('chrome', { storage: { local: {
    get: async () => store,
    set: async (data: Record<string, unknown>) => Object.assign(store, data),
    remove: async (keys: string[]) => keys.forEach(key => delete store[key])
  } } });
  expect(await pruneExpired(now)).toBe(2);
  expect(store['brief:old']).toBeUndefined();
  expect(store['brief:new']).toEqual(brief);
  expect((store.projects as { id: string }[]).map(project => project.id)).toEqual(['new']);
  vi.unstubAllGlobals();
});

it('deletes only the chosen saved project', async () => {
  const brief = briefSchema.parse({ goal: 'test' });
  const store = { projects: [
    { id: 'one', name: 'One', updatedAt: 1, threads: [], brief },
    { id: 'two', name: 'Two', updatedAt: 2, threads: [], brief }
  ] };
  vi.stubGlobal('chrome', { storage: { local: {
    get: async () => store,
    set: async (data: typeof store) => Object.assign(store, data)
  } } });
  await deleteProject('one');
  expect(store.projects.map(project => project.id)).toEqual(['two']);
  vi.unstubAllGlobals();
});

it('keeps every readable project and never erases an unreadable one', async () => {
  const brief = briefSchema.parse({ goal: 'test' });
  const broken = { id: 'broken', name: 'From a newer version', updatedAt: 3 };
  const store: Record<string, unknown> = { projects: [{ id: 'one', name: 'One', updatedAt: 1, threads: [], brief }, broken] };
  vi.stubGlobal('chrome', { storage: { local: {
    get: async () => store,
    set: async (data: Record<string, unknown>) => Object.assign(store, data)
  } } });
  expect((await listProjects()).map(project => project.id)).toEqual(['one']);
  await saveProject({ id: 'two', name: 'Two', updatedAt: 2, threads: [], brief });
  expect((store.projects as { id: string }[]).map(project => project.id)).toEqual(['one', 'broken', 'two']);
  await deleteProject('one');
  expect(store.projects).toEqual([broken, { id: 'two', name: 'Two', updatedAt: 2, threads: [], brief }]);
  const backup = await previewBackup(await exportBackup(store));
  expect(backup.projects).toBe(1);
  expect((mergeBackup(store, backup.data).projects as unknown[])).toContainEqual(broken);
  vi.unstubAllGlobals();
});

it('files a folder name onto an existing folder whatever the case', () => {
  expect(resolveFolder('  school ', ['School', 'Work'])).toBe('School');
  expect(resolveFolder('Maths', ['School'])).toBe('Maths');
  expect(resolveFolder('   ', ['School'])).toBeUndefined();
});

it('moves projects into a folder and back out, leaving others and unreadable records alone', () => {
  const brief = briefSchema.parse({ goal: 'test' });
  const broken = { id: 'broken', name: 'From a newer version', updatedAt: 3 };
  const stored = [{ id: 'one', name: 'One', updatedAt: 1, threads: [], brief }, { id: 'two', name: 'Two', folder: 'Work', updatedAt: 2, threads: [], brief }, broken];
  const filed = fileIntoFolder(stored, [{ id: 'one', url: '', name: 'One', brief }, { id: 'broken', url: '', name: 'x', brief }], 'School') as { id: string; folder?: string; updatedAt: number }[];
  expect(filed.map(item => [item.id, item.folder])).toEqual([['one', 'School'], ['two', 'Work'], ['broken', undefined]]);
  expect(filed[0].updatedAt).toBe(1);
  expect(filed[2]).toBe(broken);
  const unfiled = fileIntoFolder(filed, [{ id: 'two', url: '', name: 'Two', brief }], undefined) as { folder?: string }[];
  expect('folder' in unfiled[1]).toBe(false);
  expect((stored[1] as { folder?: string }).folder).toBe('Work');
});

it('turns a recent chat into a filed baton that a later delete also hides', () => {
  const brief = briefSchema.parse({ goal: 'essay' });
  const recent = { id: '', url: 'https://claude.ai/chat/1', name: 'Essay plan', brief };
  expect(fileIntoFolder([], [recent], undefined)).toEqual([]);
  const filed = fileIntoFolder([], [recent], 'School', 5);
  expect(filed).toEqual([{ id: 'capture:https://claude.ai/chat/1', name: 'Essay plan', folder: 'School', updatedAt: 5, threads: ['https://claude.ai/chat/1'], brief }]);
  expect(fileIntoFolder(filed, [recent], 'Work')).toHaveLength(1);
});

it('moves batons into a new folder and remembers that folder', async () => {
  const brief = briefSchema.parse({ goal: 'test' });
  const store: Record<string, unknown> = { folders: ['School'], projects: [{ id: 'one', name: 'One', updatedAt: 1, threads: [], brief }] };
  vi.stubGlobal('chrome', { storage: { local: {
    get: async () => store,
    set: async (data: Record<string, unknown>) => Object.assign(store, data)
  } } });
  expect(await moveToFolder([{ id: 'one', url: '', name: 'One', brief }], 'school')).toBe('School');
  expect(store.folders).toEqual(['School']);
  expect(await moveToFolder([{ id: 'one', url: '', name: 'One', brief }], ' Exams ')).toBe('Exams');
  expect(await listFolders()).toEqual(['Exams', 'School']);
  expect((await listProjects())[0].folder).toBe('Exams');
  expect(await moveToFolder([{ id: 'one', url: '', name: 'One', brief }], '')).toBeUndefined();
  expect((await listProjects())[0].folder).toBeUndefined();
  vi.unstubAllGlobals();
});
