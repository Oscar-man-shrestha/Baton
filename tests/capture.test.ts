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
});
