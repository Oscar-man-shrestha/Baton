import google from '../config/google.json';
import { exportBackup, mergeBackup, previewBackup } from './backup';

/**
 * Backup to the user's own Google Drive, as a visible file “Baton backup.json”. Scope drive.file: Baton can only see
 * files it created, never the rest of the user's Drive. Runs in the background worker (the popup closes when Google's
 * sign-in window opens). Off until src/config/google.json has an OAuth client ID (see GOOGLE_DRIVE_SETUP.md).
 */
export const driveConfigured = /^[\w-]+\.apps\.googleusercontent\.com$/.test(google.driveClientId);
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FILE_NAME = 'Baton backup.json';
type Token = { value: string; expires: number };

/** Reads access_token and expires_in from the redirect fragment Google returns. */
export function tokenFromRedirect(redirect: string, now = Date.now()): Token {
  const fragment = new URLSearchParams(new URL(redirect).hash.slice(1));
  if (fragment.get('error')) throw new Error(fragment.get('error') === 'access_denied' ? 'Google Drive access was not allowed.' : 'Google sign-in failed.');
  const value = fragment.get('access_token');
  if (!value) throw new Error('Google did not return access to Drive.');
  return { value, expires: now + (Number(fragment.get('expires_in')) || 3600) * 1000 - 60000 };
}

async function token(interactive: boolean): Promise<string> {
  if (!driveConfigured) throw new Error('Google Drive backup is not set up in this build.');
  const cached = (await chrome.storage.session.get('driveToken')).driveToken as Token | undefined;
  if (cached && cached.expires > Date.now()) return cached.value;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: google.driveClientId, response_type: 'token', redirect_uri: chrome.identity.getRedirectURL(), scope: SCOPE, include_granted_scopes: 'true', ...(interactive ? { prompt: 'select_account' } : { prompt: 'none' }) }).toString();
  const redirect = await chrome.identity.launchWebAuthFlow({ url: url.toString(), interactive });
  if (!redirect) throw new Error('Google sign-in was cancelled.');
  const fresh = tokenFromRedirect(redirect);
  await chrome.storage.session.set({ driveToken: fresh });
  return fresh.value;
}
const authorised = async () => { try { return await token(false); } catch { return token(true); } };

async function drive(path: string, init: RequestInit = {}, base = 'https://www.googleapis.com'): Promise<Response> {
  const response = await fetch(`${base}${path}`, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${await authorised()}` } });
  if (response.status === 401) { await chrome.storage.session.remove('driveToken'); }
  return response;
}

/** The newest backup file Baton made in this Drive (drive.file only lists Baton's own files). */
async function findBackup(): Promise<{ id: string; modifiedTime: string } | undefined> {
  const remembered = (await chrome.storage.local.get('driveBackupFileId')).driveBackupFileId as string | undefined;
  const query = new URLSearchParams({ q: `name='${FILE_NAME}' and trashed=false`, spaces: 'drive', orderBy: 'modifiedTime desc', fields: 'files(id,modifiedTime)', pageSize: '5' });
  const response = await drive(`/drive/v3/files?${query}`);
  if (!response.ok) throw new Error('Could not reach Google Drive. Try again.');
  const files = ((await response.json()).files || []) as { id: string; modifiedTime: string }[];
  return files.find(file => file.id === remembered) || files[0];
}

export async function backupToDrive(): Promise<string> {
  const backup = await exportBackup(await chrome.storage.local.get(null));
  if (new TextEncoder().encode(backup).length > 20000000) throw new Error('This backup is over 20 MB. Download a backup file instead.');
  const existing = await findBackup();
  let response: Response;
  if (existing) response = await drive(`/upload/drive/v3/files/${existing.id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: backup });
  else {
    const boundary = `baton${Date.now()}`;
    const metadata = JSON.stringify({ name: FILE_NAME, mimeType: 'application/json', description: 'Baton Pass backup: saved batons, projects, folders and settings. Restore it from Baton → Backups and data.' });
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${backup}\r\n--${boundary}--`;
    response = await drive('/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  }
  if (!response.ok) throw new Error('Google Drive did not accept the backup. Try again.');
  const id = existing?.id || ((await response.json()) as { id: string }).id;
  await chrome.storage.local.set({ driveBackupFileId: id, lastDriveBackup: Date.now() });
  return 'Backed up to “Baton backup.json” in your Google Drive.';
}

export async function inspectDrive(): Promise<{ contexts: number; projects: number; updatedAt: string }> {
  const file = await findBackup();
  if (!file) throw new Error('No Baton backup was found in this Google Drive.');
  const response = await drive(`/drive/v3/files/${file.id}?alt=media`);
  if (!response.ok) throw new Error('Could not download the backup from Google Drive.');
  const preview = await previewBackup(await response.text());
  return { contexts: preview.contexts, projects: preview.projects, updatedAt: file.modifiedTime };
}

export async function restoreFromDrive(): Promise<string> {
  const file = await findBackup();
  if (!file) throw new Error('No Baton backup was found in this Google Drive.');
  const response = await drive(`/drive/v3/files/${file.id}?alt=media`);
  if (!response.ok) throw new Error('Could not download the backup from Google Drive.');
  const preview = await previewBackup(await response.text());
  await chrome.storage.local.set(mergeBackup(await chrome.storage.local.get(null), preview.data));
  return 'Restored from Google Drive. Newer copies on this device were kept.';
}

/** Forget Drive access on this device (the backup file stays in Drive). */
export async function disconnectDrive(): Promise<void> {
  const cached = (await chrome.storage.session.get('driveToken')).driveToken as Token | undefined;
  await chrome.storage.session.remove('driveToken');
  if (cached) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(cached.value)}`, { method: 'POST' }).catch(() => {});
}
