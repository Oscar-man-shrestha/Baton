import { describe, expect, it } from 'vitest';
import { chatTokens, longChat, stillDismissed } from '../src/core/long-chat';

describe('long-chat tip', () => {
  it('says nothing for a normal chat, a tip from about 30k tokens or 60 messages, and more firmly from 80k or 120', () => {
    expect(longChat(12000, 20)).toBeUndefined();
    expect(longChat(31000, 20)?.level).toBe('tip');
    expect(longChat(5000, 60)?.level).toBe('tip');
    expect(longChat(81000, 40)?.level).toBe('strong');
    expect(longChat(20000, 162)?.level).toBe('strong');
    expect(longChat(32400, 64)?.text).toMatch(/^≈32k tokens, 64 messages\. Answers can start to slip/);
  });
  it('“Not now” lasts until the chat is half as long again, or turns very long', () => {
    const tip = longChat(32000, 30)!;
    expect(stillDismissed({ tokens: 32000, level: 'tip' }, tip)).toBe(true);
    expect(stillDismissed({ tokens: 32000, level: 'tip' }, longChat(47000, 30)!)).toBe(true);
    expect(stillDismissed({ tokens: 32000, level: 'tip' }, longChat(49000, 30)!)).toBe(false);
    expect(stillDismissed({ tokens: 70000, level: 'tip' }, longChat(82000, 30)!)).toBe(false);
    expect(stillDismissed(undefined, tip)).toBe(false);
  });
  it('estimates a chat at four characters a token', () => {
    expect(chatTokens([{ text: 'a'.repeat(4000) }, { text: 'b'.repeat(400) }])).toBe(1100);
  });
});
