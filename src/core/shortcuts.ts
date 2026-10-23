/**
 * Baton's keyboard shortcuts: the manifest's commands come from here, and the help screens list them in this order.
 * Ctrl+Shift+letter, and ⌘⇧ (Command+Shift) on a Mac, with letters the browser and the chat sites don't use
 * (ChatGPT has ⌘⇧O, S, C and I; Chrome A, B, C, D, G, I, J, M, N, O, R, T and W; Brave refuses P, F, H and J;
 * Bitwarden uses L and Y). Chrome lets an extension suggest at most four keys, and only on a fresh install; anyone
 * can change them at chrome://extensions/shortcuts.
 */
export const shortcutCommands = [
  { name: 'open-pass-menu', key: 'U', description: 'Pass this chat to another AI (opens the Pass menu)' },
  { name: 'capture-chat', key: 'K', description: 'Keep this chat as a baton' },
  { name: 'save-selection', key: 'X', description: 'Save the selected part of the chat as a baton' },
  { name: '_execute_action', key: 'E', description: 'Open Baton' },
  { name: 'open-side-panel', key: '', description: 'Open Baton in the side panel' }
] as const;
export type ShortcutCommand = (typeof shortcutCommands)[number]['name'];
/** What the background forwards to the chat page's content script. */
export const pageCommands: ShortcutCommand[] = ['open-pass-menu', 'capture-chat', 'save-selection'];
export const shortcutsPage = 'chrome://extensions/shortcuts';

/** The manifest `commands` entry. */
export function manifestCommands(): Record<string, { description: string; suggested_key?: { default: string; mac: string } }> {
  return Object.fromEntries(shortcutCommands.map(command => [command.name, { description: command.description, ...(command.key ? { suggested_key: { default: `Ctrl+Shift+${command.key}`, mac: `Command+Shift+${command.key}` } } : {}) }]));
}

/** “Command+Shift+P” as the keyboard shows it: “⌘⇧P” on a Mac (Chrome there already reports symbols). Empty when no key is set. */
export function formatShortcut(shortcut: string | undefined, mac: boolean): string {
  if (!shortcut) return '';
  if (!mac) return shortcut;
  const symbols: Record<string, string> = { Alt: '⌥', Option: '⌥', Shift: '⇧', Ctrl: '⌃', MacCtrl: '⌃', Command: '⌘', Cmd: '⌘' };
  return shortcut.split('+').map(part => symbols[part] ?? part).join('');
}

/** The rows for Baton's help: every command in Baton's order, with the key the browser actually assigned. */
export function shortcutRows(assigned: { name?: string; shortcut?: string }[], mac: boolean): { name: ShortcutCommand; description: string; keys: string }[] {
  return shortcutCommands.map(command => ({ name: command.name, description: command.description, keys: formatShortcut(assigned.find(item => item.name === command.name)?.shortcut, mac) || 'Not set' }));
}

export const onMac = (nav: Navigator) => /mac/i.test((nav as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || nav.platform || nav.userAgent);

/** “⇧⌘U” or “Ctrl+Shift+U” → one keycap per key, with words for screen readers and the tooltip. */
export function keyCaps(keys: string): { cap: string; word: string }[] {
  const words: Record<string, string> = { '⌘': 'Command', '⇧': 'Shift', '⌥': 'Option', '⌃': 'Control', Ctrl: 'Ctrl', Shift: 'Shift', Alt: 'Alt' };
  const parts = keys.includes('+') ? keys.split('+') : Array.from(keys);
  return parts.filter(Boolean).map(cap => ({ cap, word: words[cap] || cap }));
}

/** Fills a help list (popup, side panel, welcome guide) with each action and its keys, one keycap per key. */
export function fillShortcutList(list: HTMLElement, assigned: { name?: string; shortcut?: string }[], mac: boolean): void {
  const doc = list.ownerDocument;
  list.replaceChildren(...shortcutRows(assigned, mac).map(row => {
    const item = doc.createElement('li');
    const keys = doc.createElement('span'); keys.className = 'keys-cell';
    if (row.keys === 'Not set') { keys.className += ' unset'; keys.textContent = 'Not set'; keys.title = 'Set a key under Change shortcuts'; }
    else {
      const caps = keyCaps(row.keys);
      keys.title = caps.map(key => key.word).join(' + ');
      keys.setAttribute('aria-label', keys.title);
      keys.append(...caps.map(key => { const cap = doc.createElement('kbd'); cap.textContent = key.cap; cap.setAttribute('aria-hidden', 'true'); return cap; }));
    }
    const text = doc.createElement('span'); text.textContent = row.description;
    item.append(keys, text);
    return item;
  }));
}
