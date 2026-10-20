import type { ProviderId } from './selectors';
import type { Meter } from './limits';

export type Intent = 'planning' | 'coding' | 'writing' | 'research' | 'reasoning';
export type Feedback = { intent: Intent; provider: ProviderId; positive: boolean };
export type ProviderPreference = { id: ProviderId; enabled: boolean; intents: Intent[]; lastVerified: string };
export const providerTable: ProviderPreference[] = [
  { id: 'chatgpt', enabled: true, intents: ['planning', 'coding', 'writing', 'reasoning'], lastVerified: '2026-10-20' },
  { id: 'claude', enabled: true, intents: ['planning', 'coding', 'writing', 'reasoning'], lastVerified: '2026-10-20' },
  { id: 'gemini', enabled: true, intents: ['planning', 'research', 'reasoning'], lastVerified: '2026-10-20' },
  { id: 'deepseek', enabled: false, intents: ['coding', 'reasoning'], lastVerified: 'unverified' },
  { id: 'grok', enabled: false, intents: ['research', 'reasoning'], lastVerified: 'unverified' },
  { id: 'perplexity', enabled: false, intents: ['research'], lastVerified: 'unverified' }
];

export const training: { text: string; intent: Intent }[] = [
  { text: 'make a plan for my app', intent: 'planning' }, { text: 'outline the steps and milestones', intent: 'planning' }, { text: 'design a roadmap and architecture', intent: 'planning' },
  { text: 'debug this TypeScript error', intent: 'coding' }, { text: 'write a function and tests', intent: 'coding' }, { text: 'refactor my React component', intent: 'coding' },
  { text: 'rewrite this essay in a friendly tone', intent: 'writing' }, { text: 'draft an email to my teacher', intent: 'writing' }, { text: 'edit the story for clarity', intent: 'writing' },
  { text: 'find current sources and cite them', intent: 'research' }, { text: 'compare studies with references', intent: 'research' }, { text: 'look up recent evidence', intent: 'research' },
  { text: 'solve this logic puzzle step by step', intent: 'reasoning' }, { text: 'prove the theorem', intent: 'reasoning' }, { text: 'analyze the tradeoffs', intent: 'reasoning' }
];
const intents: Intent[] = ['planning', 'coding', 'writing', 'research', 'reasoning'];
const tokens = (s: string) => s.toLowerCase().match(/[a-z]{2,}/g) || [];

export function trainClassifier(samples = training) {
  const docs = samples.map(s => new Set(tokens(s.text)));
  const vocabulary = [...new Set(docs.flatMap(d => [...d]))];
  const idf = new Map(vocabulary.map(word => [word, Math.log((samples.length + 1) / (1 + docs.filter(d => d.has(word)).length)) + 1]));
  const vector = (s: string) => { const counts = new Map<string, number>(); tokens(s).forEach(w => counts.set(w, (counts.get(w) || 0) + 1)); return vocabulary.map(w => (counts.get(w) || 0) * (idf.get(w) || 0)); };
  const weights = intents.map(() => Array(vocabulary.length + 1).fill(0) as number[]);
  for (let epoch = 0; epoch < 160; epoch++) for (const sample of samples) {
    const x = vector(sample.text);
    const logits = weights.map(w => w[0] + x.reduce((sum, value, i) => sum + value * w[i + 1], 0));
    const max = Math.max(...logits);
    const exps = logits.map(v => Math.exp(v - max));
    const total = exps.reduce((a, b) => a + b, 0);
    weights.forEach((w, k) => { const error = (intents[k] === sample.intent ? 1 : 0) - exps[k] / total; w[0] += 0.03 * error; x.forEach((value, i) => w[i + 1] += 0.03 * error * value); });
  }
  return (text: string): Intent => {
    const x = vector(text);
    const scores = weights.map(w => w[0] + x.reduce((sum, value, i) => sum + value * w[i + 1], 0));
    return intents[scores.indexOf(Math.max(...scores))];
  };
}

export function rankProviders(intent: Intent, source: ProviderId, table = providerTable, meters: Partial<Record<ProviderId, Meter>> = {}, feedback: Feedback[] = []) {
  return table.filter(p => p.enabled && p.id !== source).map(p => {
    const meter = meters[p.id];
    const relevant = feedback.filter(f => f.intent === intent && f.provider === p.id);
    const learned = relevant.length >= 20 ? (relevant.filter(f => f.positive).length / relevant.length - 0.5) * 2 : 0;
    const fit = p.intents.includes(intent) ? 2 : 0;
    const verifiedBalance = meter?.tier === 'banner' && meter.remainingPercent !== undefined;
    const reachedLimit = meter?.tier === 'banner' && meter.percent === 100;
    const capacity = reachedLimit ? -2 : verifiedBalance && meter.remainingPercent! >= 30 ? 1 : 0;
    const capacityReason = reachedLimit ? 'visible limit notice' : verifiedBalance ? `${meter.remainingPercent}% reported remaining` : 'capacity unknown';
    return { id: p.id, score: fit + capacity + learned, reason: `${p.intents.includes(intent) ? `Good for ${intent}` : 'General option'}; ${capacityReason}`, lastVerified: p.lastVerified };
  }).sort((a, b) => b.score - a.score).slice(0, 3);
}
