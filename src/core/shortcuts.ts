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

/** Fills a help list (popup, side panel, welcome guide) with each action and its key. */
export function fillShortcutList(list: HTMLElement, assigned: { name?: string; shortcut?: string }[], mac: boolean): void {
  const doc = list.ownerDocument;
  list.replaceChildren(...shortcutRows(assigned, mac).map(row => {
    const item = doc.createElement('li');
    const keys = doc.createElement('kbd'); keys.textContent = row.keys; if (row.keys === 'Not set') keys.className = 'unset';
    const text = doc.createElement('span'); text.textContent = row.description;
    item.append(keys, text);
    return item;
  }));
}
