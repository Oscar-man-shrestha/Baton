import { describe, expect, it } from 'vitest';
import { briefSchema, redact, renderBrief, updateBrief } from '../src/core/brief';

describe('brief', () => {
  it('redacts seeded secret classes', () => {
    const input = 'sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456 sk-ant-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456 AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ12345678 eyJabc.eyJdef.signature -----BEGIN PRIVATE KEY-----\nSECRET\n-----END PRIVATE KEY----- postgres://alice:pass@host/db 4111 1111 1111 1111';
    const result = redact(input);
    expect(result.kinds).toEqual(expect.arrayContaining(['OpenAI key', 'Anthropic key', 'Google key', 'JWT', 'PEM private key', 'connection string', 'payment card']));
    expect(result.text).not.toContain('SECRET');
  });
  it('keeps the latest artifact and required fields when trimming', () => {
    const brief = briefSchema.parse({ goal: 'Project', preferences: ['Never send automatically'], open_tasks: ['Finish'], next_step: 'Review', weak_spots: Array(30).fill('old reasoning'), artifacts: [{ name: 'a', kind: 'code', content_verbatim: 'old', version: 1 }, { name: 'a', kind: 'code', content_verbatim: 'latest', version: 2 }] });
    const result = renderBrief(brief, 100);
    expect(result.text).toContain('latest');
    expect(result.text).toContain('Never send automatically');
    expect(result.receipt.dropped.length).toBeGreaterThan(0);
  });
  it('tracks user decisions with provenance', () => {
    const result = updateBrief(undefined, [{ role: 'user', text: 'We decided to use WXT. Never auto-send.', index: 3 }], []);
    expect(result.decisions[0]?.status).toBe('ratified_by_user');
    expect(result.decisions[0]?.source_turn).toBe(3);
  });
  it('does not persist seeded secrets in the brief object', () => {
    const result = updateBrief(undefined, [{ role: 'user', text: 'Use sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456 for the demo', index: 0 }], []);
    expect(JSON.stringify(result)).not.toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZ123456');
  });
});
