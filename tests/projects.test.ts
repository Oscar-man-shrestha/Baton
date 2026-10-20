import { expect, it, vi } from 'vitest';
import { briefSchema } from '../src/core/brief';
import { deleteProject, mergeBrief, pruneExpired } from '../src/core/projects';

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
