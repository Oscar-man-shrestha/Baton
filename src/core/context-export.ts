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

const aiNames: Record<string, string> = { 'chatgpt.com': 'ChatGPT', 'claude.ai': 'Claude', 'gemini.google.com': 'Gemini', 'chat.deepseek.com': 'DeepSeek', 'grok.com': 'Grok', 'www.perplexity.ai': 'Perplexity' };
/** Past this length a transcript gets its key points on top and the latest request again at the end: models read the
 * start and end of a long input best and the middle worst (Liu et al., “Lost in the Middle”, 2023). */
export const anchoredFrom = 8000;

/**
 * The whole chat as the next AI reads it: who said what (“User”, “Assistant (ChatGPT)”, never “You”, which the next AI
 * could take for itself), how it was captured, the files, and for a long chat its key points first and the latest
 * request repeated last.
 */
export function fullContext(archive: TurnArchive, sourceUrl: string, selection?: { question: boolean }, brief?: Brief): { text: string; draft: string; tokens: number; redactions: string[] } {
  let source = 'Saved chat', ai = '';
  try { const url = new URL(sourceUrl); source = `${url.origin}${url.pathname}`; ai = aiNames[url.hostname] || ''; } catch { /* Imported records may have no URL. */ }
  const turns = withoutHandoffRequests(archive.turns);
  const transcript = turns.map((turn, index) => `## ${index + 1}. ${turn.role === 'user' ? 'User' : ai ? `Assistant (${ai})` : 'Assistant'}\n\n${turn.text}`);
  const long = !selection && !!brief && transcript.join('\n\n').length > anchoredFrom;
  const latest = [...turns].reverse().find(turn => turn.role === 'user')?.text.trim() || '';
  const list = (label: string, items: string[]) => items.length ? `${label}:\n${items.map(item => `- ${item}`).join('\n')}` : '';
  const keyPoints = long && brief ? ['## Key points (from the whole chat below)', brief.goal ? `Goal: ${brief.goal}` : '', list('Rules', brief.preferences.slice(0, 8)), list('Decided', brief.decisions.filter(item => item.status !== 'superseded').map(item => item.text).slice(0, 8)), list('Turned down', brief.rejected_approaches.slice(0, 8)), brief.exact_details.length ? `Exact names and figures: ${brief.exact_details.slice(0, 30).join(' · ')}` : ''].filter(Boolean).join('\n\n') : '';
  const notes = [
    selection ? '# Selected part of a conversation' : '# Captured conversation',
    `Source: ${ai ? `${ai}, ` : ''}${source}`,
    `Saved: ${new Date(archive.savedAt).toISOString()}`,
    `Messages: ${captureCheck(archive.turns).text}`,
    `Coverage: ${selection ? `Only the part the user selected${selection.question ? ', after the question it answers (message 1)' : ''}; the rest of the chat is left out.` : archive.truncated ? 'Storage cap reached; earlier text was trimmed.' : archive.incomplete ? 'Some messages may be missing; check the order before relying on it.' : 'The whole conversation, in order.'}`,
    ...(files(archive.turns).length ? [`Files in the chat: ${files(archive.turns).join(', ')}. Some may be attached to this message; ask the user for any you need that aren't.`] : []),
    ...(keyPoints ? [keyPoints] : []),
    ...transcript,
    ...(long && latest ? [`## Where it stopped\n\nThe user's latest request, word for word: “${latest.length > 1500 ? `${latest.slice(0, 1500)}…` : latest}”`] : [])
  ];
  const safe = redact(notes.join('\n\n'));
  const draft = wrapHandoff(safe.text);
  return { text: safe.text, draft, tokens: encode(draft).length, redactions: safe.kinds };
}

/**
 * The one-click handoff: the whole conversation when it fits the destination's draft limit (nothing lost), otherwise the compact
 * brief, which keeps the goal, everything the user said, decisions, the latest code and where the chat stopped.
 */
/** The summary handoff, saying what it was made from so the next AI knows how much there was and that it was whole. */
export function compactDraft(archive: TurnArchive, brief: Brief): string {
  const summary = renderBrief(brief, BRIEF_TOKENS).text.replace(/^PROJECT HANDOFF\n/, `PROJECT HANDOFF\n\nMade from: ${captureCheck(archive.turns).text}. A summary, because the chat is too long to send whole.\n`);
  return redact(wrapHandoff(summary)).text;
}

export function handoffDraft(archive: TurnArchive, brief: Brief, sourceUrl: string, target?: ProviderId): { draft: string; mode: 'full' | 'compact' } {
  const full = fullContext(archive, sourceUrl, undefined, brief).draft;
  if (draftBudget(full, target).fits) return { draft: full, mode: 'full' };
  return { draft: compactDraft(archive, brief), mode: 'compact' };
}

/**
 * Any length goes. What the chat box gets, and what is attached: the whole text when it fits the destination's box;
 * otherwise the summary typed with the whole text attached; and if even the summary is too long, a short note typed
 * with everything attached. Nothing is cut and nothing is refused.
 */
export function fitToBox(full: string, summary: string | undefined, target: ProviderId, file: { name: string; text: string }): { draft: string; attach?: { name: string; text: string } } {
  if (draftBudget(full, target).fits) return { draft: full };
  const pointer = `\n\nAttached: “${file.name}”, the complete conversation word for word. Check it for anything the summary above leaves out.`;
  if (summary && draftBudget(summary + pointer, target).fits) return { draft: summary + pointer, attach: file };
  return { draft: wrapHandoff(`The whole conversation is attached as “${file.name}”. Read it first: it is the complete record, word for word.`), attach: file };
}
