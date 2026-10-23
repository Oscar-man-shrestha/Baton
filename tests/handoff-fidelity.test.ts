import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { encode } from 'gpt-tokenizer';
import { BRIEF_TOKENS, draftBudget, renderBrief, updateBrief, wrapHandoff } from '../src/core/brief';
import { archiveWindow } from '../src/core/capture';
import { fullContext, handoffDraft } from '../src/core/context-export';
import type { Turn } from '../src/core/adapter';

/**
 * Handoff fidelity: does what matters in a chat survive into the draft the next AI receives? Each conversation lists
 * facts that must carry over (goal, constraints, decisions, rejected approaches, the latest artifact and where the chat
 * stopped). Baton's one-click draft is compared with the full transcript and with what simpler tools send. String
 * checks are a transparent first pass; they show what is kept, not how well the next AI then continues.
 * Run `npm run eval:handoff` for the table.
 */
type Conversation = { id: string; kind: string; turns: [Turn['role'], string][]; checks: Record<string, string[]> };
const conversations = JSON.parse(readFileSync(new URL('../evaluation/handoff-conversations.json', import.meta.url), 'utf8')) as Conversation[];
const turnsOf = (conversation: Conversation): Turn[] => conversation.turns.map(([role, text], index) => ({ role, text, index }));

const methods: Record<string, (turns: Turn[]) => string> = {
  // What the Pass menu and the rescue card send in one click: the whole chat when it fits, else the compact brief.
  'Baton one-click': turns => handoffDraft(archiveWindow(undefined, turns, 0), updateBrief(undefined, turns, []), 'https://chat.example/c/1').draft,
  // The compact brief alone, as one-click sends it for a chat over the budget.
  'Baton compact brief': turns => wrapHandoff(renderBrief(updateBrief(undefined, turns, []), BRIEF_TOKENS).text),
  // Baton's full context: every captured message, for copying or when it fits.
  'Baton full context': turns => fullContext(archiveWindow(undefined, turns, 0), 'https://chat.example/c/1').draft,
  // A common shortcut: only the last question and answer.
  'Last exchange only': turns => turns.slice(-2).map(turn => turn.text).join('\n\n'),
  // A page-text grab: the first 3,000 characters of the page, sidebar chat titles first.
  'First 3,000 page characters': turns => ['New chat', 'Search chats', 'Recipe ideas for dinner', 'Fix my resume', 'Explain quantum computing', 'Birthday message for mom', 'SQL join help', ...turns.map(turn => turn.text)].join('\n').slice(0, 3000)
};

const score = (draft: string, checks: Record<string, string[]>) => {
  const text = draft.toLowerCase();
  const kept: Record<string, number> = {}, missing: string[] = [];
  let found = 0, total = 0;
  for (const [category, phrases] of Object.entries(checks)) {
    const hits = phrases.filter(phrase => text.includes(phrase.toLowerCase()));
    kept[category] = hits.length / phrases.length;
    found += hits.length; total += phrases.length;
    missing.push(...phrases.filter(phrase => !hits.includes(phrase)).map(phrase => `${category}: ${phrase}`));
  }
  return { retention: found / total, kept, missing };
};

export function handoffTable() {
  return Object.entries(methods).map(([method, build]) => {
    const rows = conversations.map(conversation => { const draft = build(turnsOf(conversation)); return { id: conversation.id, tokens: encode(draft).length, fits: draftBudget(draft).fits, ...score(draft, conversation.checks) }; });
    return { method, retention: rows.reduce((sum, row) => sum + row.retention, 0) / rows.length, maxTokens: Math.max(...rows.map(row => row.tokens)), fits: rows.filter(row => row.fits).length, rows };
  });
}

describe('handoff fidelity', () => {
  const table = handoffTable();
  const baton = table.find(row => row.method === 'Baton one-click')!;
  it('prints the comparison', () => {
    console.log(['', 'Method                        Kept   Fits the draft limit  Largest draft', ...table.map(row => `${row.method.padEnd(30)}${`${Math.round(row.retention * 100)}%`.padEnd(7)}${`${row.fits}/${conversations.length}`.padEnd(20)}${row.maxTokens} tokens`)].join('\n'));
    for (const method of table) for (const row of method.rows) if (row.missing.length && (method.method.startsWith('Baton') || row.id === 'marathon')) console.log(`${method.method}, ${row.id} (${row.tokens} tokens) missing → ${row.missing.join(' · ')}`);
  });
  it('keeps nearly everything that matters in the one-click draft, within the draft budget', () => {
    expect(baton.fits).toBe(conversations.length);
    // A chat that fits goes whole; only the long one is summarised, and the summary still keeps what matters.
    const compact = table.find(row => row.method === 'Baton compact brief')!;
    expect(compact.fits).toBe(conversations.length);
    expect(compact.retention).toBeGreaterThanOrEqual(0.95);
    expect(baton.retention).toBeGreaterThanOrEqual(0.98);
    for (const row of baton.rows) expect(row.retention, row.id).toBeGreaterThanOrEqual(0.9);
  });
  it('keeps every constraint, decision and rejected approach, wherever in the chat it was said', () => {
    for (const row of baton.rows) for (const category of ['goal', 'constraints', 'decisions', 'rejected']) expect(row.kept[category], `${row.id} ${category}: ${row.missing.join(', ')}`).toBe(1);
  });
});
