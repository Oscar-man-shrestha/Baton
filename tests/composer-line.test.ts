import { describe, expect, it } from 'vitest';
import { chatFeature, chatSegments, countSegments, workSegments } from '../src/core/composer-line';

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
  it('adds ChatGPT’s Plan limits after the chat count, labelled Work so they never read as a chat limit', () => {
    const work = (feature: string, percent: number, resetAt: number) => ({ ...win(feature, percent), provider: 'chatgpt', key: `chatgpt:${feature}`, resetAt });
    // As on chatgpt.com/settings/usage: “5-hour limit · Resets in 5h 0m · 100% left”, “Weekly limit · Resets in 7d 0h · 100% left”.
    expect(workSegments([work('Work weekly', 0, now + 7 * 24 * 3600000), work('Work 5-hour', 0, now + 300 * min), { ...win('Credits', 0), percent: undefined }], now)).toEqual([
      { label: 'Work 5h', value: '100% left', left: 100, level: 'ok', note: '5h 0m' },
      { label: 'Work week', value: '100% left', left: 100, level: 'ok', note: '7d 0h' }
    ]);
    expect(workSegments([work('Work 5-hour', 88, now + 42 * min)], now)).toEqual([{ label: 'Work 5h', value: '12% left', left: 12, level: 'low', note: '42m' }]);
    expect(workSegments([win('Session', 40), win('Weekly', 10)], now)).toEqual([]);
  });
  it('shows ChatGPT’s Thinking allowance as a count, never as a chat percentage', () => {
    const thinking = (remaining: number, extra: Record<string, unknown> = {}) => ({ ...win('Thinking', 0), provider: 'chatgpt', key: 'chatgpt:Thinking', percent: undefined, remainingPercent: undefined, remainingCount: remaining, source: 'provider-response', resetAt: now + 286 * min, ...extra });
    expect(countSegments([thinking(3)], now)).toEqual([{ label: 'Thinking', value: '3 left', level: 'ok', note: '4h 46m' }]);
    expect(countSegments([thinking(1, { percent: 90, remainingPercent: 10 })], now)).toEqual([{ label: 'Thinking', value: '1 left', left: 10, level: 'mid', note: '4h 46m' }]);
    expect(countSegments([thinking(0, { percent: 100 })], now)[0].level).toBe('low');
    expect(chatSegments([thinking(1, { percent: 90, remainingPercent: 10 })], now)).toEqual([]);
    expect(countSegments([win('Session', 20)], now)).toEqual([]);
    const allowance = (feature: string, remaining: number, days: number) => ({ ...thinking(remaining), feature, key: `chatgpt:${feature}`, resetAt: now + days * 24 * 60 * min });
    expect(countSegments([thinking(3), allowance('Image generation', 10, 1), allowance('Deep research', 5, 30), allowance('Paste text to file', 1, 1), allowance('File uploads', 8, 1)], now).map(seg => [seg.label, seg.value, seg.note])).toEqual([['Thinking', '3 left', '4h 46m'], ['Research', '5 left', '30d 0h']]);
  });
});
