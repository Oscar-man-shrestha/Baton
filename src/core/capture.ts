import type { Turn } from './adapter';

const comparableText = (text: string) => text.replace(/^\s*#{1,6}\s+|^\s*(?:[-*]|\d+[.)])\s+|^\s*`{3,}[^\n]*$/gm, '').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
const identical = (a: Turn, b: Turn): boolean => a.role === b.role && (a.id && b.id ? a.id === b.id : a.text === b.text || comparableText(a.text) === comparableText(b.text));
const growingReply = (a: Turn, b: Turn): boolean => a.role === 'assistant' && b.role === 'assistant'
  && !(a.id && b.id && a.id !== b.id) && Math.min(a.text.length, b.text.length) >= 32
  && (a.text.startsWith(b.text) || b.text.startsWith(a.text));

/** Text prefixes are only evidence when a neighboring user turn anchors the reply. */
function sameWindow(a: Turn[], b: Turn[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((turn, index) => identical(turn, b[index]) || (index > 0 && growingReply(turn, b[index])
    && a[index - 1].role === 'user' && identical(a[index - 1], b[index - 1])));
}

function latest(a: Turn, b: Turn): Turn {
  const text = a.role === 'assistant' && a.text.startsWith(b.text) ? a.text : b.text;
  return { ...a, ...b, id: b.id || a.id, text };
}

function reconcile(prior: Turn[], incoming: Turn[]): { turns: Turn[]; gap: boolean } {
  if (!prior.length) return { turns: incoming, gap: false };
  if (!incoming.length) return { turns: prior, gap: false };
  if (incoming.length <= prior.length) {
    for (let start = 0; start <= prior.length - incoming.length; start++) {
      const window = prior.slice(start, start + incoming.length);
      if (sameWindow(window, incoming)) return { turns: [...prior.slice(0, start), ...incoming.map((turn, i) => latest(window[i], turn)), ...prior.slice(start + incoming.length)], gap: false };
    }
  }
  if (prior.length <= incoming.length) {
    for (let start = 0; start <= incoming.length - prior.length; start++) {
      const window = incoming.slice(start, start + prior.length);
      if (sameWindow(prior, window)) return { turns: [...incoming.slice(0, start), ...window.map((turn, i) => latest(prior[i], turn)), ...incoming.slice(start + prior.length)], gap: false };
    }
  }
  for (let size = Math.min(prior.length, incoming.length); size > 0; size--) {
    const tail = prior.slice(-size), head = incoming.slice(0, size);
    if (sameWindow(tail, head)) return { turns: [...prior.slice(0, -size), ...head.map((turn, i) => latest(tail[i], turn)), ...incoming.slice(size)], gap: false };
    const olderTail = incoming.slice(-size), priorHead = prior.slice(0, size);
    if (sameWindow(priorHead, olderTail)) return { turns: [...incoming.slice(0, -size), ...olderTail.map((turn, i) => latest(priorHead[i], turn)), ...prior.slice(size)], gap: false };
  }
  // A regenerated branch can retain the user ID while replacing the assistant ID.
  // Native identity is required here: repeated text alone must not erase a reply.
  for (let index = 0; index < incoming.length; index++) {
    const turn = incoming[index];
    if (!turn.id) continue;
    const start = prior.findIndex(old => old.id === turn.id && old.role === turn.role);
    if (start < 0) continue;
    const prefix = reconcile(prior.slice(0, start), incoming.slice(0, index));
    return { turns: [...prefix.turns, ...incoming.slice(index)], gap: prefix.gap };
  }
  // No global text deduplication: identical prompts can be legitimate separate turns.
  return { turns: [...prior, ...incoming], gap: true };
}

/** Merge a visible window using native message IDs or context-anchored text overlap. */
export function mergeTurnWindows(older: Turn[], accumulated: Turn[]): Turn[] {
  return reconcile(older, accumulated).turns.map((turn, index) => ({ ...turn, index }));
}

export type TurnArchive = { turns: Turn[]; incomplete: boolean; truncated: boolean; savedAt: number; selectorsVersion?: number };
export const ARCHIVE_CHAR_CAP = 300_000;

/** Keep full captured text separate from any compact handoff or summary. */
export function archiveWindow(previous: TurnArchive | undefined, visible: Turn[], now = Date.now()): TurnArchive {
  let prior = previous?.turns || [];
  // An edited prompt invalidates the old descendants even if only the edited
  // turn has mounted so far; do not seed the next AI with the obsolete branch.
  const edited = visible.find(turn => turn.id && turn.role === 'user' && prior.some(old => old.id === turn.id && comparableText(old.text) !== comparableText(turn.text)));
  if (edited) prior = prior.slice(0, prior.findIndex(turn => turn.id === edited.id));
  const joined = reconcile(prior, visible);
  const turns = [...joined.turns];
  let length = turns.reduce((sum, turn) => sum + turn.text.length, 0);
  let truncated = previous?.truncated || false;
  while (length > ARCHIVE_CHAR_CAP && turns.length > 1) { length -= turns[0].text.length; turns.shift(); truncated = true; }
  if (length > ARCHIVE_CHAR_CAP && turns.length) { turns[0] = { ...turns[0], text: turns[0].text.slice(-ARCHIVE_CHAR_CAP) }; truncated = true; }
  return { turns: turns.map((turn, index) => ({ ...turn, index })), incomplete: (previous?.incomplete || false) || joined.gap, truncated, savedAt: now };
}
