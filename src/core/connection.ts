import { bundledSelectors, providerIds } from './selectors';

export function isSupportedChatUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && providerIds.some(id => bundledSelectors.providers[id].hosts.includes(url.hostname));
  } catch { return false; }
}

export function isMissingReceiver(error: unknown): boolean {
  return /(?:receiving end does not exist|could not establish connection)/i.test(String(error));
}

const injections = new Map<number, Promise<void>>();

export async function sendWithBootstrap<T>(
  tab: { id?: number; url?: string },
  message: unknown,
  send: (tabId: number, message: unknown) => Promise<T>,
  inject: (tabId: number) => Promise<void>,
  pause: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))
): Promise<T> {
  if (!tab.id || !isSupportedChatUrl(tab.url)) throw new Error('Open a supported AI chat tab first.');
  try { return await send(tab.id, message); }
  catch (error) { if (!isMissingReceiver(error)) throw error; }
  await pause(150);
  try { return await send(tab.id, message); }
  catch (error) { if (!isMissingReceiver(error)) throw error; }
  let injection = injections.get(tab.id);
  if (!injection) {
    injection = inject(tab.id);
    injections.set(tab.id, injection);
    void injection.finally(() => { if (injections.get(tab.id!) === injection) injections.delete(tab.id!); }).catch(() => {});
  }
  await injection;
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await send(tab.id, message); }
    catch (error) {
      if (!isMissingReceiver(error) || attempt === 3) throw error;
      await pause(150);
    }
  }
  throw new Error('The chat page did not connect.');
}
