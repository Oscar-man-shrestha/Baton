import { describe, expect, it, vi } from 'vitest';
import { activeRankings, addPick, bundledRankings, fetchRankings, parseRankings, promptTopic, rankForTopic, topicOrder } from '../src/core/task-fit';

const opt = (provider: string, status: 'room' | 'unknown' | 'limited', remainingPercent?: number) => ({ provider, status, detail: '', ...(remainingPercent !== undefined ? { remainingPercent } : {}) }) as any;
const file = (extra: Record<string, unknown> = {}) => ({ version: 2, updated: '2026-11-01', bestFor: { code: ['gemini', 'claude'] }, reasons: { code: { gemini: 'new model is best at code' } }, ...extra });

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
  it('learns new keywords from the rankings file', () => {
    expect(promptTopic('tune my svelte stores')).toBe('general');
    const rankings = parseRankings(file({ keywords: { code: ['svelte'] } }), bundledRankings)!;
    expect(promptTopic('tune my svelte stores', rankings)).toBe('code');
  });
  it('ranks by fit, but limited and nearly-out services go last', () => {
    const options = [opt('chatgpt', 'room', 80), opt('perplexity', 'unknown'), opt('gemini', 'limited'), opt('claude', 'room', 10)];
    expect(rankForTopic(options, bundledRankings.bestFor.research).map(o => o.provider)).toEqual(['perplexity', 'chatgpt', 'claude', 'gemini']);
    expect(rankForTopic(options, bundledRankings.bestFor.code).map(o => o.provider)).toEqual(['chatgpt', 'perplexity', 'claude', 'gemini']);
  });
});

describe('rankings file', () => {
  it('fills missing services and topics, and ignores services this version does not support', () => {
    const rankings = parseRankings(file({ bestFor: { code: ['mistral', 'gemini', 'claude'] } }), bundledRankings)!;
    expect(rankings.bestFor.code).toEqual(['gemini', 'claude', 'deepseek', 'chatgpt', 'grok', 'perplexity']);
    expect(rankings.bestFor.research).toEqual(bundledRankings.bestFor.research);
    expect(rankings.reasons.code?.gemini).toBe('new model is best at code');
  });
  it('rejects broken files and keeps the bundled list unless the online one is at least as new', () => {
    expect(parseRankings({ version: 'x' })).toBeUndefined();
    expect(activeRankings({ data: { nope: true }, fetchedAt: 1 }).online).toBe(false);
    expect(activeRankings({ data: file({ version: 0 }), fetchedAt: 1 }).online).toBe(false);
    const online = activeRankings({ data: file(), fetchedAt: 5 });
    expect([online.online, online.rankings.bestFor.code[0], online.fetchedAt]).toEqual([true, 'gemini', 5]);
  });
  it('downloads without cookies and refuses bad or huge responses', async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify(file())));
    expect(await fetchRankings(ok as any, 7)).toEqual({ data: file(), fetchedAt: 7 });
    expect((ok.mock.calls[0] as any[])[1]).toMatchObject({ credentials: 'omit', cache: 'no-store' });
    expect(await fetchRankings((async () => new Response('', { status: 404 })) as any)).toBeUndefined();
    expect(await fetchRankings((async () => new Response('x'.repeat(60000))) as any)).toBeUndefined();
  });
});

describe('your order and picks', () => {
  it('uses your own order for a topic when set', () => {
    expect(topicOrder('code', bundledRankings, { code: ['grok', 'perplexity'] })).toEqual(['grok', 'perplexity', 'claude', 'deepseek', 'chatgpt', 'gemini']);
  });
  it('moves a service you keep picking up, a little at a time', () => {
    let picks = addPick(undefined, 'research', 'claude');
    expect(topicOrder('research', bundledRankings, undefined, picks).indexOf('claude')).toBe(3);
    for (let i = 0; i < 3; i++) picks = addPick(picks, 'research', 'claude');
    expect(topicOrder('research', bundledRankings, undefined, picks).slice(0, 2)).toEqual(['perplexity', 'claude']);
    expect(addPick({ code: { grok: 10 } }, 'code', 'grok').code?.grok).toBe(10);
  });
});
