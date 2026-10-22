import { newChatUrls, providerNames } from '../../src/core/rescue';
import { providerIds } from '../../src/core/selectors';

// Shown once, right after install: pin Baton, open an AI chat, find the glowing button.
const colors: Record<string, string> = { claude: '#d97757', gemini: '#4c8df6', chatgpt: '#10a37f', deepseek: '#4d6bfe', grok: '#b8c0c9', perplexity: '#20b8cd' };
const ais = document.querySelector('#ais') as HTMLElement;
for (const id of providerIds) {
  const link = document.createElement('a');
  link.href = newChatUrls[id]; link.target = '_blank'; link.rel = 'noopener';
  link.style.setProperty('--c', colors[id]);
  link.textContent = providerNames[id];
  ais.append(link);
}

// Pinned or not: Chrome reports it; check again whenever the page is looked at.
const pinStatus = document.querySelector('#pin-status') as HTMLElement;
const pinStep = document.querySelector('#step-pin') as HTMLElement;
const checkPinned = async () => {
  try {
    const settings = await chrome.action.getUserSettings();
    pinStep.classList.toggle('done', settings.isOnToolbar);
    pinStatus.textContent = settings.isOnToolbar ? '✓ Pinned. Baton is one click away.' : 'Not pinned yet. This page updates when you pin it.';
  } catch { pinStatus.textContent = ''; }
};
void checkPinned();
setInterval(() => { if (!document.hidden) void checkPinned(); }, 1500);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void checkPinned(); });

document.querySelector('#open-settings')?.addEventListener('click', () => { void chrome.runtime.openOptionsPage(); });

// The quick tour runs on a chat page, where the glowing button and usage bar are: queue it for the next one.
document.querySelector('#start-tour')?.addEventListener('click', () => {
  void chrome.storage.local.set({ tourReplay: true }).then(() => { (document.querySelector('#tour-status') as HTMLElement).textContent = 'Done. Open any AI chat above and the tour starts there.'; });
});
