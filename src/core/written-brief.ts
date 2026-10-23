/**
 * “Have this AI write the handoff”: Baton puts a brief-writing prompt in the source chat, the user sends it, and the
 * reply is checked before it goes anywhere. A model's summary reads better than Baton's own, but summaries drop or
 * invent details (Vectara: 1.8–12% hallucination; Factory: exact files and names are what every summarizer loses), so
 * the exact names and figures Baton collected from the chat are checked against it and any it left out are added back.
 */
export const HANDOFF_START = 'BATON HANDOFF';
export const HANDOFF_END = 'END OF HANDOFF';
export const writtenSections = ['GOAL', 'CONSTRAINTS', 'DECISIONS', 'REJECTED', 'CURRENT STATE', 'ARTIFACTS', 'EXACT DETAILS', 'OPEN QUESTIONS', 'NEXT STEP'] as const;

/** The prompt Baton types into the source chat (the user reads it and presses Send). */
export function briefPrompt(details: string[]): string {
  return [
    'Write a handoff of this whole conversation for another AI assistant that will continue my work without seeing this chat. Only write the handoff; don’t continue the task.',
    `Start with the line ${HANDOFF_START} and end with the line ${HANDOFF_END}. In between, use these sections in this order:`,
    'GOAL: what I’m trying to achieve, in my words where you can.',
    'CONSTRAINTS: every rule, preference and limit I set.',
    'DECISIONS: what we settled, each with its reason.',
    'REJECTED: what I turned down or what didn’t work, and why.',
    'CURRENT STATE: where the work stands now.',
    'ARTIFACTS: the latest version of any code, text or file we made, complete and verbatim, in code blocks.',
    `EXACT DETAILS: names, numbers, paths, links and versions that must stay exactly as they are.${details.length ? ` Include at least: ${details.join(' · ')}` : ''}`,
    'OPEN QUESTIONS: anything still unanswered.',
    'NEXT STEP: my latest request, quoted word for word, then what to do next.',
    'Keep facts apart from guesses, and don’t add anything that isn’t in this chat.'
  ].join('\n');
}

/** The handoff inside a reply, between the start and end lines (markdown emphasis around them allowed). */
export function findWrittenBrief(reply: string): { text: string; complete: boolean } | undefined {
  const start = reply.search(/(?:^|\n)[#*_\s>]*BATON HANDOFF\b/i);
  if (start < 0) return undefined;
  const body = reply.slice(start).replace(/^[\n#*_\s>]*BATON HANDOFF[*_]*\s*/i, '');
  const end = body.search(/(?:^|\n)[#*_\s>]*END OF HANDOFF\b/i);
  return { text: (end < 0 ? body : body.slice(0, end)).trim(), complete: end >= 0 };
}

export type BriefCheck = { kept: string[]; missing: string[]; sectionsMissing: string[]; latestQuoted: boolean };
const loose = (text: string) => text.toLowerCase().replace(/[`*_]/g, '').replace(/\s+/g, ' ');
/** Which exact details, sections and the latest request made it into the written handoff. */
export function checkWrittenBrief(brief: string, details: string[], latestRequest: string): BriefCheck {
  const text = loose(brief);
  const kept = details.filter(detail => text.includes(loose(detail)));
  const request = loose(latestRequest).trim();
  return {
    kept, missing: details.filter(detail => !kept.includes(detail)),
    sectionsMissing: writtenSections.filter(section => !new RegExp(`(?:^|\\n)[#*_\\s>-]*${section}\\b`, 'i').test(brief)),
    latestQuoted: !request || text.includes(request.slice(0, 120))
  };
}

/** The handoff as sent: the model's words, plus whatever the check found missing, taken verbatim from the chat. */
export function completeWrittenBrief(brief: string, check: BriefCheck, latestRequest: string): string {
  const added = [
    check.missing.length ? `EXACT DETAILS the summary left out (from the chat, verbatim): ${check.missing.join(' · ')}` : '',
    check.latestQuoted ? '' : `The user's latest request, word for word: “${latestRequest.trim()}”`
  ].filter(Boolean);
  return added.length ? `${brief}\n\n${added.join('\n\n')}` : brief;
}

/** One line for the user: how the written handoff did against the chat. */
export function checkSummary(check: BriefCheck, source: string): string {
  const total = check.kept.length + check.missing.length;
  return [
    total ? `${source}’s handoff kept ${check.kept.length} of ${total} exact names and figures${check.missing.length ? `; Baton added the other ${check.missing.length} back` : ''}.` : `${source} wrote the handoff.`,
    check.latestQuoted ? '' : 'Your latest request was added word for word.',
    check.sectionsMissing.length ? `Missing sections: ${check.sectionsMissing.map(section => section.toLowerCase()).join(', ')}.` : ''
  ].filter(Boolean).join(' ');
}

/** A chat captured after a written handoff: the prompt and its reply are Baton's, not the work, so they are left out. */
export function withoutHandoffRequests<T extends { role: string; text: string }>(turns: T[]): T[] {
  const isPrompt = (turn: T) => turn.role === 'user' && turn.text.trimStart().startsWith('Write a handoff of this whole conversation for another AI assistant');
  return turns.filter((turn, index) => !isPrompt(turn) && !(turn.role === 'assistant' && index > 0 && isPrompt(turns[index - 1])));
}
