import { describe, expect, it } from 'vitest';
import { archiveWindow, mergeTurnWindows } from '../src/core/capture';
import type { Turn } from '../src/core/adapter';

const turn = (role: Turn['role'], text: string, index: number): Turn => ({ role, text, index });

describe('older-message capture', () => {
  it('keeps chronological order and removes overlap between virtualized windows', () => {
    const latest = [turn('user', 'Second question', 0), turn('assistant', 'Second answer', 1)];
    const older = [turn('user', 'First question', 0), turn('assistant', 'First answer', 1), turn('user', 'Second question', 2)];
    expect(mergeTurnWindows(older, latest).map(item => item.text)).toEqual(['First question', 'First answer', 'Second question', 'Second answer']);
  });
  it('does not duplicate a window seen twice', () => {
    const window = [turn('user', 'Question', 0), turn('assistant', 'Answer', 1)];
    expect(mergeTurnWindows(window, window)).toHaveLength(2);
  });
  it('preserves legitimately repeated messages in separate windows', () => {
    const latest = [turn('user', 'Repeat this request', 0), turn('assistant', 'New response', 1)];
    const older = [turn('user', 'Repeat this request', 0), turn('assistant', 'Old response', 1)];
    expect(mergeTurnWindows(older, latest).map(item => item.text)).toEqual(['Repeat this request', 'Old response', 'Repeat this request', 'New response']);
  });
  it('keeps an incremental local archive across forward and backward virtualized windows', () => {
    const first = archiveWindow(undefined, [turn('user', 'A', 0), turn('assistant', 'B', 1)], 1);
    const forward = archiveWindow(first, [turn('assistant', 'B', 0), turn('user', 'C', 1)], 2);
    const backward = archiveWindow(forward, [turn('user', 'Z', 0), turn('user', 'A', 1)], 3);
    expect(backward.turns.map(item => item.text)).toEqual(['Z', 'A', 'B', 'C']);
    expect(backward.incomplete).toBe(false);
  });
  it('flags windows without an overlap and caps locally stored text', () => {
    const separate = archiveWindow(archiveWindow(undefined, [turn('user', 'first', 0)]), [turn('assistant', 'later', 0)]);
    expect(separate.incomplete).toBe(true);
    const huge = archiveWindow(undefined, [turn('user', 'x'.repeat(400_000), 0)]);
    expect(huge.truncated).toBe(true);
    expect(huge.turns[0].text.length).toBe(300_000);
  });
  it('updates a streaming reply by native message ID rather than saving partial duplicates', () => {
    const user = { ...turn('user', 'Build the app', 0), id: 'user:1' };
    const partial = { ...turn('assistant', 'Here is the implementation', 1), id: 'assistant:2' };
    const first = archiveWindow(undefined, [user, partial]);
    const complete = archiveWindow(first, [user, { ...partial, text: 'Here is the implementation with all functions and tests.' }]);
    expect(complete.turns).toHaveLength(2);
    expect(complete.turns[1].text).toContain('all functions and tests');
    expect(complete.incomplete).toBe(false);
  });
  it('updates an anonymous streaming reply only when its user message anchors the overlap', () => {
    const question = turn('user', 'Please make a task list', 0);
    const partial = turn('assistant', 'Here is a detailed implementation of the task list', 1);
    const complete = archiveWindow(archiveWindow(undefined, [question, partial]), [question, { ...partial, text: `${partial.text}, including keyboard shortcuts.` }]);
    expect(complete.turns).toHaveLength(2);
    expect(complete.turns[1].text).toContain('keyboard shortcuts');
  });
  it('keeps identical prompts with distinct provider IDs as separate turns', () => {
    const first = archiveWindow(undefined, [{ ...turn('user', 'Continue', 0), id: 'u1' }, { ...turn('assistant', 'First answer', 1), id: 'a1' }]);
    const second = archiveWindow(first, [{ ...turn('assistant', 'First answer', 0), id: 'a1' }, { ...turn('user', 'Continue', 1), id: 'u2' }]);
    expect(second.turns.map(item => item.text)).toEqual(['Continue', 'First answer', 'Continue']);
  });
  it('replaces a legacy plain capture with its richer Markdown form without duplicating the turn', () => {
    const first = archiveWindow(undefined, [turn('assistant', 'Feature checklist\nInline editing', 0)]);
    const next = archiveWindow(first, [turn('assistant', '## Feature checklist\n- **Inline editing**', 0)]);
    expect(next.turns).toHaveLength(1);
    expect(next.turns[0].text).toContain('## Feature checklist');
  });
  it('replaces an assistant regeneration on the same native user branch', () => {
    const user = { ...turn('user', 'Build a planner', 0), id: 'u1' };
    const first = archiveWindow(undefined, [user, { ...turn('assistant', 'Old branch', 1), id: 'a1' }]);
    const next = archiveWindow(first, [user, { ...turn('assistant', 'Active regenerated branch', 1), id: 'a2' }]);
    expect(next.turns.map(item => item.text)).toEqual(['Build a planner', 'Active regenerated branch']);
  });
  it('does not retain descendants of an edited native user message', () => {
    const user = { ...turn('user', 'Use React', 0), id: 'u1' };
    const first = archiveWindow(undefined, [user, { ...turn('assistant', 'React implementation', 1), id: 'a1' }]);
    const next = archiveWindow(first, [{ ...user, text: 'Use plain JavaScript' }]);
    expect(next.turns.map(item => item.text)).toEqual(['Use plain JavaScript']);
  });
});
