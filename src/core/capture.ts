import type { Turn } from './adapter';

const key = (turn: Turn) => `${turn.role}\u0000${turn.text}`;

/** Merge an older visible window ahead of the turns already captured. */
export function mergeTurnWindows(older: Turn[], accumulated: Turn[]): Turn[] {
  if (!accumulated.length) return older.map((turn, index) => ({ ...turn, index }));
  if (!older.length) return accumulated.map((turn, index) => ({ ...turn, index }));

  let overlap = 0;
  const max = Math.min(older.length, accumulated.length);
  for (let length = max; length > 0; length--) {
    if (older.slice(-length).every((turn, index) => key(turn) === key(accumulated[index]))) {
      overlap = length;
      break;
    }
  }
  const joined = overlap ? [...older.slice(0, -overlap), ...accumulated] : [...older, ...accumulated];
  return joined.map((turn, index) => ({ ...turn, index }));
}

export type TurnArchive = { turns: Turn[]; incomplete: boolean; truncated: boolean; savedAt: number };
export const ARCHIVE_CHAR_CAP = 300_000;

/** Accumulate rendered windows in either scroll direction without duplicating an overlap. */
export function archiveWindow(previous: TurnArchive | undefined, visible: Turn[], now = Date.now()): TurnArchive {
  const prior = previous?.turns || [];
  const same = (a: Turn, b: Turn) => key(a) === key(b);
  const contains = (longer: Turn[], shorter: Turn[]) => longer.some((_, start) => shorter.length <= longer.length - start && shorter.every((turn, offset) => same(turn, longer[start + offset])));
  let turns: Turn[];
  let gap = false;
  if (!prior.length) turns = [...visible];
  else if (!visible.length || contains(prior, visible)) turns = [...prior];
  else if (contains(visible, prior)) turns = [...visible];
  else {
    let merged: Turn[] | undefined;
    for (let size = Math.min(prior.length, visible.length); size > 0; size--) {
      if (prior.slice(-size).every((turn, index) => same(turn, visible[index]))) { merged = [...prior, ...visible.slice(size)]; break; }
      if (visible.slice(-size).every((turn, index) => same(turn, prior[index]))) { merged = [...visible, ...prior.slice(size)]; break; }
    }
    gap = !merged;
    turns = merged || [...prior, ...visible];
  }
  let length = turns.reduce((sum, turn) => sum + turn.text.length, 0);
  let truncated = previous?.truncated || false;
  while (length > ARCHIVE_CHAR_CAP && turns.length > 1) { length -= turns[0].text.length; turns.shift(); truncated = true; }
  if (length > ARCHIVE_CHAR_CAP && turns.length) { turns[0] = { ...turns[0], text: turns[0].text.slice(-ARCHIVE_CHAR_CAP) }; truncated = true; }
  return { turns: turns.map((turn, index) => ({ ...turn, index })), incomplete: (previous?.incomplete || false) || gap, truncated, savedAt: now };
}
