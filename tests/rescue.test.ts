import { describe, expect, it } from 'vitest';
import { accountSwitch, newChatUrls, providerEnabled, reachedLimit, rescueOptions } from '../src/core/rescue';

const now = Date.UTC(2026, 9, 22, 6);
const win = (provider: string, feature: string, percent: number, extra: Record<string, unknown> = {}) => ({ provider, tier: 'banner', confidence: 'high', key: `${provider}:${feature}`, feature, percent, remainingPercent: 100 - percent, at: now - 60000, source: 'provider-page', explanation: '', ...extra });

describe('limit rescue', () => {
  it('sees a limit only when the service showed 100% within the hour', () => {
    const saved = { 'usageWindows:claude': [win('claude', 'Session', 100, { resetAt: now + 7200000 }), win('claude', 'Weekly', 40)] };
    expect(reachedLimit(saved, 'claude', now)).toEqual({ provider: 'claude', feature: 'Session', resetAt: now + 7200000 });
    expect(reachedLimit({ 'usageWindows:claude': [win('claude', 'Session', 100, { at: now - 7200000 })] }, 'claude', now)).toBeUndefined();
    expect(reachedLimit({ 'usageWindows:claude': [win('claude', 'Session', 99)] }, 'claude', now)).toBeUndefined();
  });
  it('uses the later reset when two windows are full, and none when one has no reset', () => {
    const both = { 'usageWindows:gemini': [win('gemini', 'Session', 100, { resetAt: now + 3600000 }), win('gemini', 'Weekly', 100, { resetAt: now + 86400000 })] };
    expect(reachedLimit(both, 'gemini', now)?.resetAt).toBe(now + 86400000);
    const unknown = { 'usageWindows:gemini': [win('gemini', 'Session', 100, { resetAt: now + 3600000 }), win('gemini', 'Weekly', 100)] };
    expect(reachedLimit(unknown, 'gemini', now)?.resetAt).toBeUndefined();
  });
  it('sees a service limit notice even when other windows have room', () => {
    const saved = { 'usageWindows:claude': [win('claude', 'Weekly', 40)], 'meter:claude': win('claude', 'chat usage', 100) };
    expect(reachedLimit(saved, 'claude', now)?.feature).toBe('chat usage');
  });
  it('does not treat a full image or file cap as the whole service being limited', () => {
    expect(reachedLimit({ 'usageWindows:chatgpt': [win('chatgpt', 'Images', 100, { resetAt: now + 3600000 })] }, 'chatgpt', now)).toBeUndefined();
  });
  it('ranks room left first, then no reading, then limited', () => {
    const saved = {
      'usageWindows:gemini': [win('gemini', 'Session', 37), win('gemini', 'Weekly', 10)],
      'usageWindows:claude': [win('claude', 'Session', 100, { resetAt: now + 3600000 })]
    };
    const options = rescueOptions('chatgpt', saved, {}, now);
    expect(options.map(option => [option.provider, option.status, option.detail])).toEqual([
      ['gemini', 'room', '63% left'],
      ['claude', 'limited', 'limit reached · resets in 1h 0m']
    ]);
    expect(rescueOptions('gemini', saved, {}, now).map(option => option.provider)).toEqual(['chatgpt', 'claude']);
  });
  it('never invents a balance for a service that shows none', () => {
    const [chatgpt] = rescueOptions('claude', {}, {}, now);
    expect(chatgpt).toEqual({ provider: 'chatgpt', status: 'unknown', detail: 'no limit shown' });
  });
  it('ignores stale readings', () => {
    expect(rescueOptions('chatgpt', { 'usageWindows:gemini': [win('gemini', 'Session', 37, { at: now - 7200000 })] }, {}, now)[0].status).toBe('unknown');
  });
  it('follows the user’s enabled services', () => {
    expect(rescueOptions('claude', {}, { deepseek: true, chatgpt: false }, now).map(option => option.provider)).toEqual(['gemini', 'deepseek']);
    expect(providerEnabled('grok')).toBe(false);
  });
  it('switches accounts only through the service’s own screens', () => {
    expect(new URL(accountSwitch('gemini').url!).hostname).toBe('accounts.google.com');
    expect(accountSwitch('claude').url).toBeUndefined();
    expect(accountSwitch('claude').steps).toContain('Log out');
    expect(Object.values(newChatUrls).every(url => url.startsWith('https://'))).toBe(true);
  });
});

import { createRequire } from 'node:module';
import { buildRescueCard } from '../src/core/rescue-card';
const { JSDOM } = createRequire(import.meta.url)('jsdom') as typeof import('jsdom');

describe('limit rescue card', () => {
  const doc = () => new JSDOM('<body></body>').window.document;
  const limit = { provider: 'claude' as const, feature: 'Session', resetAt: now + 2 * 3600000 };
  const options = rescueOptions('claude', { 'usageWindows:gemini': [win('gemini', 'Session', 37)], 'usageWindows:chatgpt': [win('chatgpt', 'Session', 100, { resetAt: now + 3600000 })] }, {}, now);
  const handlers = (calls: string[]) => ({
    continueIn: async (provider: string) => { calls.push(`continue:${provider}`); return 'Opened Gemini with your project as an unsent draft.'; },
    switchAccount: async () => { calls.push('switch'); return 'copied'; },
    remind: async () => { calls.push('remind'); return 'reminder set'; },
    dismiss: () => { calls.push('dismiss'); }
  });
  it('offers ranked services, account switch and a reminder', () => {
    const card = buildRescueCard(doc(), limit, options, handlers([]), now);
    expect(card.textContent).toContain('Claude limit reached');
    expect(card.textContent).toContain('Back in 2h 0m');
    const labels = Array.from(card.querySelectorAll('.options button')).map(button => button.textContent);
    expect(labels).toEqual(['Continue in Gemini63% left', 'Continue in ChatGPTlimit reached · resets in 1h 0m']);
    expect((card.querySelectorAll('.options button')[1] as HTMLButtonElement).disabled).toBe(true);
    expect(card.textContent).toContain('Switch Claude account');
    expect(card.textContent).toContain('Remind me when it resets');
    expect(card.textContent).toContain('never sent');
  });
  it('runs the chosen action and reports the result', async () => {
    const calls: string[] = [];
    const card = buildRescueCard(doc(), limit, options, handlers(calls), now);
    (card.querySelector('.options button') as HTMLButtonElement).click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(calls).toEqual(['continue:gemini']);
    expect(card.querySelector('[role="status"]')?.textContent).toBe('Opened Gemini with your project as an unsent draft.');
    expect((card.querySelectorAll('.options button')[1] as HTMLButtonElement).disabled).toBe(true);
    (card.querySelector('.close') as HTMLButtonElement).click();
    expect(calls).toContain('dismiss');
  });
  it('shows errors and hides the reminder when no reset time was shown', async () => {
    const card = buildRescueCard(doc(), { provider: 'claude', feature: 'Session' }, options, { ...handlers([]), continueIn: async () => { throw new Error('Nothing to carry over yet.'); } }, now);
    expect(card.textContent).toContain('Reset time not shown');
    expect(card.textContent).not.toContain('Remind me');
    (card.querySelector('.options button') as HTMLButtonElement).click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(card.querySelector('[role="status"]')?.textContent).toBe('Nothing to carry over yet.');
  });
});
