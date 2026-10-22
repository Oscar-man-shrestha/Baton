import { describe, expect, it } from 'vitest';
import { promptTopic, rankForTopic } from '../src/core/task-fit';

const opt = (provider: string, status: 'room' | 'unknown' | 'limited', remainingPercent?: number) => ({ provider, status, detail: '', ...(remainingPercent !== undefined ? { remainingPercent } : {}) }) as any;

describe('suggestions by prompt topic', () => {
  it('guesses the topic from the prompt words', () => {
    expect(promptTopic('Why does this TypeScript function throw an error?\n```ts\nconst x = f();\n```')).toBe('code');
    expect(promptTopic('Find studies and sources comparing intermittent fasting diets')).toBe('research');
    expect(promptTopic('What is the latest news on the election today?')).toBe('news');
    expect(promptTopic('Rewrite this cover letter in a warmer tone')).toBe('writing');
    expect(promptTopic('Solve this equation: 3x + 5 = 20')).toBe('math');
    expect(promptTopic('Draw a logo of a fox')).toBe('image');
    expect(promptTopic('hello there')).toBe('general');
  });
  it('ranks by fit, but limited and nearly-out services go last', () => {
    const options = [opt('chatgpt', 'room', 80), opt('perplexity', 'unknown'), opt('gemini', 'limited'), opt('claude', 'room', 10)];
    expect(rankForTopic(options, 'research').map(o => o.provider)).toEqual(['perplexity', 'chatgpt', 'claude', 'gemini']);
    expect(rankForTopic(options, 'code').map(o => o.provider)).toEqual(['chatgpt', 'perplexity', 'claude', 'gemini']);
  });
});
