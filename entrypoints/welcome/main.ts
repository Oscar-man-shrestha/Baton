import { newChatUrls, providerNames } from '../../src/core/rescue';
import { providerIds } from '../../src/core/selectors';
import { startMotion } from './motion';
import { fillShortcutList, onMac, shortcutsPage } from '../../src/core/shortcuts';

// Opens once after install, and from the ? button in Baton (welcome.html#guide), where it reads as the guide.
const guideMode = () => { const guide = location.hash === '#guide'; document.title = guide ? 'How to use Baton' : 'Welcome to Baton'; (document.querySelector('#eyebrow') as HTMLElement).textContent = guide ? 'Baton guide' : 'Baton Pass is installed'; };
guideMode(); addEventListener('hashchange', guideMode);
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
// The keys the browser actually assigned (another extension may hold one); changed on the browser's shortcuts page.
const shortcutList = document.querySelector('#shortcut-list') as HTMLElement | null;
if (shortcutList) void chrome.commands?.getAll().then(commands => fillShortcutList(shortcutList, commands, onMac(navigator))).catch(() => {});
document.querySelector('#change-shortcuts')?.addEventListener('click', () => { void chrome.tabs.create({ url: shortcutsPage }); });

// The quick tour runs on a chat page, where the glowing button and usage bar are: queue it for the next one.
document.querySelector('#start-tour')?.addEventListener('click', () => {
  void chrome.storage.local.set({ tourReplay: true }).then(() => {
    (document.querySelector('#tour-status') as HTMLElement).textContent = '✓ Ready. Open any AI chat below and the tour starts there.';
    document.querySelector('#setup')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
});

startMotion();
