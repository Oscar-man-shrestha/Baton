import { describe, expect, it } from 'vitest';
import { isClaudeReplyStream } from '../src/core/usage-kind';
import { parseChatGptFeatures, parseChatGptWham, parseClaudeUsageResponse, parseGeminiQuota, parseUsageResponse, usageKindOf } from '../src/core/usage-api';
import { activeWindows } from '../src/core/usage-windows';

const now = Date.UTC(2026, 9, 23, 3);
const h = 3600000;

describe('usage the AI sites send to the browser', () => {
  it('reads only the few usage addresses', () => {
    expect(usageKindOf('https://chatgpt.com/backend-api/conversation/init')).toBe('chatgpt-features');
    expect(usageKindOf('https://chatgpt.com/backend-api/wham/usage')).toBe('chatgpt-wham');
    expect(usageKindOf('https://claude.ai/api/organizations/9f1c-22/usage')).toBe('claude-usage');
    expect(usageKindOf('https://gemini.google.com/u/1/_/BardChatUi/data/batchexecute?rpcids=qpEbW&rt=c')).toBe('gemini-quota');
    for (const url of ['https://chatgpt.com/backend-api/conversation', 'https://chatgpt.com/backend-api/conversation/abc', 'https://claude.ai/api/organizations', 'https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=MaZiqc', 'https://evil.example/backend-api/wham/usage', 'not a url'])
      expect(usageKindOf(url)).toBeUndefined();
  });

  it('turns ChatGPT’s limits_progress into named allowances, Thinking included (Free plan)', () => {
    const windows = parseChatGptFeatures({ limits_progress: [
      { feature_name: 'reason', remaining: 3, reset_after: new Date(now + 4 * h + 46 * 60000).toISOString() },
      { feature_name: 'deep_research', remaining: 5, max_value: 5, reset_after: (now + 29 * 24 * h) / 1000 },
      { feature_name: 'file_upload', remaining: 8, reset_after: new Date(now + 24 * h).toISOString() },
      { feature_name: 'paste_to_file', remaining: 0 },
      { feature_name: 'image_gen', remaining: -1 }, { feature_name: 'bad', remaining: 'lots' }, null
    ] }, now);
    expect(windows.map(win => [win.key, win.remainingCount, win.percent, win.resetAt && Math.round((win.resetAt - now) / 60000)])).toEqual([
      ['chatgpt:Thinking', 3, undefined, 286], ['chatgpt:Deep research', 5, 0, 29 * 24 * 60], ['chatgpt:File uploads', 8, undefined, 1440], ['chatgpt:Paste to file', 0, 100, undefined]
    ]);
    expect(windows.every(win => win.source === 'provider-response' && win.confidence === 'high')).toBe(true);
    expect(activeWindows(windows, now)).toHaveLength(4);
    expect(parseChatGptFeatures({}, now)).toEqual([]);
  });

  it('names ChatGPT’s Codex/Work windows like the Usage page, so the two readings share keys', () => {
    const windows = parseChatGptWham({ plan_type: 'plus', rate_limit: {
      primary_window: { used_percent: 12, limit_window_seconds: 18000, reset_after_seconds: 3 * 3600 },
      secondary_window: { used_percent: 40, limit_window_seconds: 604800, reset_at: (now + 5 * 24 * h) / 1000 }
    } }, now);
    expect(windows.map(win => [win.key, win.percent, win.remainingPercent, (win.resetAt! - now) / h])).toEqual([['chatgpt:Work 5-hour', 12, 88, 3], ['chatgpt:Work weekly', 40, 60, 120]]);
    expect(parseChatGptWham({ rate_limit: { primary_window: { used_percent: 0, limit_window_seconds: 30 * 86400 } } }, now)[0].feature).toBe('Codex monthly');
    expect(parseChatGptWham({ rate_limit: { primary_window: { used_percent: 140 } } }, now)).toEqual([]);
  });

  it('reads Claude’s session and weekly utilization as percent', () => {
    const windows = parseClaudeUsageResponse({ five_hour: { utilization: 34, resets_at: new Date(now + 2 * h).toISOString() }, seven_day: { utilization: 54, resets_at: new Date(now + 46 * h).toISOString() }, seven_day_opus: null }, now);
    expect(windows.map(win => [win.key, win.percent, win.source])).toEqual([['claude:Session', 34, 'provider-response'], ['claude:Weekly', 54, 'provider-response']]);
  });

  it('decodes Gemini’s quota reply: the nearer reset is the 5-hour window, the further the weekly', () => {
    const rows = [[[1, 2], 2, 58, [Math.floor((now + 4 * 24 * h) / 1000), 0], null, null], [[1, 2], 1, 28, [Math.floor((now + 3 * h) / 1000), 500000000], null, null], [[1, 7], 1, 90, [Math.floor((now + h) / 1000), 0], 3, 10]];
    const text = `)]}'\n\n123\n${JSON.stringify([['wrb.fr', 'qpEbW', JSON.stringify([rows]), null, null, null, 'generic']])}\n25\n[["e",4,null,null,141]]\n`;
    expect(parseGeminiQuota(text, now).map(win => [win.key, win.percent, Math.round((win.resetAt! - now) / h)])).toEqual([['gemini:Session', 28, 3], ['gemini:Weekly', 58, 96]]);
    expect(parseGeminiQuota(`)]}'\n${JSON.stringify([['wrb.fr', 'other', '[]']])}`, now)).toEqual([]);
  });

  it('reads Claude’s message_limit event from a reply stream as session and weekly', () => {
    expect(isClaudeReplyStream('https://claude.ai/api/organizations/o1/chat_conversations/c9/completion')).toBe(true);
    expect(isClaudeReplyStream('https://claude.ai/api/organizations/o1/chat_conversations/c9/retry_completion')).toBe(true);
    expect(isClaudeReplyStream('https://claude.ai/api/organizations/o1/chat_conversations/c9')).toBe(false);
    const event = { message_limit: { type: 'within_limit', windows: { '5h': { status: 'within_limit', utilization: 0.34, resets_at: Math.floor((now + 2 * h) / 1000) }, '7d': { status: 'within_limit', utilization: 0.54, resets_at: Math.floor((now + 46 * h) / 1000) } } } };
    expect(parseUsageResponse('claude-usage', JSON.stringify(event), now).map(win => [win.key, win.percent, (win.resetAt! - now) / h])).toEqual([['claude:Session', 34, 2], ['claude:Weekly', 54, 46]]);
  });
  it('reads Claude’s usage in the other shapes it sends: strings, used/limit, percent, session/weekly keys', () => {
    const resets = new Date(now + 4 * h).toISOString();
    const read = (payload: unknown) => parseUsageResponse('claude-usage', JSON.stringify(payload), now).map(win => [win.feature, win.percent]);
    expect(read({ five_hour: { utilization: '2.0', resets_at: resets }, seven_day: { utilization: '1', resets_at: resets } })).toEqual([['Session', 2], ['Weekly', 1]]);
    expect(read({ session: { used: 1, limit: 50, resets_at: resets }, weekly: { percentage: 1 } })).toEqual([['Session', 2], ['Weekly', 1]]);
    expect(read({ five_hour: { percent: 2 }, seven_day: null, seven_day_opus: { utilization: 0 }, seven_day_oauth_apps: { utilization: 5 } })).toEqual([['Session', 2], ['Opus weekly', 0]]);
  });
  it('never throws on junk', () => {
    for (const kind of ['chatgpt-features', 'chatgpt-wham', 'claude-usage', 'gemini-quota'] as const) for (const text of ['', 'not json', 'null', '[]', '{"limits_progress":7}'])
      expect(parseUsageResponse(kind, text, now)).toEqual([]);
  });
});
