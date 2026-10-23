import { describe, expect, it } from 'vitest';
import { connectFrames, isClaudeTimelineStream, timelineUsage, timelineUsageJson } from '../src/core/claude-timeline';
import { parseUsageResponse } from '../src/core/usage-api';

// A tiny protobuf writer, enough to build StreamTimeline frames the way claude.ai sends them.
const varint = (n: number) => { const out: number[] = []; while (n >= 128) { out.push((n % 128) | 128); n = Math.floor(n / 128); } out.push(n); return out; };
const field = (no: number, wt: number, body: number[]) => [...varint(no * 8 + wt), ...body];
const message = (no: number, inner: number[]) => field(no, 2, [...varint(inner.length), ...inner]);
const double = (no: number, value: number) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, value, true); return field(no, 1, [...b]); };
const text = (no: number, value: string) => message(no, [...new TextEncoder().encode(value)]);
const window = (utilization: number, seconds: number, status = 1) => [...field(1, 0, varint(status)), ...message(2, field(1, 0, varint(seconds))), ...double(3, utilization)];
const entry = (key: string, win: number[]) => message(13, [...text(1, key), ...message(2, win)]);
const frame = (payload: number[], flags = 0) => new Uint8Array([flags, (payload.length >>> 24) & 255, (payload.length >>> 16) & 255, (payload.length >>> 8) & 255, payload.length & 255, ...payload]);

const now = Date.UTC(2026, 9, 23, 6);
const in4h = Math.floor(now / 1000) + 4 * 3600, in2d = Math.floor(now / 1000) + 2 * 86400;
const usageEvent = message(1, message(4, [...field(1, 0, varint(1)), ...entry('5h', window(0.02, in4h)), ...entry('7d', window(0.01, in2d)), ...entry('7d_oi', window(0.5, in2d))]));
const conversationEvent = message(1, message(2, text(1, 'SECRET REPLY TEXT')));

describe('Claude’s StreamTimeline usage report (Free accounts)', () => {
  it('knows the stream by its address', () => {
    expect(isClaudeTimelineStream('https://claude.ai/claudeai-rpc/anthropic.bard.api.v1alpha.ConversationService/StreamTimeline')).toBe(true);
    expect(isClaudeTimelineStream('https://claude.ai/claudeai-rpc/anthropic.bard.api.v1alpha.ConversationService/PerformAction')).toBe(false);
    expect(isClaudeTimelineStream('https://evil.example/claudeai-rpc/x.ConversationService/StreamTimeline')).toBe(false);
  });

  it('reads 5h and 7d from a message_limit frame and ignores conversation frames', () => {
    const stream = new Uint8Array([...frame(conversationEvent), ...frame(usageEvent), ...frame([], 2)]);
    const { frames, rest } = connectFrames(stream);
    expect(frames.map(f => f.flags)).toEqual([0, 0, 2]);
    expect(rest.length).toBe(0);
    expect(timelineUsage(frames[0].payload)).toBeUndefined();
    const usage = timelineUsage(frames[1].payload)!;
    expect(usage).toEqual({ five_hour: { utilization: 2, resets_at: in4h }, seven_day: { utilization: 1, resets_at: in2d } });
    expect(JSON.stringify(usage)).not.toContain('SECRET');
    // Into Baton's usual Claude parser: Session 2% (98% left) and Weekly 1%.
    expect(parseUsageResponse('claude-usage', JSON.stringify(usage), now).map(win => [win.feature, win.percent, (win.resetAt! - now) / 3600000])).toEqual([['Session', 2, 4], ['Weekly', 1, 48]]);
  });

  it('waits for a frame split across chunks, marks an exceeded window, and survives junk', () => {
    const whole = frame(usageEvent);
    const first = connectFrames(whole.subarray(0, 9));
    expect(first.frames).toEqual([]);
    expect(first.rest.length).toBe(9);
    const exceeded = message(1, message(4, entry('5h', window(1, in4h, 3))));
    expect(timelineUsage(frame(exceeded).subarray(5))).toEqual({ five_hour: { utilization: 100, resets_at: in4h, status: 'exceeded_limit' } });
    expect(timelineUsage(new Uint8Array([255, 255, 255]))).toBeUndefined();
    expect(connectFrames(new Uint8Array([0, 255, 255, 255, 255])).tooBig).toBe(true);
  });

  it('reads the connect+json form too', () => {
    const json = JSON.stringify({ event: { messageLimit: { windows: { '5h': { utilization: 0.02, resetsAt: { seconds: String(in4h) } }, '7d': { utilization: 0.01, resets_at: new Date(in2d * 1000).toISOString() } } } } });
    expect(timelineUsageJson(json)).toEqual({ five_hour: { utilization: 2, resets_at: in4h }, seven_day: { utilization: 1, resets_at: in2d } });
    expect(timelineUsageJson('{"event":{"conversation":{}}}')).toBeUndefined();
  });
});
