// Which usage responses Baton reads, by address. No imports: the usage tap that runs in every AI page bundles this alone.

/** What a response is, named by where it came from. */
export type UsageKind = 'chatgpt-features' | 'chatgpt-wham' | 'claude-usage' | 'gemini-quota';
export const kindProvider: Record<UsageKind, 'chatgpt' | 'claude' | 'gemini'> = { 'chatgpt-features': 'chatgpt', 'chatgpt-wham': 'chatgpt', 'claude-usage': 'claude', 'gemini-quota': 'gemini' };

/** Which response a request URL is, or undefined for everything else (only these few addresses are ever read). */
export function usageKindOf(url: string): UsageKind | undefined {
  let parsed: URL; try { parsed = new URL(url); } catch { return undefined; }
  const path = parsed.pathname;
  if (parsed.hostname === 'chatgpt.com') return /^\/backend-api\/conversation\/init\/?$/.test(path) ? 'chatgpt-features' : /^\/backend-api\/wham\/usage\/?$/.test(path) ? 'chatgpt-wham' : undefined;
  if (parsed.hostname === 'claude.ai') return /^\/api\/organizations\/[\w-]+\/usage\/?$/.test(path) ? 'claude-usage' : undefined;
  if (parsed.hostname === 'gemini.google.com') return /\/_\/BardChatUi\/data\/batchexecute$/.test(path) && (parsed.searchParams.get('rpcids') || '').split(',').includes(GEMINI_QUOTA_RPC) ? 'gemini-quota' : undefined;
  return undefined;
}

export const GEMINI_QUOTA_RPC = 'qpEbW';

/** Claude's reply stream (completion / retry_completion): its message_limit event carries the 5-hour and weekly use. */
export function isClaudeReplyStream(url: string): boolean {
  try { const parsed = new URL(url); return parsed.hostname === 'claude.ai' && /^\/api\/.+\/(?:retry_)?completion\/?$/.test(parsed.pathname); } catch { return false; }
}
