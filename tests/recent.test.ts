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

import { chatUrl } from '../src/core/recent';
describe('one chat, many addresses', () => {
  it('ignores query strings and hashes such as Grok’s ?rid=', () => {
    expect(chatUrl('https://grok.com/c/3a3f?rid=28dc')).toBe('https://grok.com/c/3a3f');
    expect(chatUrl('https://claude.ai/chat/abc#x')).toBe('https://claude.ai/chat/abc');
  });
  it('shows one entry per chat, newest first, and remembers every address for deletion', () => {
    const brief = briefSchema.parse({ goal: 'ok' });
    const a = 'brief:https://grok.com/c/3a3f?rid=1', b = 'brief:https://grok.com/c/3a3f?rid=2', c = 'brief:https://claude.ai/chat/x';
    const list = recentCapturesFromStorage({ [a]: brief, [`savedAt:${a}`]: 10, [b]: brief, [`savedAt:${b}`]: 20, [c]: brief, [`savedAt:${c}`]: 15 });
    expect(list.map(item => [item.url, item.variants.length])).toEqual([['https://grok.com/c/3a3f?rid=2', 2], ['https://claude.ai/chat/x', 1]]);
  });
});
