import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { attachFiles, downloadFiles, fromBase64, pickFiles, textFile, toBase64, transcriptName } from '../src/core/files';
import { chatgptTurns, claudeTurns, grokTurns } from '../src/core/lossless';

describe('files that travel with a handoff', () => {
  it('picks the newest files, each name once, within the limits', () => {
    const refs = [{ name: 'a.png', url: 'u1' }, { name: 'b.png', url: 'u2' }, { name: 'a.png', url: 'u3' }, { name: 'huge.mov', url: 'u4', size: 50e6 }, { name: 'name-only.txt' }];
    expect(pickFiles(refs).map(ref => ref.url)).toEqual(['u2', 'u3']);
    expect(pickFiles(refs, { count: 1, each: 10e6, total: 20e6 }).map(ref => ref.url)).toEqual(['u3']);
  });
  it('downloads within the total limit, rebuilds text documents, and skips what fails or is a web page', async () => {
    const blobs: Record<string, Blob> = { u1: new Blob(['x'.repeat(600)], { type: 'image/png' }), u2: new Blob(['<html>'], { type: 'text/html' }), u3: new Blob(['y'.repeat(600)], { type: 'image/png' }) };
    const result = await downloadFiles([{ name: 'one.png', url: 'u1' }, { name: 'login.png', url: 'u2' }, { name: 'gone.png', url: 'missing' }, { name: 'notes.txt', text: 'hello' }, { name: 'two.png', url: 'u3' }],
      async ref => { if (!blobs[ref.url!]) throw new Error('404'); return blobs[ref.url!]; }, { count: 8, each: 1000, total: 1000 });
    expect(result.files.map(file => file.name)).toEqual(['one.png', 'notes.txt']);
    expect(result.skipped).toEqual(['login.png', 'gone.png', 'two.png']);
    expect(new TextDecoder().decode(fromBase64(result.files[1].data))).toBe('hello');
  });
  it('names the full-chat file after the chat, without the service name', () => {
    expect(transcriptName('Cinematic 3D developer portfolio with interactive character - Claude')).toBe('Cinematic 3D developer portfolio with interactive character - full chat.md');
    expect(transcriptName('a/b: c?')).toBe('a b c - full chat.md');
    expect(transcriptName('')).toBe('Chat - full chat.md');
    expect(new TextDecoder().decode(fromBase64(toBase64(new TextEncoder().encode('ünïcode ✓'))))).toBe('ünïcode ✓');
  });
  it('attaches by paste, or through the file input on Claude, and reports what showed up', async () => {
    const dom = new JSDOM('<div contenteditable="true"></div><input type="file" accept="image/*"><input type="file"><div id="chips"></div>');
    const doc = dom.window.document;
    const editor = doc.querySelector('[contenteditable]')!;
    let pasted: string[] = [];
    editor.addEventListener('paste', event => { pasted = Array.from((event as ClipboardEvent).clipboardData?.files || []).map(file => file.name); doc.querySelector('#chips')!.textContent = pasted.join(' '); });
    if (!dom.window.ClipboardEvent) Object.assign(dom.window, { ClipboardEvent: class extends dom.window.Event { clipboardData: unknown; constructor(type: string, init: { clipboardData?: unknown } & EventInit) { super(type, init); this.clipboardData = init.clipboardData; } } });
    if (!dom.window.DataTransfer) Object.assign(dom.window, { DataTransfer: class { private list: File[] = []; items = { add: (file: File) => { this.list.push(file); } }; get files() { return this.list; } } });
    const files = [textFile('Tidy CLI - full chat.md', '# chat'), textFile('notes.txt', 'n')];
    expect(await attachFiles(doc, 'chatgpt', files, editor, 0)).toEqual(['Tidy CLI - full chat.md', 'notes.txt']);
    const input = doc.querySelectorAll('input')[1];
    let changed = false;
    input.addEventListener('change', () => { changed = true; });
    Object.defineProperty(input, 'files', { set() {}, get() { return []; } });
    await attachFiles(doc, 'claude', files, editor, 0);
    expect(changed).toBe(true);
  });
  it('records where each file can be fetched: Claude documents and previews, ChatGPT downloads, Grok assets', () => {
    const claude = claudeTurns({ chat_messages: [{ uuid: 'u', sender: 'human', content: [{ type: 'text', text: 'see these' }],
      attachments: [{ file_name: '', file_type: 'txt', extracted_content: 'PROJECT DOCUMENTATION' }],
      files_v2: [{ file_name: 'Screenshot.png', file_kind: 'image', preview_url: '/api/org/files/1/preview', size_bytes: 4e6 }] }] });
    expect(claude[0].files).toEqual([{ name: 'Pasted text 1.txt', type: 'text/plain', text: 'PROJECT DOCUMENTATION', size: undefined }, { name: 'Screenshot.webp', url: '/api/org/files/1/preview', size: 4e6 }]);
    expect(claude[0].text).toBe('see these\n\n[Files: Pasted text 1.txt, Screenshot.webp]');
    const gpt = chatgptTurns({ current_node: 'u', mapping: { u: { parent: null, message: { author: { role: 'user' }, content: { content_type: 'multimodal_text', parts: ['look'] }, metadata: { attachments: [{ id: 'file_1', name: 'shot.png', mime_type: 'image/png', size: 405136 }] } } } } });
    expect(gpt[0].files).toEqual([{ name: 'shot.png', type: 'image/png', size: 405136, url: 'file_1', via: 'chatgpt' }]);
    const grok = grokTurns([{ responseId: 'r', sender: 'human', message: 'fix', fileAttachmentsMetadata: [{ fileName: 'a.png', fileMimeType: 'image/png', fileUri: 'users/1/2/content' }] }]);
    expect(grok[0].files).toEqual([{ name: 'a.png', type: 'image/png', url: 'https://assets.grok.com/users/1/2/content' }]);
  });
});
