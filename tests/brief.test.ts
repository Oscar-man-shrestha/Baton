import { describe, expect, it } from 'vitest';
import { briefSchema, draftBudget, redact, renderBrief, updateBrief, wrapHandoff } from '../src/core/brief';
import { readFileSync } from 'node:fs';

describe('brief', () => {
  it('redacts seeded secret classes', () => {
    const input = 'sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456 sk-ant-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456 AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ12345678 eyJabc.eyJdef.signature -----BEGIN PRIVATE KEY-----\nSECRET\n-----END PRIVATE KEY----- postgres://alice:pass@host/db 4111 1111 1111 1111';
    const result = redact(input);
    expect(result.kinds).toEqual(expect.arrayContaining(['OpenAI key', 'Anthropic key', 'Google key', 'JWT', 'PEM private key', 'connection string', 'payment card']));
    expect(result.text).not.toContain('SECRET');
  });
  it('keeps the latest artifact and required fields when trimming', () => {
    const brief = briefSchema.parse({ goal: 'Project', preferences: ['Never send automatically'], open_tasks: ['Finish'], next_step: 'Review', weak_spots: Array(30).fill('old reasoning'), artifacts: [{ name: 'a', kind: 'code', content_verbatim: 'old', version: 1 }, { name: 'a', kind: 'code', content_verbatim: 'latest', version: 2 }] });
    const result = renderBrief(brief, 100);
    expect(result.text).toContain('latest');
    expect(result.text).toContain('Never send automatically');
    expect(result.receipt.dropped.length).toBeGreaterThan(0);
  });
  it('keeps the highest artifact version even when versions arrive out of order', () => {
    const brief = briefSchema.parse({ goal: 'Project', artifacts: [{ name: 'source', kind: 'code', content_verbatim: 'LATEST_SOURCE', version: 3 }, { name: 'source', kind: 'code', content_verbatim: 'old source', version: 1 }], weak_spots: Array(40).fill('old reasoning') });
    const rendered = renderBrief(brief, 60);
    expect(rendered.text).toContain('LATEST_SOURCE');
    expect(rendered.text).not.toContain('old source');
  });
  it('keeps the first user goal while updating the last exchange', () => {
    const brief = updateBrief(undefined, [{ role: 'user', text: 'Build a study planner', index: 0 }, { role: 'assistant', text: 'Plan drafted', index: 1 }, { role: 'user', text: 'Now add recurring tasks', index: 2 }], []);
    expect(brief.goal).toBe('Build a study planner');
    expect(brief.last_exchange.user).toBe('Now add recurring tasks');
  });
  it('renders a readable handoff note instead of raw JSON', () => {
    const brief = briefSchema.parse({ goal: 'Build a study planner', preferences: ['Keep tasks short'], next_step: 'Add recurring tasks' });
    const text = renderBrief(brief).text;
    expect(text).toContain('Goal: Build a study planner');
    expect(text).toContain('Preferences and constraints:\n- Keep tasks short');
    expect(text).toContain('Next step: Add recurring tasks');
    expect(text).not.toContain('"recommended_target"');
  });
  it('preserves fixture facts in local briefs before target-model evaluation', () => {
    const fixtures = JSON.parse(readFileSync(new URL('../evaluation/fixtures.json', import.meta.url), 'utf8')) as { id: string; conversation: string; checks: string[] }[];
    for (const fixture of fixtures) {
      const brief = updateBrief(undefined, [{ role: 'user', text: fixture.conversation, index: 0 }], []);
      const text = renderBrief(brief).text.toLowerCase();
      const missing = fixture.checks.filter(check => !text.includes(check.toLowerCase()));
      expect(missing, fixture.id).toEqual([]);
    }
  });
  it('tracks user decisions with provenance', () => {
    const result = updateBrief(undefined, [{ role: 'user', text: 'We decided to use WXT. Never auto-send.', index: 3 }], []);
    expect(result.decisions[0]?.status).toBe('ratified_by_user');
    expect(result.decisions[0]?.source_turn).toBe(3);
  });
  it('does not persist seeded secrets in the brief object', () => {
    const result = updateBrief(undefined, [{ role: 'user', text: 'Use sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456 for the demo', index: 0 }], []);
    expect(JSON.stringify(result)).not.toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZ123456');
  });
  it('keeps the latest artifact in an oversized brief, and knows when a draft is longer than every chat box', () => {
    const artifact = Array.from({ length: 2500 }, (_, i) => `line_${i}`).join(' ');
    const brief = briefSchema.parse({ goal: 'Keep the source intact', preferences: ['Never auto-send'], open_tasks: ['Review all lines'], next_step: 'Continue', artifacts: [{ name: 'source', kind: 'code', content_verbatim: artifact, version: 1 }] });
    const rendered = renderBrief(brief);
    expect(rendered.text).toContain('line_2499');
    expect(rendered.receipt.warnings).toContain('Required content exceeds the 3,000-token budget. Review or shorten it manually; latest artifact and constraints were retained.');
    expect(draftBudget(wrapHandoff(rendered.text)).fits).toBe(true);
    expect(draftBudget('x'.repeat(40000)).fits).toBe(false);
    expect(draftBudget('x'.repeat(40000), 'claude').fits).toBe(true);
    expect(draftBudget('Reviewed short draft').fits).toBe(true);
  });
  it('continues the user’s to-do app goal instead of truncating questions or requesting Ready', () => {
    const conversation = [
      { role: 'user' as const, text: 'HI i wanna build to do app', index: 0 },
      { role: 'assistant' as const, text: `Great! I'd love to help you build a to-do app. Let me ask a few questions so I can give you the best guidance:\n1. What's your experience level?\n2. What platform?\n3. What tech stack are you considering?\n4. What features do you want?\n5. Do you need persistence (saving data)?`, index: 1 }
    ];
    const brief = updateBrief(undefined, conversation, []);
    const draft = wrapHandoff(renderBrief(brief).text);
    expect(brief.goal).toBe('HI i wanna build to do app');
    expect(brief.open_questions).toHaveLength(5);
    expect(draft).toContain('What features do you want?');
    expect(draft).toContain('Do you need persistence (saving data)?');
    expect(draft).toContain('Pick up the work where it stopped');
    expect(draft).not.toContain('Reply only with Ready');
    expect(draftBudget(draft).fits).toBe(true);
  });
  it('carries actionable details from a long Gemini answer into the next chat', () => {
    const turns = [
      { role: 'user' as const, text: 'Hey I wanna make to do list beautiful that works in all edge cases', index: 0 },
      { role: 'assistant' as const, text: '## Handling the Edge Cases\n- Extremely Long Text: Wrap task names and avoid overflow.\n- Rapid-Fire Creation & Deletion: Use unique IDs.\n- Accidental Data Loss: Auto-save edits and persist to localStorage.\n## Feature Checklist\n- Inline Editing: edit task text.\n- Keyboard Shortcuts: Enter, Escape and undo delete.\n- Filtering Tabs: All, Active, Completed.\nWhat specific tech stack or platform are you planning to build this in?', index: 1 }
    ];
    const handoff = wrapHandoff(renderBrief(updateBrief(undefined, turns, [])).text);
    expect(handoff).toContain('Extremely Long Text');
    expect(handoff).toContain('Accidental Data Loss');
    expect(handoff).toContain('Inline Editing');
    expect(handoff).toContain('What specific tech stack or platform');
    expect(draftBudget(handoff).fits).toBe(true);
  });
  it('keeps the summary of a long chat lean: repeats collapse, problems are not rejections, detail fragments go', async () => {
    const { exactDetails } = await import('../src/core/brief');
    const turns = [
      { role: 'user' as const, text: 'Build tidy. It must never delete anything.', index: 0 },
      { role: 'user' as const, text: 'some files have no modified date that makes sense', index: 1 },
      { role: 'user' as const, text: 'some files have no modified date that makes sense (asking again, round 2, with more detail please)', index: 2 },
      { role: 'user' as const, text: 'we decided to use typer for the CLI, not argparse', index: 3 },
      { role: 'assistant' as const, text: 'Install with `pipx install .` from the project folder.', index: 4 },
      { role: 'assistant' as const, text: 'Once it is public: https://github.com/you/tidy` works.', index: 5 },
      { role: 'assistant' as const, text: 'Config in `[folders]` with `pdf = \'Documents\'`; code in src/tidy/ (also src/tidy) and logs in ~/.tidy/moves.log (.tidy/moves.log).', index: 6 }
    ];
    const brief = updateBrief(undefined, turns, []);
    expect(brief.rejected_approaches).toEqual(['we decided to use typer for the CLI, not argparse']);
    expect(brief.user_messages).toEqual(['Build tidy. It must never delete anything.', 'some files have no modified date that makes sense (asked 2 times)', 'we decided to use typer for the CLI, not argparse']);
    const details = exactDetails(turns);
    expect(details).toContain('pipx install');
    expect(details).toContain("pdf = 'Documents'");
    expect(details).toContain('https://github.com/you/tidy');
    expect(details.filter(item => item.startsWith('src/tidy'))).toHaveLength(1);
    expect(details).toContain('~/.tidy/moves.log');
    expect(details.filter(item => /^\/github|^\.tidy\/|`$/.test(item))).toEqual([]);
  });
});
