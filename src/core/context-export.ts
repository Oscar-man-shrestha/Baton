import type { TurnArchive } from './capture';
import { redact, wrapHandoff } from './brief';
import { encode } from 'gpt-tokenizer';

/** The full export is never shortened to make a budget appear to fit. */
export function fullContext(archive: TurnArchive, sourceUrl: string): { text: string; draft: string; tokens: number; redactions: string[] } {
  let source = 'Saved chat';
  try { const url = new URL(sourceUrl); source = `${url.origin}${url.pathname}`; } catch { /* Imported records may have no URL. */ }
  const notes = [
    '# Captured conversation',
    `Source: ${source}`,
    `Saved: ${new Date(archive.savedAt).toISOString()}`,
    `Messages: ${archive.turns.length}`,
    `Coverage: ${archive.truncated ? 'Storage cap reached; earlier text was trimmed.' : archive.incomplete ? 'Some rendered windows may be missing or out of order.' : 'Collected rendered text; history never rendered by the service may be missing.'}`,
    ...archive.turns.map((turn, index) => `## ${index + 1}. ${turn.role === 'user' ? 'You' : 'Assistant'}\n\n${turn.text}`)
  ];
  const safe = redact(notes.join('\n\n'));
  const draft = wrapHandoff(safe.text);
  return { text: safe.text, draft, tokens: encode(draft).length, redactions: safe.kinds };
}
