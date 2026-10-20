import { describe, expect, it } from 'vitest';
import { estimateMeter, parseReset, shouldNudge } from '../src/core/limits';
import { rankProviders, trainClassifier } from '../src/core/router';

describe('limits and routing', () => {
  it('parses visible reset and labels signal', () => {
    const now = Date.UTC(2026, 9, 20, 12);
    expect(parseReset('Try again in 2 hours', now)).toBe(now + 7200000);
    expect(estimateMeter('claude', 'Usage limit reached. Try again in 2 hours', [], [], now).tier).toBe('banner');
  });
  it('never fabricates a percent without evidence', () => { expect(estimateMeter('grok', '', []).percent).toBeUndefined(); });
  it('classifies planning and ranks enabled alternatives', () => {
    expect(trainClassifier()('make a plan for my app')).toBe('planning');
    expect(rankProviders('planning', 'claude')[0]?.id).not.toBe('claude');
  });
});
