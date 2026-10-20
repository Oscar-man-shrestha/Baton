import { expect, it } from 'vitest';
import { briefSchema } from '../src/core/brief';
import { mergeBrief } from '../src/core/projects';

it('merges tasks and preserves versioned artifacts', () => {
  const a = briefSchema.parse({ open_tasks: ['A'], artifacts: [{ name: 'doc', kind: 'text', content_verbatim: 'v1', version: 1 }] });
  const b = briefSchema.parse({ open_tasks: ['B'], artifacts: [{ name: 'doc', kind: 'text', content_verbatim: 'v2', version: 2 }] });
  const merged = mergeBrief(a, b);
  expect(merged.open_tasks).toEqual(['A', 'B']);
  expect(merged.artifacts).toHaveLength(2);
});
