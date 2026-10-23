import type { ProviderId } from './selectors';

/**
 * Files that travel with a handoff: the complete chat as a Markdown file when it is too long to type in, and the files
 * the user uploaded, fetched from the source chat with the user's own session there and attached to the next AI's chat
 * box (never sent). Measured on real accounts, Oct 2026: ChatGPT, Gemini, DeepSeek and Perplexity take a pasted file;
 * Claude ignores a synthetic paste or drop and takes its file input instead. Grok is unverified, so it gets the paste.
 */
export type FileRef = { name: string; type?: string; url?: string; text?: string; size?: number; via?: 'chatgpt' };
export type FilePayload = { name: string; type: string; data: string };

export const fileLimits = { count: 8, each: 10 * 1024 * 1024, total: 20 * 1024 * 1024 };
export const attachMethod: Record<ProviderId, 'paste' | 'input'> = { chatgpt: 'paste', claude: 'input', gemini: 'paste', deepseek: 'paste', grok: 'paste', perplexity: 'paste' };

/** The newest files first (the ones the work is about), each name once, within the size limits where sizes are known. */
export function pickFiles(refs: FileRef[], limits = fileLimits): FileRef[] {
  const seen = new Set<string>();
  const picked: FileRef[] = [];
  for (const ref of [...refs].reverse()) {
    if ((!ref.url && ref.text === undefined) || seen.has(ref.name) || (ref.size ?? 0) > limits.each) continue;
    seen.add(ref.name); picked.push(ref);
    if (picked.length >= limits.count) break;
  }
  return picked.reverse();
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
export function fromBase64(data: string): Uint8Array<ArrayBuffer> {
  const binary = atob(data);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function textFile(name: string, text: string, type = 'text/plain'): FilePayload {
  return { name, type, data: toBase64(new TextEncoder().encode(text)) };
}

/** A file name from a chat title: readable, safe on every site, ending in “ - full chat.md”. */
export function transcriptName(title: string): string {
  const base = title.replace(/\s*[-–|]\s*(ChatGPT|Claude|Gemini|Google Gemini|DeepSeek|Grok|Perplexity)\s*$/i, '').replace(/[\\/:*?"<>|\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return `${base || 'Chat'} - full chat.md`;
}

/** Downloads the picked files on the source page; a file that fails or would pass the total limit is left out. */
export async function downloadFiles(refs: FileRef[], fetchFile: (ref: FileRef) => Promise<Blob>, limits = fileLimits): Promise<{ files: FilePayload[]; skipped: string[] }> {
  const files: FilePayload[] = [], skipped: string[] = [];
  let total = 0;
  for (const ref of pickFiles(refs, limits)) {
    try {
      if (ref.text !== undefined) { const file = textFile(ref.name, ref.text, ref.type || 'text/plain'); total += ref.text.length; if (total > limits.total) throw new Error('total'); files.push(file); continue; }
      const blob = await fetchFile(ref);
      if (blob.size > limits.each || total + blob.size > limits.total || /text\/html/.test(blob.type)) throw new Error('size');
      total += blob.size;
      files.push({ name: ref.name, type: blob.type || ref.type || 'application/octet-stream', data: toBase64(new Uint8Array(await blob.arrayBuffer())) });
    } catch { skipped.push(ref.name); }
  }
  return { files, skipped };
}

/** Attaches files to the chat box the way this site accepts them; reports the names that showed up on the page. */
export async function attachFiles(doc: Document, id: ProviderId, files: FilePayload[], editor: Element | undefined, wait = 3500): Promise<string[]> {
  if (!files.length) return [];
  const view = doc.defaultView as (Window & typeof globalThis) | null;
  const transfer = new (view?.DataTransfer ?? DataTransfer)();
  for (const file of files) transfer.items.add(new (view?.File ?? File)([fromBase64(file.data)], file.name, { type: file.type }));
  if (attachMethod[id] === 'input') {
    const inputs = Array.from(doc.querySelectorAll<HTMLInputElement>('input[type="file"]'));
    const input = inputs.find(element => !element.accept || !/^image\//.test(element.accept)) || inputs[0];
    if (!input) return [];
    input.files = transfer.files;
    input.dispatchEvent(new (view?.Event ?? Event)('change', { bubbles: true }));
  } else {
    if (!editor) return [];
    (editor as HTMLElement).focus();
    editor.dispatchEvent(new (view?.ClipboardEvent ?? ClipboardEvent)('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
  }
  await new Promise(resolve => setTimeout(resolve, wait));
  // Sites shorten names on their chips and some drop the extension (Gemini), so the start of the name is enough.
  const flat = (text: string) => text.replace(/\s+/g, ' ');
  const shown = flat((doc.body.innerText || doc.body.textContent || '') + Array.from(doc.querySelectorAll('[title], [aria-label], [alt]')).map(element => ` ${element.getAttribute('title') || ''} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('alt') || ''}`).join(''));
  return files.map(file => file.name).filter(name => shown.includes(flat(name.replace(/\.[^.]+$/, '')).slice(0, 12)));
}
