import { describe, expect, it } from 'vitest';
import { chatFeature, chatSegments } from '../src/core/composer-line';

const now = Date.UTC(2026, 9, 22, 4);
const min = 60000;
const win = (feature: string, percent: number, extra: Record<string, unknown> = {}) => ({ provider: 'claude', tier: 'banner', confidence: 'high', key: `claude:${feature}`, feature, percent, remainingPercent: 100 - percent, at: now - min, source: 'provider-page', explanation: '', ...extra }) as any;

describe('usage bar under the composer', () => {
  it('shows the tightest chat windows as “left”, coloured by level, with resets', () => {
    expect(chatSegments([win('Weekly', 19, { resetAt: now + 64 * 3600000 }), win('Session', 37, { resetAt: now + 189 * min })], now)).toEqual([
      { label: 'Session', value: '63% left', left: 63, level: 'ok', note: '3h 9m' },
      { label: 'Weekly', value: '81% left', left: 81, level: 'ok', note: '2d 16h' }
    ]);
  });
  it('marks low and medium levels and estimated values', () => {
    const [low] = chatSegments([win('Session', 85)], now);
    expect([low.level, low.value]).toEqual(['low', '15% left']);
    const [mid] = chatSegments([{ ...win('Session', 60), estimate: { from: 55, fromAt: now - 10 * min, sends: 2, perMessage: 2.5 } }], now);
    expect([mid.level, mid.value]).toEqual(['mid', '≈40% left']);
  });
  it('never puts ChatGPT Work, credits or feature caps under the chat box', () => {
    expect(chatSegments([win('Work weekly', 0), win('Work 5-hour', 0), { ...win('Credits', 0), percent: undefined }], now)).toEqual([]);
    expect(['Work weekly', 'Credits', 'Images', 'Limit resets', 'Model'].some(chatFeature)).toBe(false);
    expect(['Session', 'Weekly', 'chat usage', 'Sonnet weekly'].every(chatFeature)).toBe(true);
  });
});
