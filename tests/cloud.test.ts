import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ getUser: vi.fn(), oauth: vi.fn(), exchange: vi.fn(), upsert: vi.fn(), signOut: vi.fn(), flow: vi.fn(), set: vi.fn() }));
vi.mock('../src/config/cloud.json', () => ({ default: { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' } }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: state.getUser, signInWithOAuth: state.oauth, exchangeCodeForSession: state.exchange, signOut: state.signOut }, from: () => ({ upsert: state.upsert }) }) }));
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  state.getUser.mockResolvedValue({ data: { user: { id: 'owner-id', email: 'owner@example.com' } }, error: null });
  state.oauth.mockResolvedValue({ data: { url: 'https://example.supabase.co/auth/v1/authorize?provider=google' } });
  state.exchange.mockResolvedValue({ data: {}, error: null }); state.upsert.mockResolvedValue({ error: null }); state.signOut.mockResolvedValue({ error: null });
  state.flow.mockResolvedValue('https://extension.chromiumapp.org/supabase?code=pkce-result');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external: { google: true } }) }));
  vi.stubGlobal('chrome', { identity: { getRedirectURL: () => 'https://extension.chromiumapp.org/supabase', launchWebAuthFlow: state.flow }, storage: { local: { get: async () => ({ projects: [], folders: [] }), set: state.set } } });
});
describe('optional Supabase integration', () => {
  it('separates the Google-to-Supabase callback from the extension callback', async () => {
    const setup = (await import('../src/core/cloud')).googleOAuthSetup();
    expect(setup.googleCallback).toBe('https://example.supabase.co/auth/v1/callback');
    expect(setup.extensionCallback).toBe('https://extension.chromiumapp.org/supabase');
    expect(setup.providerSettings).toBe('https://supabase.com/dashboard/project/example/auth/providers');
    (chrome.identity.getRedirectURL as unknown as () => string) = () => 'https://evil.example/supabase';
    expect(setup).not.toHaveProperty('secret');
    const cloud = await import('../src/core/cloud'); expect(() => cloud.googleOAuthSetup()).toThrow('Invalid extension callback');
  });
  it('uses Google PKCE and verifies the returning redirect path', async () => {
    const cloud = await import('../src/core/cloud'); expect(await cloud.signInGoogle()).toBe('owner@example.com');
    expect(state.oauth.mock.calls[0][0].options.skipBrowserRedirect).toBe(true); expect(state.exchange).toHaveBeenCalledWith('pkce-result');
    state.flow.mockResolvedValue('https://extension.chromiumapp.org/supabase-evil?code=bad'); await expect(cloud.signInGoogle()).rejects.toThrow('unexpected'); expect(state.exchange).toHaveBeenCalledTimes(1);
  });
  it('names the callback to allowlist when the auth window never returns to the extension', async () => {
    state.flow.mockRejectedValue(new Error('The user did not approve access.'));
    await expect((await import('../src/core/cloud')).signInGoogle()).rejects.toThrow('add https://extension.chromiumapp.org/supabase to Supabase');
    expect(state.exchange).not.toHaveBeenCalled();
  });
  it('does not open an auth flow when Google is disabled on the project', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external: { google: false } }) }));
    await expect((await import('../src/core/cloud')).signInGoogle()).rejects.toThrow('not enabled');
    expect(state.flow).not.toHaveBeenCalled(); expect(state.oauth).not.toHaveBeenCalled();
  });
  it('does not write a backup without a verified signed-in owner', async () => {
    state.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect((await import('../src/core/cloud')).backupCloud()).rejects.toThrow('Sign in'); expect(state.upsert).not.toHaveBeenCalled();
  });
  it('backs up the validated payload under the signed-in user ID', async () => {
    await (await import('../src/core/cloud')).backupCloud();
    expect(state.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'owner-id', backup: expect.stringContaining('handoff-backup') }), { onConflict: 'user_id' });
    expect(state.set).toHaveBeenCalledWith(expect.objectContaining({ lastCloudBackup: expect.any(Number) }));
  });
  it('rejects privileged keys and leaves provider sessions alone on disconnect', async () => {
    const cloud = await import('../src/core/cloud'); expect(() => cloud.checkCloudConfig('https://example.supabase.co', 'sb_secret_no')).toThrow();
    expect(() => cloud.checkCloudConfig('http://example.supabase.co', 'sb_publishable_test')).toThrow();
    await cloud.disconnectCloud(); expect(state.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
