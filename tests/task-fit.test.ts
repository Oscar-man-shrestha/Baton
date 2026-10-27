import { describe, expect, it, vi } from 'vitest';
import { activeRankings, addPick, bundledRankings, combineTopic, fetchRankings, parseRankings, promptTopic, rankForTopic, topicOrder } from '../src/core/task-fit';

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
    expect(promptTopic('make a meme of my cat')).toBe('image');
    expect(promptTopic('write a meme of my cat')).toBe('writing');
  });
  it('learns new keywords from the rankings file', () => {
    expect(promptTopic('tune my htmx swaps')).toBe('general');
    const rankings = parseRankings(file({ keywords: { code: ['htmx'] } }), bundledRankings)!;
    expect(promptTopic('tune my htmx swaps', rankings)).toBe('code');
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
    let picks = addPick(undefined, 'research', 'gemini');
    expect(topicOrder('research', bundledRankings, undefined, picks).indexOf('gemini')).toBe(3);
    for (let i = 0; i < 3; i++) picks = addPick(picks, 'research', 'gemini');
    expect(topicOrder('research', bundledRankings, undefined, picks).slice(0, 2)).toEqual(['perplexity', 'gemini']);
    expect(addPick({ code: { grok: 10 } }, 'code', 'grok').code?.grok).toBe(10);
  });
});

import prompts from './fixtures/topic-prompts.json';
describe('topic accuracy on labelled prompts', () => {
  it('gets at least 95% of the labelled prompts right', () => {
    const wrong = (prompts as [string, string][]).filter(([text, topic]) => promptTopic(text) !== topic).map(([text, topic]) => `${topic} ← ${promptTopic(text)}: ${text.slice(0, 60)}`);
    if (wrong.length) console.log(wrong.join('\n'));
    expect(1 - wrong.length / prompts.length).toBeGreaterThanOrEqual(0.95);
  });
});

import heldout from './fixtures/topic-heldout.json';
describe('topic check on prompts it was never tuned on', () => {
  // Never tune the cues on this file: it measures how the check does on new phrasing (70% when written).
  // When unsure it must fall back to “general” (the everyday order), not pick a wrong topic.
  it('finds most topics and does not mislabel the rest', () => {
    const results = (heldout as [string, string][]).map(([text, topic]) => ({ topic, got: promptTopic(text) }));
    const right = results.filter(r => r.got === r.topic).length;
    const wrongTopic = results.filter(r => r.got !== r.topic && r.got !== 'general').length;
    expect(right / results.length).toBeGreaterThanOrEqual(0.7);
    expect(wrongTopic).toBeLessThanOrEqual(1);
  });
});

import heldout2 from './fixtures/topic-heldout-2.json';
import predictions from './fixtures/topic-model-predictions.json';
describe('keywords plus the on-device model, on prompts neither was tuned or trained on', () => {
  // topic-heldout-2.json was written before training and never trained on. Model answers come from
  // scripts/train-topic-head.ts. When written: keywords 39/50, model 46/50 (4 wrong topics), combined 46/50 (1 wrong topic).
  it('gets at least 90% right and rarely picks a wrong topic', () => {
    const guesses = predictions as unknown as Record<string, [string, number]>;
    const results = (heldout2 as [string, string][]).map(([text, topic]) => ({ topic, got: combineTopic(promptTopic(text), { label: guesses[text][0], confidence: guesses[text][1] }) }));
    expect(results.filter(r => r.got === r.topic).length / results.length).toBeGreaterThanOrEqual(0.9);
    expect(results.filter(r => r.got !== r.topic && r.got !== 'general').length).toBeLessThanOrEqual(2);
  });
  it('falls back to keywords when the model is unavailable or unsure', () => {
    expect(combineTopic('code')).toBe('code');
    expect(combineTopic('general', { label: 'image', confidence: 0.3 })).toBe('general');
    expect(combineTopic('general', { label: 'image', confidence: 0.8 })).toBe('image');
    expect(combineTopic('general', { label: 'nonsense', confidence: 0.9 })).toBe('general');
  });
});

describe('a tampered rankings file', () => {
  it('is refused when a reason carries a link or web address', () => {
    for (const reason of ['free at https://evil.example', 'visit www.example.net', 'claim it at baton-pass.xyz', 'now on gift-card.com'])
      expect(parseRankings(file({ reasons: { code: { gemini: reason } } }), bundledRankings)).toBeUndefined();
    expect(parseRankings(file(), bundledRankings)?.reasons.code?.gemini).toBe('new model is best at code');
  });
});
