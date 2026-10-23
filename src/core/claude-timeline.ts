// Claude's newer reply transport: Connect-RPC ConversationService/StreamTimeline, binary protobuf in length-prefixed
// frames. On Free accounts its message_limit event is the only place the session (5h) and weekly (7d) use appear.
// No imports: the usage tap that runs in Claude's page bundles this alone. Only the usage numbers are read; every
// other part of a frame (the conversation itself) is skipped as opaque bytes.
//
// Frame:        flags(1) | length(4, big-endian) | payload      flags 0x01 = gzip, 0x02 = end-of-stream trailer
// Payload:      { 1: event }   event { 4: message_limit }   message_limit { 13: map<string, Window> }
// Window:       { 1: status (3 = exceeded), 2: resets_at Timestamp { 1: seconds }, 3: utilization (double, 0–1) }

export const isClaudeTimelineStream = (url: string) => { try { const parsed = new URL(url); return parsed.hostname === 'claude.ai' && /\/claudeai-rpc\/[^?#]*ConversationService\/StreamTimeline$/.test(parsed.pathname); } catch { return false; } };

type Field = { no: number; wt: number; v: number | Uint8Array };
/** The top-level fields of one protobuf message (nested messages stay bytes). Throws on malformed input. */
export function protoFields(buf: Uint8Array): Field[] {
  const out: Field[] = [];
  let i = 0;
  const varint = () => { let value = 0, scale = 1; for (;;) { if (i >= buf.length) throw new Error('truncated'); const b = buf[i++]; value += (b & 0x7f) * scale; if (b < 0x80) return value; scale *= 128; if (scale > 2 ** 63) throw new Error('varint'); } };
  while (i < buf.length) {
    const key = varint(), no = Math.floor(key / 8), wt = key % 8;
    if (wt === 0) out.push({ no, wt, v: varint() });
    else if (wt === 1) { if (i + 8 > buf.length) throw new Error('truncated'); out.push({ no, wt, v: new DataView(buf.buffer, buf.byteOffset + i, 8).getFloat64(0, true) }); i += 8; }
    else if (wt === 2) { const length = varint(); if (i + length > buf.length) throw new Error('truncated'); out.push({ no, wt, v: buf.subarray(i, i + length) }); i += length; }
    else if (wt === 5) { i += 4; if (i > buf.length) throw new Error('truncated'); }
    else throw new Error(`wire type ${wt}`);
  }
  return out;
}
const bytes = (fields: Field[], no: number) => fields.filter(field => field.no === no && field.wt === 2).map(field => field.v as Uint8Array);
const first = (fields: Field[], no: number, wt: number) => fields.find(field => field.no === no && field.wt === wt)?.v;

/**
 * One frame payload → Claude's usage in its /usage shape ({ five_hour, seven_day } with utilization in percent and
 * resets_at in seconds), or undefined when the frame carries no usage report.
 */
export function timelineUsage(payload: Uint8Array): Record<string, { utilization: number; resets_at: number; status?: string }> | undefined {
  try {
    for (const event of bytes(protoFields(payload), 1)) {
      for (const limit of bytes(protoFields(event), 4)) {
        const usage: Record<string, { utilization: number; resets_at: number; status?: string }> = {};
        for (const entry of bytes(protoFields(limit), 13)) {
          const pair = protoFields(entry);
          const key = new TextDecoder().decode(bytes(pair, 1)[0] || new Uint8Array());
          const name = key === '5h' ? 'five_hour' : key === '7d' ? 'seven_day' : '';
          const window = bytes(pair, 2)[0];
          if (!name || !window) continue;
          const parts = protoFields(window);
          const utilization = first(parts, 3, 1), resets = bytes(parts, 2)[0];
          const seconds = resets ? first(protoFields(resets), 1, 0) : undefined;
          if (typeof utilization !== 'number' || !Number.isFinite(utilization) || typeof seconds !== 'number') continue;
          usage[name] = { utilization: Math.round(utilization * 1000) / 10, resets_at: seconds, ...(first(parts, 1, 0) === 3 ? { status: 'exceeded_limit' } : {}) };
        }
        if (Object.keys(usage).length) return usage;
      }
    }
  } catch { /* not a frame we understand: no reading */ }
  return undefined;
}

/** The same report when the stream is connect+json instead of protobuf. */
export function timelineUsageJson(text: string): Record<string, { utilization: number; resets_at: number; status?: string }> | undefined {
  try {
    const event = JSON.parse(text)?.event;
    const windows = (event?.message_limit || event?.messageLimit)?.windows;
    if (!windows || typeof windows !== 'object') return undefined;
    const usage: Record<string, { utilization: number; resets_at: number; status?: string }> = {};
    for (const [key, name] of [['5h', 'five_hour'], ['7d', 'seven_day']] as const) {
      const win = windows[key];
      const seconds = typeof win?.resets_at === 'object' ? Number(win.resets_at?.seconds) : typeof win?.resetsAt === 'object' ? Number(win.resetsAt?.seconds) : Date.parse(win?.resets_at ?? win?.resetsAt) / 1000;
      if (!win || typeof win.utilization !== 'number' || !Number.isFinite(seconds)) continue;
      usage[name] = { utilization: Math.round(win.utilization * 1000) / 10, resets_at: seconds, ...(/exceed/i.test(String(win.status)) ? { status: 'exceeded_limit' } : {}) };
    }
    return Object.keys(usage).length ? usage : undefined;
  } catch { return undefined; }
}

/** Splits buffered stream bytes into complete Connect frames; returns them and the unconsumed rest. */
export function connectFrames(buffer: Uint8Array): { frames: { flags: number; payload: Uint8Array }[]; rest: Uint8Array; tooBig: boolean } {
  const frames: { flags: number; payload: Uint8Array }[] = [];
  let offset = 0;
  while (buffer.length - offset >= 5) {
    const length = ((buffer[offset + 1] << 24) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 8) | buffer[offset + 4]) >>> 0;
    if (length > 16 * 1024 * 1024) return { frames, rest: new Uint8Array(), tooBig: true };
    if (buffer.length - offset - 5 < length) break;
    frames.push({ flags: buffer[offset], payload: buffer.subarray(offset + 5, offset + 5 + length) });
    offset += 5 + length;
  }
  return { frames, rest: buffer.subarray(offset), tooBig: false };
}

/** A frame's layout as field numbers only (“1(4)” = field 1 holding a message with field 4), for the usage panel. */
export function frameShape(payload: Uint8Array): string {
  try {
    return protoFields(payload).map(top => {
      if (top.wt !== 2) return String(top.no);
      try { return `${top.no}(${[...new Set(protoFields(top.v as Uint8Array).map(inner => inner.no))].slice(0, 6).join(',')})`; } catch { return `${top.no}(?)`; }
    }).slice(0, 6).join(' ');
  } catch { return 'not protobuf'; }
}
