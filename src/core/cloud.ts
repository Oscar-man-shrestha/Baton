import config from '../config/cloud.json';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { exportBackup, previewBackup, mergeBackup } from './backup';

export const cloudConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url) && !!config.publishableKey;
export function checkCloudConfig(url: string, key: string): void {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) throw new Error('A configured HTTPS Supabase project URL is required.');
  if (key.startsWith('sb_secret_')) throw new Error('A secret Supabase key cannot be used in an extension.');
  if (key.startsWith('eyJ')) {
    try { const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); if (payload.role !== 'anon') throw new Error('Only an anon or publishable key belongs in an extension.'); }
    catch { throw new Error('Invalid public Supabase key.'); }
  } else if (!key.startsWith('sb_publishable_')) throw new Error('Use the Supabase publishable key.');
}
let instance: SupabaseClient | undefined;
function client(): SupabaseClient {
  checkCloudConfig(config.url, config.publishableKey);
  if (!instance) instance = createClient(config.url, config.publishableKey, {
    auth: { flowType: 'pkce', detectSessionInUrl: false, autoRefreshToken: false, persistSession: true,
      // App OAuth session only, never an AI provider's credentials. Cleared when browser exits.
      storage: {
        getItem: async key => (await chrome.storage.session.get(`cloud-auth:${key}`))[`cloud-auth:${key}`] as string || null,
        setItem: async (key, value) => { await chrome.storage.session.set({ [`cloud-auth:${key}`]: value }); },
        removeItem: async key => { await chrome.storage.session.remove(`cloud-auth:${key}`); }
      }
    }
  });
  return instance;
}
export function googleOAuthSetup() {
  checkCloudConfig(config.url, config.publishableKey);
  const extensionCallback = chrome.identity.getRedirectURL('supabase');
  const callback = new URL(extensionCallback);
  if (callback.protocol !== 'https:' || !callback.hostname.endsWith('.chromiumapp.org') || callback.pathname !== '/supabase' || callback.search || callback.hash) throw new Error('Invalid extension callback.');
  return { googleCallback: `${config.url}/auth/v1/callback`, extensionCallback, providerSettings: `https://supabase.com/dashboard/project/${new URL(config.url).hostname.split('.')[0]}/auth/providers` };
}
export async function googleSignInAvailable(): Promise<boolean> {
  checkCloudConfig(config.url, config.publishableKey);
  const response = await fetch(`${config.url}/auth/v1/settings`, { headers: { apikey: config.publishableKey }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Could not check Google sign-in availability.');
  const settings = await response.json();
  return settings.external?.google === true;
}
export async function signInGoogle(): Promise<string> {
  if (!await googleSignInAvailable()) throw new Error('Google sign-in is not enabled in this Supabase project yet. Local batons are saved normally.');
  const supabase = client();
  const redirect = googleOAuthSetup().extensionCallback;
  const result = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } } });
  if (result.error || !result.data.url) throw new Error(result.error?.message || 'Could not start Google sign-in.');
  const returned = await chrome.identity.launchWebAuthFlow({ url: result.data.url, interactive: true });
  if (!returned) throw new Error('Sign-in was cancelled.');
  const callback = new URL(returned); const expected = new URL(redirect);
  if (callback.origin !== expected.origin || callback.pathname !== expected.pathname) throw new Error('Sign-in returned an unexpected address.');
  if (callback.searchParams.has('error')) throw new Error(callback.searchParams.get('error_description') || 'Google sign-in failed.');
  const code = callback.searchParams.get('code'); if (!code) throw new Error('Sign-in did not return a PKCE authorization code.');
  const exchanged = await supabase.auth.exchangeCodeForSession(code); if (exchanged.error) throw exchanged.error;
  const user = await owner();
  return user.email || 'Google account connected';
}
async function owner() {
  const { data, error } = await client().auth.getUser();
  if (error || !data.user) throw new Error('Sign in with Google first.');
  return data.user;
}
export async function accountLabel(): Promise<string | undefined> {
  if (!cloudConfigured) return undefined;
  try { return (await owner()).email || 'Connected'; } catch { return undefined; }
}
/** Name, email and Google profile photo for the account button; undefined when signed out. */
export async function accountProfile(): Promise<{ email?: string; name?: string; avatar?: string } | undefined> {
  if (!cloudConfigured) return undefined;
  try {
    const user = await owner();
    const meta = (user.user_metadata || {}) as Record<string, unknown>;
    const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined;
    const avatar = text(meta.avatar_url) || text(meta.picture);
    return { email: user.email, name: text(meta.full_name) || text(meta.name), avatar: avatar && /^https:\/\//.test(avatar) ? avatar : undefined };
  } catch { return undefined; }
}
export async function backupCloud(): Promise<void> {
  const user = await owner();
  const backup = await exportBackup(await chrome.storage.local.get(null));
  if (new TextEncoder().encode(backup).length > 20000000) throw new Error('Backup exceeds the 20 MB cloud limit. Download a local backup instead.');
  const { error } = await client().from('handoff_backups').upsert({ user_id: user.id, backup, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
  await chrome.storage.local.set({ lastCloudBackup: Date.now() });
}
export async function inspectCloud() {
  const user = await owner();
  const { data, error } = await client().from('handoff_backups').select('backup,updated_at').eq('user_id', user.id).maybeSingle();
  if (error) throw error; if (!data) throw new Error('This account has no cloud backup yet.');
  const preview = await previewBackup(data.backup);
  return { ...preview, updatedAt: String(data.updated_at) };
}
export async function restoreCloud(preview: Awaited<ReturnType<typeof inspectCloud>>): Promise<void> {
  // Local merge keeps newer saved copies. Preview must have passed schema/checksum validation.
  await chrome.storage.local.set(mergeBackup(await chrome.storage.local.get(null), preview.data));
}
export async function disconnectCloud(): Promise<void> {
  const { error } = await client().auth.signOut({ scope: 'local' }); if (error) throw error;
}
export async function deleteCloudBackup(): Promise<void> {
  const user = await owner();
  const { error } = await client().from('handoff_backups').delete().eq('user_id', user.id); if (error) throw error;
}
