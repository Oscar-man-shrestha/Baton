import { describe, expect, it } from 'vitest';
import { estimateMeter, parseReset, shouldNudge } from '../src/core/limits';
import { providerTable, rankProviders, trainClassifier } from '../src/core/router';
import { encode } from 'gpt-tokenizer';

describe('limits and routing', () => {
  it('parses visible reset and labels signal', () => {
    const now = Date.UTC(2026, 9, 20, 12);
    expect(parseReset('Try again in 2 hours', now)).toBe(now + 7200000);
    expect(estimateMeter('claude', 'Usage limit reached. Try again in 2 hours', [], [], now).tier).toBe('banner');
  });
  it('never fabricates a percent without evidence', () => { expect(estimateMeter('grok', '', []).percent).toBeUndefined(); });
  it('shows only balances explicitly present in a visible service notice', () => {
    const observed = estimateMeter('gemini', 'Usage quota: 42% remaining', []);
    expect(observed.remainingPercent).toBe(42);
    expect(observed.percent).toBe(58);
    expect(estimateMeter('gemini', 'Usage quota has reset', []).remainingPercent).toBeUndefined();
  });
  it('uses older local limit events only as a low-confidence comparison', () => {
    const now = Date.UTC(2026, 9, 20);
    const currentChat = 'plan the next step '.repeat(80);
    const priorSize = Math.round(encode(currentChat).length / 0.8);
    const meter = estimateMeter('claude', '', [currentChat], [{ at: now - 86400000, approximateTokens: priorSize }, { at: now - 172800000, approximateTokens: priorSize }], now);
    expect(meter.tier).toBe('history');
    expect(meter.confidence).toBe('low');
    expect(shouldNudge(meter)).toBe(true);
    expect(meter.explanation).toContain('not the provider allowance');
  });
  it('classifies planning and ranks enabled alternatives', () => {
    expect(trainClassifier()('make a plan for my app')).toBe('planning');
    expect(rankProviders('planning', 'claude')[0]?.id).not.toBe('claude');
  });
  it('uses edited provider intent fit in ranking', () => {
    const table = providerTable.map(provider => ({ ...provider, enabled: provider.id === 'gemini' || provider.id === 'claude', intents: provider.id === 'gemini' ? ['coding' as const] : [] }));
    expect(rankProviders('coding', 'chatgpt', table)[0]?.id).toBe('gemini');
  });
  it('downranks a destination with a visible limit notice', () => {
    const table = providerTable.map(provider => ({ ...provider, enabled: provider.id === 'gemini' || provider.id === 'claude', intents: ['planning' as const] }));
    const limited = estimateMeter('claude', 'Usage limit reached', []);
    expect(rankProviders('planning', 'chatgpt', table, { claude: limited })[0]?.id).toBe('gemini');
  });
});
