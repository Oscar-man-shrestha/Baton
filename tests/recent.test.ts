import { describe, expect, it } from 'vitest';
import { recentCapturesFromStorage } from '../src/core/recent';
import { briefSchema } from '../src/core/brief';

describe('recent captures', () => {
  it('lists saved chats in newest-first order and ignores malformed entries', () => {
    const older = 'brief:https://claude.ai/chat/older';
    const newer = 'brief:https://gemini.google.com/app/newer';
    const saved = {
      [older]: briefSchema.parse({ goal: 'Build a planner' }), [`savedAt:${older}`]: 10,
      [newer]: briefSchema.parse({ goal: 'Make a beautiful to-do list' }), [`savedAt:${newer}`]: 20,
      'brief:bad': { goal: 'Should not appear' }, 'savedAt:brief:bad': 30
    };
    const captures = recentCapturesFromStorage(saved);
    expect(captures.map(item => item.url)).toEqual(['https://gemini.google.com/app/newer', 'https://claude.ai/chat/older']);
    expect(captures[0].title).toContain('Make a beautiful to-do list');
  });
});
