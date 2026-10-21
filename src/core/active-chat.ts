import { isSupportedChatUrl } from './connection';
import type { ProviderId } from './selectors';

type ChatTab = { id?: number; url?: string; windowId?: number };
type Connection = { ready?: boolean; provider?: ProviderId };

/** Ignore late connections after the user switches tabs or navigates. */
export function createActiveChatTracker<T extends ChatTab>(
  readTab: () => Promise<T | undefined>,
  connect: (tab: T) => Promise<Connection>,
  update: (tab: T | undefined, provider: ProviderId | undefined) => void,
  failed: (tab: T) => void = () => {}
) {
  let revision = 0;
  return async () => {
    const requested = ++revision;
    const tab = await readTab();
    if (requested !== revision) return;
    update(tab, undefined);
    if (!tab || !isSupportedChatUrl(tab.url)) return;
    try {
      const response = await connect(tab);
      if (requested === revision && response.ready) update(tab, response.provider);
    } catch { if (requested === revision) failed(tab); }
  };
}
