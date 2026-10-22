import type { ProviderId } from './selectors';
import type { RescueOption } from './rescue';

/** What the prompt is about, guessed on this device from its words. Nothing is sent anywhere. */
export type Topic = 'code' | 'research' | 'news' | 'writing' | 'math' | 'image' | 'general';

export const topicNames: Record<Topic, string> = { code: 'Code', research: 'Research', news: 'Current events', writing: 'Writing', math: 'Maths & reasoning', image: 'Images', general: 'General' };

const signals: Record<Exclude<Topic, 'general'>, RegExp[]> = {
  code: [/```/, /\b(code|coding|bug|debug|error|stack ?trace|exception|function|class|method|compile|refactor|typescript|javascript|python|java|rust|golang|c\+\+|sql|regex|api|endpoint|react|vue|node|npm|git|docker|kubernetes|deploy|script|unit test|lint)\b/i, /\b(const|let|def|import|return)\s+\w/, /[{};]\s*$/m, /\w+\(\)/],
  research: [/\b(research|sources?|cite|citations?|references?|papers?|stud(y|ies)|literature|evidence|compare|comparison|pros and cons|review of|in[- ]depth|deep dive|analy[sz]e|survey|statistics|data on)\b/i],
  news: [/\b(latest|today|this week|yesterday|news|current(ly)?|recent(ly)?|right now|price of|stock|weather|score|election|released?|launch(ed)?|trending|20(2[5-9]|3\d))\b/i],
  writing: [/\b(write|rewrite|draft|essay|email|letter|cover letter|blog|article|story|poem|tone|proofread|edit my|summari[sz]e|paraphrase|caption|script for|speech|resume|cv)\b/i],
  math: [/\b(math|maths|calculate|equation|solve|proof|prove|integral|derivative|probability|algebra|geometry|logic puzzle|optimi[sz]e)\b/i, /\d+\s*[-+*/^=]\s*\d+/],
  image: [/\b(image|picture|photo|draw|drawing|illustration|logo|icon|render|generate an? (image|picture)|wallpaper|art of|sketch)\b/i]
};

export function promptTopic(text: string): Topic {
  const sample = text.slice(-4000);
  let best: Topic = 'general'; let bestScore = 0;
  for (const [topic, patterns] of Object.entries(signals) as [Topic, RegExp[]][]) {
    const score = patterns.reduce((sum, pattern) => sum + (sample.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')) || []).length, 0);
    if (score > bestScore) { best = topic; bestScore = score; }
  }
  return best;
}

/** Baton's own judgment of which free tiers suit each kind of task, best first. Easy to retune. */
export const bestFor: Record<Topic, ProviderId[]> = {
  code: ['claude', 'deepseek', 'chatgpt', 'gemini', 'grok', 'perplexity'],
  research: ['perplexity', 'gemini', 'chatgpt', 'claude', 'grok', 'deepseek'],
  news: ['perplexity', 'grok', 'gemini', 'chatgpt', 'claude', 'deepseek'],
  writing: ['claude', 'chatgpt', 'gemini', 'grok', 'deepseek', 'perplexity'],
  math: ['deepseek', 'chatgpt', 'gemini', 'claude', 'grok', 'perplexity'],
  image: ['chatgpt', 'gemini', 'grok', 'perplexity', 'claude', 'deepseek'],
  general: ['chatgpt', 'claude', 'gemini', 'deepseek', 'grok', 'perplexity']
};

const reasons: Record<Topic, Partial<Record<ProviderId, string>>> = {
  code: { claude: 'strong at code', deepseek: 'strong at code', chatgpt: 'good at code' },
  research: { perplexity: 'searches the web with sources', gemini: 'searches with Google', chatgpt: 'can search the web' },
  news: { perplexity: 'live web search', grok: 'live web and X posts', gemini: 'searches with Google' },
  writing: { claude: 'natural writing', chatgpt: 'versatile writer' },
  math: { deepseek: 'step-by-step reasoning', chatgpt: 'strong reasoning' },
  image: { chatgpt: 'makes images', gemini: 'makes images', grok: 'makes images' },
  general: {}
};
export const fitReason = (topic: Topic, provider: ProviderId) => reasons[topic][provider];

/**
 * Rank by fit for the task, but usage still matters: limited services stay last, and one nearly out
 * (under 15% left) drops below services with room.
 */
export function rankForTopic(options: RescueOption[], topic: Topic): RescueOption[] {
  const fit = bestFor[topic];
  const tier = (option: RescueOption) => option.status === 'limited' ? 2 : option.status === 'room' && (option.remainingPercent ?? 100) < 15 ? 1 : 0;
  return [...options].sort((a, b) => tier(a) - tier(b) || fit.indexOf(a.provider) - fit.indexOf(b.provider) || (a.resetAt ?? Infinity) - (b.resetAt ?? Infinity));
}
