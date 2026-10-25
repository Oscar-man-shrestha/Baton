/**
 * Settled figures and whether the next AI changed one. Found in the live run: ChatGPT continued a Japan trip with
 * “three nights in Takayama” where the chat had settled on two, and no word check notices that. Only figures tied to a
 * name count (“Takayama 2 nights”, “4 nights in Kyoto”), never a bare number (“about 700 words”), so an answer that
 * suggests a new number for something else isn't flagged. The user's latest word on a figure wins.
 */
export type Figure = { name: string; number: number; unit: string; said: string };

const units = 'nights?|days?|weeks?|months?|years?|hours?|minutes?|words?|pages?|people|persons?|rooms?|items?|tickets?|slides?|questions?|chapters?|sections?|servings?|workers?|users?|steps?';
const numberWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30 };
const numberPattern = `\\d[\\d,]*(?:\\.\\d+)?|${Object.keys(numberWords).join('|')}`;
// Capitalised words that start sentences or name nothing in particular.
const notNames = new Set('the a an i we you it this that these those our my your yes no ok okay next then also and but so if for with day days week weeks night nights plan budget total each every both first last please thanks great sure love lets let well hi hello just maybe only'.split(' '));

const toNumber = (text: string) => numberWords[text.toLowerCase()] ?? Number(text.replace(/,/g, ''));
const singular = (unit: string) => unit.toLowerCase().replace(/^people$/, 'person').replace(/s$/, '');
const isName = (word: string) => /^[A-Z][\w'-]{2,}$/.test(word) && !notNames.has(word.toLowerCase()) && !new RegExp(`^(?:${units})$`, 'i').test(word);

/** Figures in text: “Name N unit”, “Name N” (unit carried along a list), and “N unit in/at/for Name”. */
export function extractFigures(text: string): Figure[] {
  const found: Figure[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    let carried = '';
    const named = new RegExp(`\\b([A-Z][\\w'-]{2,}(?:\\s[A-Z][\\w'-]{2,})?)\\s*[:=(]?\\s*(${numberPattern})\\s*(${units})?\\b`, 'g');
    for (const match of sentence.matchAll(named)) {
      const name = match[1].split(' ').filter(isName).join(' ');
      if (!name) continue;
      if (match[3]) carried = match[3];
      const unit = match[3] || carried;
      if (unit) found.push({ name, number: toNumber(match[2]), unit: singular(unit), said: match[0].trim() });
    }
    const after = new RegExp(`\\b(${numberPattern})\\s+(${units})\\s+(?:in|at|for|of|on)\\s+([A-Z][\\w'-]{2,}(?:\\s[A-Z][\\w'-]{2,})?)`, 'gi');
    for (const match of sentence.matchAll(after)) {
      const name = match[3].split(' ').filter(isName).join(' ');
      if (name) found.push({ name, number: toNumber(match[1]), unit: singular(match[2]), said: match[0].trim() });
    }
  }
  return found.filter(figure => Number.isFinite(figure.number));
}

const key = (figure: Figure) => `${figure.name.toLowerCase()}|${figure.unit}`;
/** The settled figures in the user's messages, in order: a later figure for the same thing replaces the earlier one. */
export function settledFigures(messages: string[]): Figure[] {
  const latest = new Map<string, Figure>();
  for (const message of messages) for (const figure of extractFigures(message)) latest.set(key(figure), figure);
  return [...latest.values()];
}

/** Figures the reply gives a different number for: what it said and what was settled. */
export function changedFigures(reply: string, settled: Figure[]): { settled: Figure; said: Figure }[] {
  const byKey = new Map(settled.map(figure => [key(figure), figure]));
  const changed: { settled: Figure; said: Figure }[] = [];
  for (const said of extractFigures(reply)) {
    const known = byKey.get(key(said));
    if (known && known.number !== said.number && !changed.some(item => key(item.said) === key(said))) changed.push({ settled: known, said });
  }
  return changed;
}
