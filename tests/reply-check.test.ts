import { describe, expect, it } from 'vitest';
import { checkReply, correction, handoffPoints, keyTerm, type HandoffPoints } from '../src/core/reply-check';
import { updateBrief } from '../src/core/brief';

const points: HandoffPoints = {
  rules: ['It must never delete anything, only move files.', 'Keep it local, no server.'],
  rejected: ['Redux, too heavy for this app', 'not argparse'],
  decisions: ['typer for the CLI'],
  latest: 'next I want the undo command that reads moves.log backwards',
  hadContext: true
};

describe('checking the next AI’s first reply', () => {
  it('finds the word a point is about', () => {
    expect(keyTerm('Redux, too heavy for this app')).toBe('redux');
    expect(keyTerm("Let's use typer for the CLI, not argparse")).toBe('cli');
    expect(keyTerm('not argparse')).toBe('argparse');
    expect(keyTerm('use `unique_target` instead')).toBe('unique_target');
  });
  it('passes a reply that continues the work and respects the handoff', () => {
    const good = 'Here is the undo command. It reads moves.log backwards and moves each file back, never deleting anything. With typer: @app.command() def undo(): ... We are not using argparse.';
    expect(checkReply(good, points)).toEqual([]);
  });
  it('catches a rejected approach brought back, a rule broken, and the latest request ignored', () => {
    const bad = 'Great question! For state management I recommend Redux with a server-side sync. You can delete duplicates to save space.';
    expect(checkReply(bad, points).map(miss => miss.kind)).toEqual(['rejected', 'rule', 'rule', 'latest']);
  });
  it('catches an acknowledgment-only reply and a request for context the handoff had', () => {
    expect(checkReply('Got it! I have the context. What would you like me to do next?', points).map(miss => miss.kind)).toContain('ack-only');
    expect(checkReply('Sure. Could you share the code for the move function so I can write the undo command for moves.log backwards?', points).map(miss => miss.kind)).toEqual(['asked-again']);
  });
  it('does not flag a term mentioned as something to avoid', () => {
    expect(checkReply('We will avoid Redux and keep it simple. The undo command reads moves.log backwards; no server needed and nothing gets deleted.', points)).toEqual([]);
  });
  it('writes a correction from only what was missed', () => {
    const text = correction(checkReply('I recommend Redux.', points));
    expect(text).toBe('Before you continue, a few corrections:\n- I turned this down earlier: Redux, too heavy for this app\n- My latest request, which is what to work on now: “next I want the undo command that reads moves.log backwards”\nPlease redo your answer with these in mind.');
  });
  it('takes the points from Baton’s brief of the source chat', () => {
    const brief = updateBrief(undefined, [
      { role: 'user', text: 'Build a todo app. Everything must stay on the device, no server.', index: 0 },
      { role: 'assistant', text: 'Use React and IndexedDB.', index: 1 },
      { role: 'user', text: 'next add due dates and a reminder', index: 2 }
    ], []);
    const found = handoffPoints(brief);
    expect(found.rules.join(' ')).toMatch(/no server/);
    expect(found.latest).toBe('next add due dates and a reminder');
  });
  it('does not call a short reply with substance an acknowledgment, and flags a latest request left aside', () => {
    const todo: HandoffPoints = { rules: ['Everything must stay on the device, no server.'], rejected: ['Redux, too heavy for this app'], decisions: [], latest: 'next add due dates and a reminder for each todo', hadContext: true };
    const misses = checkReply('Great! For state I recommend Redux with a small Node server to sync todos.', todo);
    expect(misses.map(miss => miss.kind)).toEqual(['rejected', 'rule', 'latest']);
    expect(misses[0].text).toBe('It may be suggesting Redux, which you turned down.');
  });
});
