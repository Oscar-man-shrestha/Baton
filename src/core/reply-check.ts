import type { Brief } from './brief';

/**
 * Receiving-side check: after the next AI's first reply to a handoff, did it take the handoff in? No other handoff tool
 * looks past the paste. The checks are deliberately narrow, each a known way handoffs fail (Laban et al. 2025 on
 * models losing earlier turns; reviews of handoff tools): bringing back what the user turned down, going against a rule
 * the user set, not taking up the latest request, asking for context the handoff already gave, and only acknowledging.
 * Text heuristics can be wrong, so each finding is worded as “may”, and nothing is sent without the user.
 */
export type HandoffPoints = { rules: string[]; rejected: string[]; decisions: string[]; latest: string; hadContext: boolean };
export type Miss = { kind: 'rejected' | 'rule' | 'latest' | 'asked-again' | 'ack-only'; text: string; point?: string };

const stop = new Set('about above after again also another because been before being both could does doing done each from have having here into itself just like make more most much need only other over same should some such than that their them then there these they this those through very want what when where which while will with without would your yours please thanks first next want using used make sure keep still able going really maybe something anything everything'.split(' '));
const words = (text: string) => (text.toLowerCase().match(/[a-z][a-z0-9+#.-]{3,}/g) || []).map(word => word.replace(/[.-]+$/, '')).filter(word => !stop.has(word));
// A negation reaches to the end of its clause only (“Koto no Yume, and buy a JR pass” still recommends the pass).
const negation = /\b(?:not|never|no|don['’]t|do not|without|avoid|instead of|rather than|skip|drop(?:ped)?|rejected|turned down|won['’]t|isn['’]t|aren['’]t)\b[^.!?\n,;]{0,40}$/i;

/** The handoff's points worth checking, from Baton's brief of the source chat. */
export function handoffPoints(brief: Brief): HandoffPoints {
  const rules = [...brief.preferences, ...brief.user_messages.flatMap(message => message.split(/(?<=[.!?])\s+|\n+/))]
    .map(text => text.trim()).filter(text => /\b(?:never|don['’]t|do not|no|without|avoid|must not|only)\b/i.test(text) && text.length <= 160);
  return {
    rules: [...new Set(rules)].slice(0, 8),
    rejected: brief.rejected_approaches.slice(0, 8),
    decisions: brief.decisions.filter(item => item.status !== 'superseded').map(item => item.text).slice(0, 8),
    latest: brief.last_exchange.user || brief.user_messages[brief.user_messages.length - 1] || '',
    hadContext: brief.artifacts.length > 0 || brief.user_messages.length > 1
  };
}

/** The word a point is about: `code`, “quoted”, a Name, or the word after a “not/never/no”. */
export function keyTerm(text: string): string | undefined {
  const code = text.match(/`([^`]{2,40})`/)?.[1] || text.match(/[“"']([^“”"']{2,40})[”"']/)?.[1];
  if (code) return code.toLowerCase();
  // The thing turned down is what follows the “not/no/skip”, past filler words: “skip the JR pass” → “jr”, “don't make it
  // sound cheesy” → “cheesy”, “use typer for the CLI, not argparse” → “argparse”. Measured on real chats, where taking
  // the first Name instead gave “the”, “make” and “CLI”.
  const negated = text.match(/\b(?:not|never|no|don['’]t|do not|without|avoid|instead of|rather than|skip|drop)\s+([^.,;:!?\n]{1,60})/i)?.[1];
  if (negated) {
    const filler = /^(?:use|using|a|an|the|any|more|some|it|its|this|that|make|makes|making|sound|sounds|be|do|go|get|have|want|like|need|words?|like)$/i;
    const found = (negated.match(/[A-Za-z][\w+#.-]*/g) || []).find(word => !filler.test(word) && (word.length >= 3 || /^[A-Z]{2}$/.test(word)));
    if (found) return found.toLowerCase().replace(/[.,;:]+$/, '');
  }
  const name = text.match(/^([A-Z][\w+#.-]{2,})\b/)?.[1] || text.slice(1).match(/\b([A-Z][\w+#.-]{2,}|[a-z]+[A-Z][\w]*)\b/)?.[1];
  const term = name || words(text).sort((a, b) => b.length - a.length)[0];
  return term?.toLowerCase().replace(/[.,;:]+$/, '');
}

/** Whether the reply brings a term up as something to do (not as something to avoid). */
// Advice wording right before a term: “you can delete…”, “I recommend Redux”, “let's add a server”.
const advice = /\b(?:you can|you could|you should|you might|let['’]s|we['’]ll|we will|i['’]ll|i will|i['’]d|i would|i recommend|i suggest|recommend|suggest|try|just|simply|go with|switch to|use|add|run)\b[^.!?\n]{0,40}$/i;
/** Whether the reply brings a term up as something to do (not as something to avoid); `asAdvice` needs advice wording. */
function recommends(reply: string, term: string, asAdvice = false): boolean {
  const lower = reply.toLowerCase();
  const boundary = (at: number) => !/[a-z0-9]/.test(lower[at - 1] || ' ') && !/[a-z0-9]/.test(lower[at + term.length] || ' ') || term.length > 4;
  for (let at = lower.indexOf(term); at >= 0; at = lower.indexOf(term, at + term.length)) {
    const before = lower.slice(Math.max(0, lower.lastIndexOf('\n', at) + 1, at - 60), at);
    if (boundary(at) && !negation.test(before) && (!asAdvice || advice.test(before))) return true;
  }
  return false;
}

export function checkReply(reply: string, points: HandoffPoints): Miss[] {
  const misses: Miss[] = [];
  const text = reply.trim();
  if (!text) return misses;
  // Only an acknowledgment: a short reply that asks what to do next, or a very short “Got it” / “Understood”.
  if ((text.length < 300 && /what would you like (?:me )?to do|how can i help|let me know (?:what|how)|ready when you are|what should we (?:do|work on)/i.test(text))
    || (text.split(/\s+/).length <= 10 && /^(?:got it|understood|sure|okay|ok|great|thanks|perfect|noted|i(?:['’]m| am) ready|i have (?:the|your) context)\b/i.test(text)))
    misses.push({ kind: 'ack-only', text: 'It only acknowledged the handoff instead of continuing the work.' });
  for (const point of points.rejected) {
    const term = keyTerm(point);
    // Named as the user wrote it (“Redux”, not “redux”).
    if (term && term.length >= 2 && recommends(text, term)) misses.push({ kind: 'rejected', text: `It may be suggesting ${point.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))?.[0] || term}, which you turned down.`, point });
  }
  for (const point of points.rules) {
    const term = point.match(/\b(?:never|don['’]t|do not|no|without|avoid|must not)\s+(?:use\s+|using\s+|a\s+|an\s+|the\s+|any\s+)?([a-z][\w-]{2,})/i)?.[1]?.toLowerCase();
    // A rule is only at risk when the reply advises the action: saying “nothing is deleted” or “removing them is a delete,
    // so I left it out” is the rule kept (8 of 12 real replies were wrongly flagged before this).
    if (term && !stop.has(term) && recommends(text, term, true)) misses.push({ kind: 'rule', text: `It may go against your rule: “${point}”`, point });
  }
  // The latest request: most of its content words should come up in a reply that takes it on.
  const asked = [...new Set(words(points.latest))];
  if (asked.length >= 3) {
    const lower = text.toLowerCase();
    const found = asked.filter(word => lower.includes(word.slice(0, Math.max(4, word.length - 2))));
    // A good answer to a long, wandering message reuses few of its words, so long requests get a much lower bar.
    if (found.length / asked.length < (asked.length > 15 ? 0.15 : 0.4)) misses.push({ kind: 'latest', text: 'It may not have taken up your latest request.', point: points.latest });
  }
  if (points.hadContext && /\b(?:could|can|would) you (?:please )?(?:share|paste|send|provide|upload|show me)\b[^?]{0,80}\b(?:code|file|context|details|conversation|chat|requirements|error|project)\b|please (?:share|paste|provide)\b[^.?]{0,60}\b(?:code|file|context|details)\b/i.test(text))
    misses.push({ kind: 'asked-again', text: 'It asked you to share context that the handoff already includes.' });
  return misses;
}

/** A correction for the chat box (the user reviews and sends it): only the points the reply missed. */
export function correction(misses: Miss[]): string {
  const lines = misses.map(miss => miss.kind === 'rejected' ? `- I turned this down earlier: ${miss.point}`
    : miss.kind === 'rule' ? `- My rule still applies: ${miss.point}`
    : miss.kind === 'latest' ? `- My latest request, which is what to work on now: “${miss.point}”`
    : miss.kind === 'asked-again' ? '- Everything I shared before is in the context above (and any attached file); please use it rather than asking again.'
    : '- Please continue the work itself from where it stopped, not just confirm the context.');
  return ['Before you continue, a few corrections:', ...lines, 'Please redo your answer with these in mind.'].join('\n');
}
