import { captureCheck, type TurnArchive } from './capture';
import { BRIEF_TOKENS, draftBudget, redact, renderBrief, wrapHandoff, type Brief } from './brief';
import type { ProviderId } from './selectors';
import { withoutHandoffRequests } from './written-brief';
import { encode } from 'gpt-tokenizer';

/**
 * The full export is never shortened to make a budget appear to fit. A selection says so, so the next AI knows the rest
 * was left out on purpose (and, with `question`, that its first message is the question the selected reply answers).
 */
/** Names from the “[Files: …]” lines capture adds to a message. */
export function files(turns: { text: string }[]): string[] {
  return [...new Set(turns.flatMap(turn => [...turn.text.matchAll(/^\[Files: (.+)\]$/gm)].flatMap(match => match[1].split(', '))))];
}

export function fullContext(archive: TurnArchive, sourceUrl: string, selection?: { question: boolean }): { text: string; draft: string; tokens: number; redactions: string[] } {
  let source = 'Saved chat';
  try { const url = new URL(sourceUrl); source = `${url.origin}${url.pathname}`; } catch { /* Imported records may have no URL. */ }
  const notes = [
    selection ? '# Selected part of a conversation' : '# Captured conversation',
    `Source: ${source}`,
    `Saved: ${new Date(archive.savedAt).toISOString()}`,
    `Messages: ${captureCheck(archive.turns).text}`,
    `Coverage: ${selection ? `Only the part the user selected${selection.question ? ', after the question it answers (message 1)' : ''}; the rest of the chat is left out.` : archive.truncated ? 'Storage cap reached; earlier text was trimmed.' : archive.incomplete ? 'Some rendered windows may be missing or out of order.' : 'Collected rendered text; history never rendered by the service may be missing.'}`,
    ...(files(archive.turns).length ? [`Files in the chat (not attached here; ask the user to share any you need): ${files(archive.turns).join(', ')}`] : []),
    ...withoutHandoffRequests(archive.turns).map((turn, index) => `## ${index + 1}. ${turn.role === 'user' ? 'You' : 'Assistant'}\n\n${turn.text}`)
  ];
  const safe = redact(notes.join('\n\n'));
  const draft = wrapHandoff(safe.text);
  return { text: safe.text, draft, tokens: encode(draft).length, redactions: safe.kinds };
}

/**
 * The one-click handoff: the whole conversation when it fits the destination's draft limit (nothing lost), otherwise the compact
 * brief, which keeps the goal, everything the user said, decisions, the latest code and where the chat stopped.
 */
export function handoffDraft(archive: TurnArchive, brief: Brief, sourceUrl: string, target?: ProviderId): { draft: string; mode: 'full' | 'compact' } {
  const full = fullContext(archive, sourceUrl).draft;
  if (draftBudget(full, target).fits) return { draft: full, mode: 'full' };
  return { draft: redact(wrapHandoff(renderBrief(brief, BRIEF_TOKENS).text)).text, mode: 'compact' };
}
