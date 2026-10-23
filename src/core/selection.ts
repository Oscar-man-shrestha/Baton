import type { Turn } from './adapter';

/** A baton made from a selection is named after its first words: your question when it holds one, else the reply. */
export function selectionName(turns: Turn[], max = 60): string {
  const source = turns.find(turn => turn.role === 'user') || turns[0];
  const line = (source?.text || '').split('\n').map(text => text
    .replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+|`{3,}.*$)/, '')
    .replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim()).find(Boolean) || '';
  if (!line) return 'Selected part of a chat';
  if (line.length <= max) return line;
  const cut = line.lastIndexOf(' ', max - 1);
  return `${line.slice(0, cut > max / 2 ? cut : max - 1).replace(/[\s,;:.–—-]+$/, '')}…`;
}

/** “2 messages · 1,240 characters”, shown in the save card so you can see what the baton will hold. */
export function selectionSummary(turns: Turn[]): string {
  const characters = turns.reduce((sum, turn) => sum + turn.text.length, 0);
  return `${turns.length} ${turns.length === 1 ? 'message' : 'messages'} · ${characters.toLocaleString('en-US')} characters`;
}
