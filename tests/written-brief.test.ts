import { describe, expect, it, vi } from 'vitest';
import { briefPrompt, checkSummary, checkWrittenBrief, completeWrittenBrief, findWrittenBrief, withoutHandoffRequests, writtenSections } from '../src/core/written-brief';
import { updateBrief } from '../src/core/brief';
import { fullContext } from '../src/core/context-export';
import { saveWrittenBrief } from '../src/core/capsules';
import { listProjects } from '../src/core/projects';

const details = ['unique_target', 'moves.log', '~/.tidy/moves.log', 'typer'];
const reply = `Sure, here it is.

**BATON HANDOFF**
GOAL: a Python CLI called tidy that tidies Downloads.
CONSTRAINTS: never delete anything.
DECISIONS: use \`typer\`, not argparse.
REJECTED: argparse.
CURRENT STATE: moves are logged to \`~/.tidy/moves.log\`.
ARTIFACTS:
\`\`\`python
def plan_moves(folder): ...
\`\`\`
EXACT DETAILS: moves.log
OPEN QUESTIONS: none.
NEXT STEP: "next I want the undo command", then read the log backwards.
**END OF HANDOFF**`;

describe('a handoff the source AI writes', () => {
  it('asks for every section, both marker lines and the exact details', () => {
    const prompt = briefPrompt(details);
    for (const section of writtenSections) expect(prompt).toContain(`${section}:`);
    expect(prompt).toContain('BATON HANDOFF');
    expect(prompt).toContain('END OF HANDOFF');
    expect(prompt).toContain('unique_target · moves.log');
    expect(prompt).toMatch(/don.t continue the task/i);
  });
  it('keeps names with brackets whole', async () => {
    const { exactDetails } = await import('../src/core/brief');
    expect(exactDetails([{ role: 'assistant', text: 'I wrote `unique_target(path)` (see src/tidy/cli.py).', index: 0 }])).toEqual(['unique_target(path)', 'src/tidy/cli.py']);
  });
  it('finds the handoff in the reply, also while it is still being written', () => {
    expect(findWrittenBrief(reply)).toEqual({ text: expect.stringMatching(/^GOAL: a Python CLI[\s\S]*the log backwards\.$/), complete: true });
    expect(findWrittenBrief(reply.slice(0, reply.indexOf('OPEN QUESTIONS')))?.complete).toBe(false);
    expect(findWrittenBrief('A normal reply about BATON HANDOFF in passing')).toBeUndefined();
  });
  it('checks it against the exact details and the latest request, and adds back what is missing', () => {
    const brief = findWrittenBrief(reply)!.text;
    const check = checkWrittenBrief(brief, details, 'next I want the undo command');
    expect(check.kept).toEqual(['moves.log', '~/.tidy/moves.log', 'typer']);
    expect(check.missing).toEqual(['unique_target']);
    expect(check.sectionsMissing).toEqual([]);
    expect(check.latestQuoted).toBe(true);
    const complete = completeWrittenBrief(brief, check, 'next I want the undo command');
    expect(complete).toContain('EXACT DETAILS the summary left out (from the chat, verbatim): unique_target');
    expect(checkSummary(check, 'Claude')).toBe('Claude’s handoff kept 3 of 4 exact names and figures; Baton added the other 1 back.');
    const vague = checkWrittenBrief('GOAL: tidy files', details, 'next I want the undo command');
    expect(vague.latestQuoted).toBe(false);
    expect(vague.sectionsMissing).toContain('NEXT STEP');
    expect(completeWrittenBrief('GOAL: tidy files', vague, 'next I want the undo command')).toContain('The user\'s latest request, word for word: “next I want the undo command”');
  });
  it('leaves the request and its reply out of later captures of the chat', () => {
    const turns = [
      { role: 'user' as const, text: 'Build tidy, never delete anything.', index: 0 },
      { role: 'assistant' as const, text: 'Done.', index: 1 },
      { role: 'user' as const, text: briefPrompt(details), index: 2 },
      { role: 'assistant' as const, text: reply, index: 3 }
    ];
    expect(withoutHandoffRequests(turns).map(turn => turn.index)).toEqual([0, 1]);
    expect(updateBrief(undefined, turns, []).user_messages).toEqual(['Build tidy, never delete anything.']);
    expect(fullContext({ turns, incomplete: false, truncated: false, savedAt: 0 }, 'https://claude.ai/chat/1').text).not.toContain('BATON HANDOFF');
  });
  it('is saved as a baton whose draft is the checked handoff', async () => {
    const store: Record<string, unknown> = {};
    vi.stubGlobal('chrome', { storage: { local: { get: async (key: string) => ({ [key]: store[key] }), set: async (value: object) => Object.assign(store, value) } } });
    try {
      const saved = await saveWrittenBrief('GOAL: tidy\n\nEXACT DETAILS: moves.log', [{ role: 'user', text: 'Build tidy', index: 0 }], 'https://claude.ai/chat/1', 'Tidy CLI - Claude');
      expect(saved.id).toMatch(/^written:/);
      expect(saved.draft).toContain('EXACT DETAILS: moves.log');
      expect(saved.draft).toContain('Pick up the work where it stopped');
      expect((await listProjects())[0].name).toBe('Tidy CLI - Claude');
    } finally { vi.unstubAllGlobals(); }
  });
});
