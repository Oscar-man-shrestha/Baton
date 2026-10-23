// Writes the one-click draft Baton would send for each benchmark conversation, to paste into an AI for the live check.
// Run: npm run eval:drafts   (see evaluation/README.md, “Live check”)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { encode } from 'gpt-tokenizer';
import { updateBrief } from '../src/core/brief';
import { archiveWindow } from '../src/core/capture';
import { handoffDraft } from '../src/core/context-export';
import type { Turn } from '../src/core/adapter';

type Conversation = { id: string; turns: [Turn['role'], string][] };
const root = new URL('../evaluation/', import.meta.url);
const conversations = JSON.parse(readFileSync(new URL('handoff-conversations.json', root), 'utf8')) as Conversation[];
mkdirSync(new URL('live/drafts/', root), { recursive: true });
for (const conversation of conversations) {
  const turns: Turn[] = conversation.turns.map(([role, text], index) => ({ role, text, index }));
  // A fixed date and address, so the drafts only change when Baton's handoff does.
  const { draft, mode } = handoffDraft(archiveWindow(undefined, turns, Date.UTC(2026, 9, 23)), updateBrief(undefined, turns, []), 'https://chat.example/c/benchmark');
  writeFileSync(new URL(`live/drafts/${conversation.id}.txt`, root), `${draft}\n`);
  console.log(`${conversation.id.padEnd(15)} ${mode === 'full' ? 'whole chat   ' : 'compact brief'} ${encode(draft).length} tokens`);
}
