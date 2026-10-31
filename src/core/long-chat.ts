import type { Turn } from './adapter';

/**
 * When a chat is long enough that answers tend to get worse, and a fresh chat with a handoff would help.
 * Evidence: NoLiMa (2025) found most models fall to half their short-context accuracy by 32k tokens; Chroma's “context
 * rot” study (2025) found every model tested degrades as input grows; Laban et al., “LLMs Get Lost in Multi-Turn
 * Conversation” (2025), measured a 39% average drop when a task is spread over many turns. Hence a tip at about 30k
 * tokens or 60 messages, and a stronger one at about 80k tokens or 120 messages, well inside every model's window.
 */
export const longChatLevels = { tip: { tokens: 30000, messages: 60 }, strong: { tokens: 80000, messages: 120 } };

export type LongChat = { level: 'tip' | 'strong'; tokens: number; messages: number; heading: string; text: string };

/** Approximate tokens of a chat (4 characters a token; exact counting is too slow for long chats on every check). */
export const chatTokens = (turns: Pick<Turn, 'text'>[]) => Math.round(turns.reduce((sum, turn) => sum + turn.text.length, 0) / 4);

export function longChat(tokens: number, messages: number): LongChat | undefined {
  const reached = (level: { tokens: number; messages: number }) => tokens >= level.tokens || messages >= level.messages;
  const level = reached(longChatLevels.strong) ? 'strong' : reached(longChatLevels.tip) ? 'tip' : undefined;
  if (!level) return undefined;
  const size = `${tokens >= 1000 ? `≈${Math.round(tokens / 1000)}k` : `≈${tokens}`} tokens, ${messages} messages`;
  return level === 'strong'
    ? { level, tokens, messages, heading: 'This chat is very long', text: `${size}. In chats this long, answers often miss things said early on. Starting fresh with a short summary keeps what matters.` }
    : { level, tokens, messages, heading: 'This chat is getting long', text: `${size}. Answers can start to slip around this length. When you reach a good stopping point, starting fresh with a short summary keeps what matters.` };
}

/** “Not now” holds until the chat is half as long again, or reaches the stronger level. */
export function stillDismissed(dismissedAt: { tokens: number; level: LongChat['level'] } | undefined, now: LongChat): boolean {
  return !!dismissedAt && !(now.level === 'strong' && dismissedAt.level === 'tip') && now.tokens < dismissedAt.tokens * 1.5;
}
