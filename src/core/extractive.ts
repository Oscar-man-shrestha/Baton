import { encode } from 'gpt-tokenizer';

const stop = new Set('the and that this with from your have will should would could about into some then than are for you can not'.split(' '));
const terms = (text: string) => new Set((text.toLowerCase().match(/[\p{L}\p{N}_-]{3,}/gu) || []).filter(term => !stop.has(term)));
const overlap = (a: Set<string>, b: Set<string>) => {
  let shared = 0;
  for (const term of a) if (b.has(term)) shared++;
  return shared / Math.max(1, a.size + b.size - shared);
};

/** Section coverage + query relevance + maximal marginal relevance, entirely local. */
export function selectEvidence(text: string, query: string, tokenBudget = 520): string[] {
  const queryTerms = terms(query);
  const candidates: { text: string; section: string; terms: Set<string>; score: number; order: number; tokens: number }[] = [];
  let section = '', inCode = false, fence = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const codeFence = line.match(/^(`{3,}|~{3,})/);
    if (codeFence) { if (!inCode) { inCode = true; fence = codeFence[1]; } else if (codeFence[1][0] === fence[0] && codeFence[1].length >= fence.length) inCode = false; continue; }
    if (inCode || !line) continue;
    if (/^#{1,6}\s/.test(line)) { section = line.replace(/^#{1,6}\s+/, '').replace(/\*\*/g, ''); continue; }
    const bullet = /^[-*]|^\d+[.)]/.test(line);
    const cleaned = line.replace(/^(?:[-*]|\d+[.)])\s+/, '').replace(/\*\*/g, '');
    for (const sentence of cleaned.split(/(?<=[.!?])\s+(?=[\p{Lu}])/u)) {
      if (sentence.length < 15 || sentence.length > 650 || sentence.endsWith('?')) continue;
      const termSet = terms(sentence);
      const score = overlap(termSet, queryTerms) * 2 + (bullet ? 0.45 : 0)
        + (/\b(must|never|failed|error|fix|tested|decision|implement|solution|next|result)\b/i.test(sentence) ? 0.3 : 0)
        // Names of things built (`unique_target`, `moves.log`) are what a continuation most needs to reuse.
        + (/`[^`\n]{2,60}`/.test(sentence) ? 0.3 : 0)
        + Math.min(0.2, termSet.size / 150);
      const output = section ? `${section}: ${sentence}` : sentence;
      candidates.push({ text: output, section, terms: termSet, score, order: candidates.length, tokens: encode(output).length });
    }
  }
  const selected: typeof candidates = [];
  const remaining = new Set(candidates);
  let spent = 0;
  const add = (candidate: typeof candidates[number]) => { selected.push(candidate); remaining.delete(candidate); spent += candidate.tokens; };
  // Reserve one concise piece of evidence for each section, including late sections.
  const sections = [...new Set(candidates.map(candidate => candidate.section).filter(Boolean))].slice(0, 8);
  for (const name of sections) {
    const candidate = candidates.filter(item => item.section === name).sort((a, b) => (b.score - b.tokens / 180) - (a.score - a.tokens / 180))[0];
    if (candidate && spent + candidate.tokens <= tokenBudget) add(candidate);
  }
  while (selected.length < 12) {
    const choice = [...remaining].filter(candidate => spent + candidate.tokens <= tokenBudget)
      .map(candidate => ({ candidate, score: candidate.score - Math.max(0, ...selected.map(chosen => overlap(candidate.terms, chosen.terms))) * 0.8 }))
      .sort((a, b) => b.score - a.score || a.candidate.order - b.candidate.order)[0];
    if (!choice) break;
    add(choice.candidate);
  }
  return selected.sort((a, b) => a.order - b.order).map(candidate => candidate.text);
}

export function fencedCode(text: string): { language: string; content: string }[] {
  return [...text.matchAll(/^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^\1[ \t]*$/gm)].map(match => ({ language: match[2].trim() || 'code', content: match[3].replace(/\n$/, '') }));
}
